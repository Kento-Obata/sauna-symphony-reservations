// 予約: 一覧・詳細・メモ・電話/DM の予約の作成・変更・キャンセル。
//
// 管理画面ではブラウザ側でしか確かめていない決まり(休業日・その日に開いている枠・同じ枠の予約・料金)を、
// ここではサーバー側で確かめてから書き込む。変更・キャンセルはお客様に通知が届くので、実行前に確認を挟む。

import { adminCancelReservation, loadAdminCancelTarget } from "../../admin-reservation-cancel.ts";
import { addJstDays, formatMdWithWeekday } from "../../date-jst.ts";
import { sendEmail } from "../../email.ts";
import { formatHerbStaffLine } from "../../herb.ts";
import { toE164 } from "../../phone.ts";
import { acquireSlotLock } from "../../reservation-payment.ts";
import { formatReservationTime } from "../../reservation-time.ts";
import { applicableSlotsForDate, SLOT_LABELS, type TimeSlot } from "../../slot-rules.ts";
import { sendSMS } from "../../twilio.ts";
import { type AgentContext, type AgentTool, type JsonSchema, type Sql, ToolError } from "../types.ts";
import { ACTIVE_STATUSES, assertDateRange, dateSchema, reservationCodeSchema, STATUS_LABELS } from "./common.ts";

const TIME_SLOT_SCHEMA: JsonSchema = {
  type: "string",
  enum: ["morning", "afternoon", "evening", "night"],
  description: "枠: morning=午前 / afternoon=午後 / evening=夕方 / night=夜",
};
const PHONE_PATTERN = "^[0-9０-９+\\-‐ー（）() ]{10,20}$";
const BLOCK_NAME = "休枠"; // 管理カレンダーで枠を止めるための仮の予約(お客様ではない)

const PAYMENT_LABELS: Record<string, string> = { onsite: "現地払い", square_online: "事前決済" };

const yen = (n: number) => `¥${Number(n).toLocaleString()}`;

/** 保存用: 国内の 0 から始まる数字だけの形(+81 付きで言われても 0 に直す) */
const normalizePhone = (phone: string) => {
  const e164 = toE164(phone);
  return e164.startsWith("+81") ? `0${e164.slice(3)}` : e164.replace(/\D/g, "");
};

// --- 一覧・詳細 ---

interface ReservationListRow {
  reservation_code: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  time_slot: string;
  guest_name: string;
  guest_count: number;
  phone: string;
  email: string | null;
  status: string;
  total_price: number;
  payment_method: string;
  payment_status: string;
  herb_choice: string | null;
  herb_selection: unknown;
  admin_memo: string | null;
}

const STAFF_DAYS_AHEAD = 2;

