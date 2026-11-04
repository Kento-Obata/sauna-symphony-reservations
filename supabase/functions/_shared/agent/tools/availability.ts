// 空き状況と休業日。どの枠が開いているかは _shared/slot-rules.ts(フロントと同じルール)、
// 枠の時刻は DB の resolve_slot_times() で決める。

import { formatMdWithWeekday } from "../../date-jst.ts";
import { toHHMM } from "../../reservation-time.ts";
import { applicableSlotsForDate, type DailySlotRow, SLOT_LABELS, SLOT_ORDER, type TimeSlot } from "../../slot-rules.ts";
import { type AgentTool, type Sql, ToolError } from "../types.ts";
import { assertDateRange, dateSchema } from "./common.ts";

export type SlotState = "open" | "booked" | "off" | "closed";

export interface DaySlots {
  date: string;
  closed: { reason: string | null; is_event: boolean } | null;
  slots: {
    time_slot: TimeSlot;
    label: string;
    start: string;
    end: string;
    state: SlotState;
    /** 枠を押さえている予約(確定・確認待ち・決済手続き中) */
    reservation?: { code: string; guest_name: string; status: string };
  }[];
}

/** 予約で枠が埋まっているとみなす条件。フロントの空き判定・get-availability と同じ */
const OCCUPYING = (tx: Sql) =>
  tx`(r.status in ('confirmed', 'pending') or (r.status = 'pending_payment' and r.expires_at > now()))`;

/** from〜to の各日・各枠の状態。予約作成・変更の確認にも使う */
export const loadDaySlots = async (tx: Sql, from: string, to: string): Promise<DaySlots[]> => {
  const [closures, dailyRows, reservations, times] = await Promise.all([
    tx`select date::text, reason, event_id is not null as is_event from public.shop_closures where date between ${from}::date and ${to}::date`,
    tx`select date::text, time_slot::text, is_active from public.daily_time_slots where date between ${from}::date and ${to}::date`,
    tx`
      select r.date::text, r.time_slot::text, r.reservation_code, r.guest_name, r.status
      from public.reservations r
      where r.date between ${from}::date and ${to}::date and ${OCCUPYING(tx)}
      order by r.created_at
    `,
    tx`
      select d::date::text as date, s.slot::text as time_slot, t.start_time::text, t.end_time::text
      from generate_series(${from}::date, ${to}::date, interval '1 day') d
      cross join unnest(enum_range(null::public.time_slot)) as s(slot)
      cross join lateral public.resolve_slot_times(d::date, s.slot) t
    `,
  ]);

  const days: DaySlots[] = [];
  for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) {
    const closure = closures.find((c: { date: string }) => c.date === d);
    const open = applicableSlotsForDate(d, (dailyRows as DailySlotRow[]).filter((r) => r.date === d));
    days.push({
      date: d,
      closed: closure ? { reason: closure.reason, is_event: closure.is_event } : null,
      slots: SLOT_ORDER.map((slot) => {
        const time = times.find((t: { date: string; time_slot: string }) => t.date === d && t.time_slot === slot);
        const booked = reservations.find((r: { date: string; time_slot: string }) => r.date === d && r.time_slot === slot);
        const state: SlotState = closure ? "closed" : booked ? "booked" : open.includes(slot) ? "open" : "off";
        return {
          time_slot: slot,
          label: SLOT_LABELS[slot],
          start: toHHMM(time?.start_time),
          end: toHHMM(time?.end_time),
          state,
          ...(booked ? { reservation: { code: booked.reservation_code, guest_name: booked.guest_name, status: booked.status } } : {}),
        };
      }),
    });
  }
  return days;
};

const STATE_LABELS: Record<SlotState, string> = { open: "空き", booked: "予約あり", off: "おやすみ", closed: "休業" };

const dayLine = (day: DaySlots) => {
  if (day.closed) return `${formatMdWithWeekday(day.date)}: 休業${day.closed.reason ? `（${day.closed.reason}）` : ""}`;
  const parts = day.slots
    .filter((s) => s.state !== "off" || s.reservation)
    .map((s) => `${s.label}${s.start}〜 ${s.reservation ? `予約あり(${s.reservation.guest_name}様)` : STATE_LABELS[s.state]}`);
  return `${formatMdWithWeekday(day.date)}: ${parts.length ? parts.join(" / ") : "開いている枠なし"}`;
};