const listReservations: AgentTool<{ date_from?: string; date_to?: string; query?: string; include_cancelled?: boolean }> = {
  name: "list_reservations",
  title: "予約の一覧・検索",
  description:
    "期間内の予約(既定は今日から14日間)を時刻順に返します。query でお名前・電話番号・予約コードを絞り込めます。" +
    "キャンセル・失効した予約は include_cancelled=true のときだけ含めます。" +
    "スタッフは今日から2日先までで、電話番号・金額・メモは返しません。",
  inputSchema: {
    type: "object",
    properties: {
      date_from: dateSchema("開始日(省略すると今日)"),
      date_to: dateSchema("終了日(省略すると開始日から14日間。スタッフは開始日の2日後まで)"),
      query: { type: "string", maxLength: 50, description: "お名前の一部・電話番号の一部(4桁以上)・予約コード" },
      include_cancelled: { type: "boolean", default: false },
    },
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx, { date_from, date_to, query, include_cancelled }) {
    const isAdmin = ctx.caller.role === "admin";
    const from = date_from ?? ctx.todayYmd;
    const to = date_to ?? addJstDays(from, isAdmin ? 13 : STAFF_DAYS_AHEAD);
    assertDateRange(from, to, isAdmin ? 92 : 3);
    if (!isAdmin && (from < ctx.todayYmd || to > addJstDays(ctx.todayYmd, STAFF_DAYS_AHEAD))) {
      throw new ToolError("スタッフが確認できるのは、今日から2日先までの予約です");
    }

    const q = query?.trim() ?? "";
    const digits = normalizePhone(q);
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await ctx.asUser<ReservationListRow[]>((tx) => tx`
      select reservation_code, date::text, start_time::text, end_time::text, time_slot::text, guest_name, guest_count,
             phone, email, status, total_price, payment_method, payment_status, herb_choice, herb_selection, admin_memo
      from public.reservations
      where date between ${from}::date and ${to}::date
        and ${include_cancelled ? tx`true` : tx`status = any(${ACTIVE_STATUSES})`}
        and ${q === "" ? tx`true` : tx`(
          guest_name ilike ${like}
          or reservation_code = ${q.toUpperCase()}
          ${digits.length >= 4 ? tx`or regexp_replace(phone, '\\D', '', 'g') like ${`%${digits}%`}` : tx``}
        )`}
      order by date, start_time nulls last, created_at
      limit 200
    `);

    const lines = rows.map((r) => {
      const status = r.status === "confirmed" ? "" : `【${STATUS_LABELS[r.status] ?? r.status}】`;
      const herb = formatHerbStaffLine(r.herb_choice, r.herb_selection)?.replace(/^🌿 /, "ハーブ: ") ?? "";
      const money = isAdmin ? ` ${yen(r.total_price)} ${PAYMENT_LABELS[r.payment_method] ?? r.payment_method}${r.payment_status === "paid" ? "(支払済)" : ""}` : "";
      return `${r.reservation_code} ${formatMdWithWeekday(r.date)} ${formatReservationTime(r)} ${r.guest_name}様 ${r.guest_count}名${money}${status}${herb ? ` ${herb}` : ""}`;
    });
    const data = rows.map((r) => ({
      code: r.reservation_code,
      date: r.date,
      time: formatReservationTime(r),
      time_slot: r.time_slot,
      guest_name: r.guest_name,
      guest_count: r.guest_count,
      status: r.status,
      herb: formatHerbStaffLine(r.herb_choice, r.herb_selection),
      ...(isAdmin
        ? { phone: r.phone, email: r.email, total_price: r.total_price, payment_method: r.payment_method, payment_status: r.payment_status, memo: r.admin_memo }
        : {}),
    }));
    return {
      text: rows.length
        ? `${formatMdWithWeekday(from)}〜${formatMdWithWeekday(to)} の予約 ${rows.length}件${rows.length === 200 ? "(200件で打ち切り)" : ""}\n${lines.join("\n")}`
        : `${formatMdWithWeekday(from)}〜${formatMdWithWeekday(to)} に該当する予約はありません`,
      data,
    };
  },
};

const getReservation: AgentTool<{ reservation_code: string }> = {
  name: "get_reservation",
  title: "予約の詳細",
  description: "予約コードから、お客様の連絡先・オプション・料金・支払い・ハーブ・メモまで詳しく返します。",
  inputSchema: {
    type: "object",
    properties: { reservation_code: reservationCodeSchema },
    required: ["reservation_code"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "read",
  async run(ctx, { reservation_code }) {
    const { r, options } = await ctx.asUser(async (tx) => {
      const rows: (ReservationListRow & { id: string; created_at: string })[] = await tx`
        select id::text, reservation_code, date::text, start_time::text, end_time::text, time_slot::text,
               guest_name, guest_count, phone, email, status, total_price, payment_method, payment_status,
               herb_choice, herb_selection, admin_memo, created_at
        from public.reservations
        where reservation_code = ${reservation_code.toUpperCase()}
        limit 1
      `;
      if (!rows[0]) throw new ToolError(`予約コード ${reservation_code.toUpperCase()} の予約が見つかりません`);
      const options = await tx`
        select o.name, ro.quantity, ro.total_price
        from public.reservation_options ro join public.options o on o.id = ro.option_id
        where ro.reservation_id = ${rows[0].id}::uuid
        order by o.name
      `;
      return { r: rows[0], options };
    });
    const optionText = options.map((o: { name: string; quantity: number; total_price: number }) => `${o.name}×${o.quantity} ${yen(o.total_price)}`).join("、");
    return {
      text: [
        `${r.reservation_code} ${formatMdWithWeekday(r.date)} ${formatReservationTime(r)}（${SLOT_LABELS[r.time_slot as TimeSlot] ?? r.time_slot}）`,
        `${r.guest_name}様 ${r.guest_count}名 / ${STATUS_LABELS[r.status] ?? r.status}`,
        `電話 ${r.phone}${r.email ? ` / メール ${r.email}` : ""}`,
        `料金 ${yen(r.total_price)}（${PAYMENT_LABELS[r.payment_method] ?? r.payment_method}・${r.payment_status === "paid" ? "支払済" : r.payment_status === "refunded" ? "返金済" : "未払い"}）`,
        `オプション ${optionText || "なし"}`,
        `ハーブ ${formatHerbStaffLine(r.herb_choice, r.herb_selection)?.replace(/^🌿 /, "") ?? "導入前の予約（未設定）"}`,
        r.admin_memo ? `メモ ${r.admin_memo}` : "",
      ].filter(Boolean).join("\n"),
      data: { ...r, options },
    };
  },
};

const setReservationMemo: AgentTool<{ reservation_code: string; memo: string }> = {
  name: "set_reservation_memo",
  title: "予約のメモを書く",
  description: "予約の店舗用メモ(お客様には見えない)を書き換えます。空文字で消します。",
  inputSchema: {
    type: "object",
    properties: {
      reservation_code: reservationCodeSchema,
      memo: { type: "string", maxLength: 1000, description: "メモの全文(前の内容は置き換わります)" },
    },
    required: ["reservation_code", "memo"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "write",
  async run(ctx, { reservation_code, memo }) {
    const rows = await ctx.asUser((tx) => tx`
      update public.reservations
      set admin_memo = ${memo.trim() || null}, admin_memo_updated_at = now(), admin_memo_updated_by = ${ctx.caller.userId}::uuid
      where reservation_code = ${reservation_code.toUpperCase()}
      returning reservation_code
    `) as { reservation_code: string }[];
    if (!rows[0]) throw new ToolError(`予約コード ${reservation_code.toUpperCase()} の予約が見つかりません`);
    return { text: memo.trim() ? `${rows[0].reservation_code} のメモを更新しました` : `${rows[0].reservation_code} のメモを消しました` };
  },
};

// --- 作成・変更で共通の確認 ---

/** 休業日・その日に開いている枠・同じ枠の予約(確定・確認待ち・決済手続き中)を確かめる。excludeId は変更中の予約自身 */
const assertSlotBookable = async (tx: Sql, date: string, slot: TimeSlot, excludeId?: string) => {
  const closure = await tx`select reason from public.shop_closures where date = ${date}::date`;
  if (closure[0]) throw new ToolError(`${formatMdWithWeekday(date)} は休業日です${closure[0].reason ? `（${closure[0].reason}）` : ""}`);

  const dailyRows = await tx`select date::text, time_slot::text, is_active from public.daily_time_slots where date = ${date}::date`;
  if (!applicableSlotsForDate(date, dailyRows).includes(slot)) {
    throw new ToolError(`${formatMdWithWeekday(date)} の${SLOT_LABELS[slot]}枠はおやすみです（開けるには管理画面の時間枠設定から）`);
  }

  const taken = await tx`
    select reservation_code, guest_name from public.reservations
    where date = ${date}::date and time_slot = ${slot}::public.time_slot
      and (status in ('confirmed', 'pending') or (status = 'pending_payment' and expires_at > now()))
      ${excludeId ? tx`and id <> ${excludeId}::uuid` : tx``}
    limit 1
  `;
  if (taken[0]) {
    throw new ToolError(`${formatMdWithWeekday(date)} の${SLOT_LABELS[slot]}枠には予約があります（${taken[0].reservation_code} ${taken[0].guest_name}様）`);
  }
};

interface OptionRow {
  id: string;
  name: string;
  pricing_type: string;
  price_per_person: number;
  flat_price: number | null;
}

interface PricedOption {
  option_id: string;
  name: string;
  quantity: number;
  total_price: number;
}

/** 料金(予約フォーム・create-reservation と同じ計算。事前決済割引はない現地払い) */
const priceFor = async (tx: Sql, guestCount: number, options: { option: OptionRow; quantity: number }[]) => {
  const rows = await tx`select price_per_person from public.price_settings where guest_count = ${guestCount}`;
  if (!rows[0]) throw new ToolError(`${guestCount}名の料金が設定されていません（管理画面の料金設定を確認してください）`);
  const base = Number(rows[0].price_per_person) * guestCount;
  const priced: PricedOption[] = options.map(({ option, quantity }) => {
    const effective = option.pricing_type === "per_guest" ? guestCount : quantity;
    const total = option.pricing_type === "flat" ? Number(option.flat_price ?? 0) : Number(option.price_per_person) * effective;
    return { option_id: option.id, name: option.name, quantity: option.pricing_type === "flat" ? 1 : effective, total_price: total };
  });
  return { base, options: priced, total: base + priced.reduce((sum, o) => sum + o.total_price, 0) };
};

// --- 作成 ---

// 型エイリアスにしているのは、AgentTool[] にまとめるとき Record<string, unknown> として扱えるようにするため
type CreateInput = {
  date: string;
  time_slot: TimeSlot;
  guest_count: number;
  guest_name: string;
  phone: string;
  email?: string;
  options?: { name: string; quantity?: number }[];
  herb_choice: "consult" | "recommended";
  memo?: string;
};

const createReservation: AgentTool<CreateInput> = {
  name: "create_reservation",
  title: "予約を入れる(電話・DM)",
  description:
    "電話・DMで受けた貸切予約を、確定・現地払いで登録します(管理画面の「新規予約」と同じ)。お客様への通知は送りません。" +
    "休業日・おやすみの枠・すでに予約がある枠には入れられません。先に get_availability で空きを確かめてください。" +
    "ハーブは既定で「当日相談」、おすすめにする場合は herb_choice=recommended。",
  inputSchema: {
    type: "object",
    properties: {
      date: dateSchema("利用日"),
      time_slot: TIME_SLOT_SCHEMA,
      guest_count: { type: "integer", minimum: 1, maximum: 6 },
      guest_name: { type: "string", minLength: 1, maxLength: 100, description: "お名前(様は付けない)" },
      phone: { type: "string", pattern: PHONE_PATTERN, description: "電話番号" },
      email: { type: "string", maxLength: 200 },
      options: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "オプション名(get_prices の名前)" },
            quantity: { type: "integer", minimum: 1, maximum: 6 },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      herb_choice: { type: "string", enum: ["consult", "recommended"], default: "consult" },
      memo: { type: "string", maxLength: 1000, description: "店舗用メモ(任意)" },
    },
    required: ["date", "time_slot", "guest_count", "guest_name", "phone"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "write",
  async run(ctx, input) {
    if (input.date < ctx.todayYmd) throw new ToolError("過去の日付には予約を入れられません");
    const phone = normalizePhone(input.phone);
    if (phone.length < 10 || phone.length > 11) throw new ToolError("電話番号は10〜11桁で入れてください");

    // おすすめのハーブは予約時点の内容をスナップショットにする(関数は postgres ロールでのみ実行できる)
    const herbSelection = input.herb_choice === "recommended"
      ? (await ctx.sql`select public.build_herb_selection('recommended', null::jsonb) as s`.catch(() => {
        throw new ToolError("おすすめのブレンドが今は選べません（在庫切れ）\u3000当日相談で入れてください");
      }))[0].s
      : null;

    const created = await ctx.sql.begin(async (tx: Sql) => {
      await acquireSlotLock(tx, input.date, input.time_slot);
      await assertSlotBookable(tx, input.date, input.time_slot);

      const names = (input.options ?? []).map((o) => o.name.trim());
      const optionRows: OptionRow[] = names.length
        ? await tx`select id::text, name, pricing_type::text, price_per_person, flat_price from public.options where is_active and name in ${tx(names)}`
        : [];
      const selected = (input.options ?? []).map((o) => {
        const option = optionRows.find((r) => r.name === o.name.trim());
        if (!option) throw new ToolError(`オプション「${o.name}」は使えません`);
        return { option, quantity: o.quantity ?? 1 };
      });
      const price = await priceFor(tx, input.guest_count, selected);

      const rows = await tx`
        insert into public.reservations (
          date, time_slot, guest_name, guest_count, email, phone, water_temperature,
          status, is_confirmed, total_price, payment_method,
          herb_choice, herb_selection, herb_updated_at, herb_updated_by,
          admin_memo, admin_memo_updated_at, admin_memo_updated_by
        ) values (
          ${input.date}::date, ${input.time_slot}::public.time_slot, ${input.guest_name.trim()}, ${input.guest_count},
          ${input.email?.trim() || null}, ${phone}, 15,
          'confirmed', true, ${price.total}, 'onsite',
          ${input.herb_choice}, ${herbSelection === null ? null : ctx.sql.json(herbSelection)}::jsonb, now(), 'staff',
          ${input.memo?.trim() || null}, ${input.memo?.trim() ? tx`now()` : null}, ${input.memo?.trim() ? ctx.caller.userId : null}::uuid
        )
        returning id::text, reservation_code, date::text, start_time::text, end_time::text, guest_name, guest_count, total_price
      `;
      // 本番はトリガーが予約コードを付ける。トリガーの無い環境(ステージング)でもコードが付くようにする
      if (!rows[0].reservation_code) {
        const coded = await tx`
          update public.reservations set reservation_code = public.generate_reservation_code()
          where id = ${rows[0].id}::uuid returning reservation_code
        `;
        rows[0].reservation_code = coded[0].reservation_code;
      }
      for (const o of price.options) {
        await tx`
          insert into public.reservation_options (reservation_id, option_id, quantity, total_price)
          values (${rows[0].id}::uuid, ${o.option_id}::uuid, ${o.quantity}, ${o.total_price})
        `;
      }
      return { ...rows[0], options: price.options };
    });

    return {
      text: `予約を入れました: ${created.reservation_code} ${formatMdWithWeekday(created.date)} ${formatReservationTime(created)} ${created.guest_name}様 ${created.guest_count}名 ${yen(created.total_price)}（現地払い・確定）` +
        `${created.options.length ? `\nオプション: ${created.options.map((o: PricedOption) => `${o.name} ${yen(o.total_price)}`).join("、")}` : ""}` +
        "\nお客様への通知は送っていません",
      data: created,
    };
  },
};

// --- 変更 ---

type UpdateInput = {
  reservation_code: string;
  date?: string;
  time_slot?: TimeSlot;
  guest_count?: number;
  guest_name?: string;
  phone?: string;
  email?: string;
  notify_customer: boolean;
};

interface UpdatePlan {
  current: ReservationListRow & { id: string };
  changes: string[];
  set: Record<string, unknown>;
  newPrice: { total: number; options: (PricedOption & { id: string })[] } | null;
  notify: boolean;
}

const planUpdate = async (tx: Sql, ctx: AgentContext, input: UpdateInput): Promise<UpdatePlan> => {
  const rows = await tx`
    select id::text, reservation_code, date::text, start_time::text, end_time::text, time_slot::text, guest_name, guest_count,
           phone, email, status, total_price, payment_method, payment_status, herb_choice, herb_selection, admin_memo
    from public.reservations where reservation_code = ${input.reservation_code.toUpperCase()} limit 1
  `;
  const current = rows[0];
  if (!current) throw new ToolError(`予約コード ${input.reservation_code.toUpperCase()} の予約が見つかりません`);
  if (current.status === "cancelled" || current.status === "expired") throw new ToolError("キャンセル・失効した予約は変更できません");

  const date = input.date ?? current.date;
  const slot = (input.time_slot ?? current.time_slot) as TimeSlot;
  const changes: string[] = [];
  const set: Record<string, unknown> = {};

  if (date !== current.date || slot !== current.time_slot) {
    if (date < ctx.todayYmd) throw new ToolError("過去の日付には変更できません");
    await assertSlotBookable(tx, date, slot, current.id);
    set.date = date;
    set.time_slot = slot;
    changes.push(`日時: ${formatMdWithWeekday(current.date)} ${SLOT_LABELS[current.time_slot as TimeSlot]} → ${formatMdWithWeekday(date)} ${SLOT_LABELS[slot]}`);
  }

  let newPrice: UpdatePlan["newPrice"] = null;
  if (input.guest_count !== undefined && input.guest_count !== current.guest_count) {
    if (current.payment_status === "paid") {
      throw new ToolError("事前決済済みの予約は人数(料金)を変えられません\u3000管理画面とSquareで対応してください");
    }
    const optionRows = await tx`
      select ro.id::text, o.id::text as option_id, o.name, o.pricing_type::text, o.price_per_person, o.flat_price, ro.quantity
      from public.reservation_options ro join public.options o on o.id = ro.option_id
      where ro.reservation_id = ${current.id}::uuid
    `;
    const price = await priceFor(
      tx,
      input.guest_count,
      optionRows.map((r: OptionRow & { option_id: string; quantity: number }) => ({ option: { ...r, id: r.option_id }, quantity: r.quantity })),
    );
    newPrice = { total: price.total, options: price.options.map((o, i) => ({ ...o, id: optionRows[i].id })) };
    set.guest_count = input.guest_count;
    set.total_price = price.total;
    changes.push(`人数: ${current.guest_count}名 → ${input.guest_count}名（料金 ${yen(current.total_price)} → ${yen(price.total)}）`);
  }

  const text = (key: "guest_name" | "email", label: string, value?: string) => {
    if (value === undefined) return;
    const next = value.trim() || null;
    if (next === (current[key] ?? null)) return;
    if (key === "guest_name" && !next) throw new ToolError("お名前は空にできません");
    set[key] = next;
    changes.push(`${label}: ${current[key] ?? "なし"} → ${next ?? "なし"}`);
  };
  text("guest_name", "お名前", input.guest_name);
  text("email", "メール", input.email);
  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone);
    if (phone.length < 10 || phone.length > 11) throw new ToolError("電話番号は10〜11桁で入れてください");
    if (phone !== normalizePhone(current.phone)) {
      set.phone = phone;
      changes.push(`電話: ${current.phone} → ${phone}`);
    }
  }
  if (changes.length === 0) throw new ToolError("変更点がありません");

  return { current, changes, set, newPrice, notify: input.notify_customer && current.guest_name !== BLOCK_NAME };
};

const updateReservation: AgentTool<UpdateInput> = {
  name: "update_reservation",
  title: "予約を変更する",
  description:
    "予約の日時(日付・枠)・人数・お名前・電話・メールを変えます。日時を変えるときは休業日・おやすみの枠・ほかの予約を確かめ、" +
    "人数を変えると料金を計算し直します(事前決済済みの予約は人数を変えられません)。" +
    "管理画面と同じく、お客様に「予約が更新されました」のSMS(とメール)が届きます(notify_customer=false で送らない)。",
  inputSchema: {
    type: "object",
    properties: {
      reservation_code: reservationCodeSchema,
      date: dateSchema("新しい利用日"),
      time_slot: TIME_SLOT_SCHEMA,
      guest_count: { type: "integer", minimum: 1, maximum: 6 },
      guest_name: { type: "string", maxLength: 100 },
      phone: { type: "string", pattern: PHONE_PATTERN },
      email: { type: "string", maxLength: 200, description: "空文字で消す" },
      notify_customer: { type: "boolean", default: true, description: "お客様に変更の通知を送るか" },
    },
    required: ["reservation_code"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "dangerous",
  async preview(ctx, input) {
    const plan: UpdatePlan = await ctx.sql.begin((tx: Sql) => planUpdate(tx, ctx, input));
    return [
      `予約 ${plan.current.reservation_code}（${formatMdWithWeekday(plan.current.date)} ${formatReservationTime(plan.current)} ${plan.current.guest_name}様）を次のとおり変更します`,
      ...plan.changes.map((c) => `・${c}`),
      plan.notify ? "お客様に「予約が更新されました」のSMS(とメール)が届きます" : "お客様への通知は送りません",
    ].join("\n");
  },
  async run(ctx, input) {
    const plan: UpdatePlan = await ctx.sql.begin(async (tx: Sql) => {
      // 確認のあとに状況が変わっていないか、ロックを取ってから確かめ直す
      const date = input.date ?? null;
      const slot = input.time_slot ?? null;
      if (date || slot) {
        const cur = await tx`select date::text, time_slot::text from public.reservations where reservation_code = ${input.reservation_code.toUpperCase()}`;
        if (cur[0]) await acquireSlotLock(tx, date ?? cur[0].date, slot ?? cur[0].time_slot);
      }
      const plan = await planUpdate(tx, ctx, input);
      await tx`update public.reservations set ${tx(plan.set)} where id = ${plan.current.id}::uuid`;
      for (const o of plan.newPrice?.options ?? []) {
        await tx`update public.reservation_options set quantity = ${o.quantity}, total_price = ${o.total_price} where id = ${o.id}::uuid`;
      }
      return plan;
    });

    if (plan.notify) {
      const code = plan.current.reservation_code;
      const message = `ご予約(予約コード: ${code})が更新されました。詳細は予約確認ページをご確認ください。`;
      const phone = (plan.set.phone as string | undefined) ?? plan.current.phone;
      const email = "email" in plan.set ? (plan.set.email as string | null) : plan.current.email;
      try {
        await sendSMS(toE164(phone), message);
      } catch (error) {
        console.error("update notice SMS error:", error);
      }
      if (email) {
        try {
          await sendEmail(email, "予約更新のお知らせ", message);
        } catch (error) {
          console.error("update notice email error:", error);
        }
      }
    }
    return {
      text: [`${plan.current.reservation_code} を変更しました`, ...plan.changes.map((c) => `・${c}`), plan.notify ? "お客様に通知を送りました" : "お客様への通知は送っていません"].join("\n"),
    };
  },
};

// --- キャンセル ---

const cancelReservation: AgentTool<{ reservation_code: string; notify_customer: boolean }> = {
  name: "cancel_reservation",
  title: "予約をキャンセルする",
  description:
    "予約をキャンセルします(管理画面のキャンセルと同じ処理)。事前決済済みなら Square で全額を返金し、決済手続き中なら支払いリンクを無効にします。" +
    "お客様にキャンセルのSMS(とメール)が届きます(notify_customer=false で送らない。返金があるときは送ることをおすすめします)。",
  inputSchema: {
    type: "object",
    properties: {
      reservation_code: reservationCodeSchema,
      notify_customer: { type: "boolean", default: true },
    },
    required: ["reservation_code"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "dangerous",
  async preview(ctx, { reservation_code, notify_customer }) {
    const r = await loadAdminCancelTarget(ctx.sql, { code: reservation_code.toUpperCase() });
    if (!r) throw new ToolError(`予約コード ${reservation_code.toUpperCase()} の予約が見つかりません`);
    if (r.status === "cancelled") throw new ToolError("この予約はすでにキャンセル済みです");
    if (r.status === "expired") throw new ToolError("この予約は失効しているため、キャンセルは不要です");
    const refund = r.payment_status === "paid" && r.payment_method === "square_online" && r.square_payment_id;
    return [
      `予約 ${r.reservation_code}（${formatMdWithWeekday(r.date)} ${SLOT_LABELS[r.time_slot as TimeSlot] ?? r.time_slot} ${r.guest_name}様 ${r.guest_count}名）をキャンセルします`,
      refund ? `Square で ${yen(r.total_price)} を全額返金します（決済手数料は戻りません）` : r.status === "pending_payment" ? "事前決済の支払いリンクを無効にします" : "返金はありません（未払い）",
      notify_customer && r.guest_name !== BLOCK_NAME ? "お客様にキャンセルのSMS(とメール)が届きます" : "お客様への通知は送りません",
    ].join("\n");
  },
  async run(ctx, { reservation_code, notify_customer }) {
    const r = await loadAdminCancelTarget(ctx.sql, { code: reservation_code.toUpperCase() });
    if (!r) throw new ToolError(`予約コード ${reservation_code.toUpperCase()} の予約が見つかりません`);
    const result = await adminCancelReservation(ctx.sql, r, { notifyCustomer: notify_customer && r.guest_name !== BLOCK_NAME });
    if (!result.ok) throw new ToolError(result.error);
    return {
      text: `${r.reservation_code}（${r.guest_name}様）をキャンセルしました${result.refunded ? `\u3000${yen(r.total_price)} を返金しました` : ""}`,
    };
  },
};

export const reservationTools: AgentTool[] = [
  listReservations,
  getReservation,
  setReservationMemo,
  createReservation,
  updateReservation,
  cancelReservation,
];