const getAvailability: AgentTool<{ date_from: string; date_to?: string }> = {
  name: "get_availability",
  title: "空き状況",
  description:
    "期間内の各日・各枠(午前/午後/夕方/夜)が 空き・予約あり・おやすみ(その日は営業しない枠)・休業 のどれかを返します。" +
    "枠の時刻も返します。新しい予約を入れる前の確認に使ってください(1回で62日まで)。",
  inputSchema: {
    type: "object",
    properties: {
      date_from: dateSchema("開始日"),
      date_to: dateSchema("終了日(省略すると開始日だけ)"),
    },
    required: ["date_from"],
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx, { date_from, date_to }) {
    const to = date_to ?? date_from;
    assertDateRange(date_from, to);
    const days = await ctx.asUser((tx) => loadDaySlots(tx, date_from, to));
    // スタッフには予約者名を出さない(空き状況だけ)
    const visible = ctx.caller.role === "admin"
      ? days
      : days.map((d) => ({ ...d, slots: d.slots.map(({ reservation: _r, ...s }) => s) }));
    return { text: visible.map(dayLine).join("\n"), data: visible };
  },
};

interface ClosureRow {
  id: string;
  date: string;
  reason: string | null;
  event_title: string | null;
}

const listClosures: AgentTool<{ date_from: string; date_to: string }> = {
  name: "list_closures",
  title: "休業日の一覧",
  description: "期間内の休業日(パブリックイベントの日を含む)を返します。",
  inputSchema: {
    type: "object",
    properties: { date_from: dateSchema("開始日"), date_to: dateSchema("終了日") },
    required: ["date_from", "date_to"],
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx, { date_from, date_to }) {
    assertDateRange(date_from, date_to, 400);
    const rows = await ctx.asUser<ClosureRow[]>((tx) => tx`
      select c.id::text, c.date::text, c.reason, e.title as event_title
      from public.shop_closures c
      left join public.events e on e.id = c.event_id
      where c.date between ${date_from}::date and ${date_to}::date
      order by c.date
    `);
    return {
      text: rows.length
        ? rows.map((r) =>
          `${formatMdWithWeekday(r.date)} ${r.event_title ? `イベント「${r.event_title}」` : r.reason ?? ""}`.trim()
        ).join("\n")
        : "期間内の休業日はありません",
      data: rows,
    };
  },
};

const createClosure: AgentTool<{ date: string; reason?: string }> = {
  name: "create_closure",
  title: "休業日を追加",
  description:
    "指定した日を休業日にします(その日はお客様が予約できなくなります)。すでに入っている予約はキャンセルされません。" +
    "結果にその日の予約を返すので、ある場合はお客様への連絡やキャンセルが必要かユーザーに確認してください。",
  inputSchema: {
    type: "object",
    properties: {
      date: dateSchema("休業にする日"),
      reason: { type: "string", maxLength: 100, description: "理由(例: 設備点検)" },
    },
    required: ["date"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "write",
  async run(ctx, { date, reason }) {
    if (date < ctx.todayYmd) throw new ToolError("過去の日付は休業にできません");
    const existing = await ctx.asUser(async (tx) => {
      const dup = await tx`select 1 from public.shop_closures where date = ${date}::date`;
      if (dup.length) throw new ToolError(`${formatMdWithWeekday(date)} はすでに休業日です`);
      await tx`insert into public.shop_closures (date, reason) values (${date}::date, ${reason ?? null})`;
      return await tx`
        select r.reservation_code, r.guest_name, r.guest_count, r.start_time::text, r.status
        from public.reservations r
        where r.date = ${date}::date and ${OCCUPYING(tx)}
        order by r.start_time
      `;
    });
    const lines = existing.map((r: { reservation_code: string; guest_name: string; guest_count: number; start_time: string }) =>
      `${r.reservation_code} ${toHHMM(r.start_time)} ${r.guest_name}様 ${r.guest_count}名`
    );
    return {
      text: [
        `${formatMdWithWeekday(date)} を休業日にしました${reason ? `（${reason}）` : ""}`,
        lines.length ? `この日の予約が${lines.length}件あります(キャンセルはされていません):\n${lines.join("\n")}` : "この日の予約はありません",
      ].join("\n"),
      data: { reservations: existing },
    };
  },
};

const deleteClosure: AgentTool<{ date: string }> = {
  name: "delete_closure",
  title: "休業日を取り消す",
  description: "休業日を取り消して、その日を通常どおり予約できる状態に戻します。パブリックイベントの日は取り消せません(イベント側で日程を変えてください)。",
  inputSchema: {
    type: "object",
    properties: { date: dateSchema("取り消す休業日") },
    required: ["date"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "write",
  async run(ctx, { date }) {
    await ctx.asUser(async (tx) => {
      const rows = await tx`select id::text, event_id from public.shop_closures where date = ${date}::date`;
      if (!rows[0]) throw new ToolError(`${formatMdWithWeekday(date)} は休業日ではありません`);
      if (rows[0].event_id) throw new ToolError("パブリックイベントの日の休業は、イベントの日程から自動で入っています\u3000イベント側で変更してください");
      await tx`delete from public.shop_closures where id = ${rows[0].id}::uuid`;
    });
    return { text: `${formatMdWithWeekday(date)} の休業を取り消しました` };
  },
};

export const availabilityTools: AgentTool[] = [getAvailability, listClosures, createClosure, deleteClosure];
