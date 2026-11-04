// シフトとシフト希望。シフトの追加・変更・削除は LINE bot のシフトコマンドと同じ処理(_shared/shift-service.ts)を使い、
// 変更はスタッフの LINE グループにも流す。自分のシフトは誰でも、ほかの人のシフトは管理者だけが操作できる。

import { addJstDays, formatMdWithWeekday } from "../../date-jst.ts";
import { pushLineMessage } from "../../line.ts";
import { formatShiftsForRange, type ShiftCommand } from "../../shift-bot.ts";
import { executeShiftCommand, type LineStaff, listShifts } from "../../shift-service.ts";
import { type AgentContext, type AgentTool, ToolError } from "../types.ts";
import { assertDateRange, dateSchema } from "./common.ts";

const TIME_PATTERN = "^([01]?\\d|2[0-3]):[0-5]\\d$";

const actorOf = (ctx: AgentContext): LineStaff => ({
  line_user_id: "",
  display_name: ctx.caller.name,
  staff_id: ctx.caller.userId,
  username: ctx.caller.name,
  role: ctx.caller.role,
});

/** 名前指定はほかの人を操作するときだけ。スタッフが自分以外を指定したら止める */
const staffNameFor = (ctx: AgentContext, staff?: string): string | null => {
  const name = staff?.trim();
  if (!name || name === ctx.caller.name) return null;
  if (ctx.caller.role !== "admin") throw new ToolError("ほかのスタッフのシフトを操作できるのは管理者だけです");
  return name;
};

const toHHMM = (t: string) => t.padStart(5, "0");

const runShiftCommand = async (ctx: AgentContext, cmd: ShiftCommand) => {
  const result = await executeShiftCommand(ctx.sql, cmd, actorOf(ctx), ctx.todayYmd);
  // ⚠ で始まる返事は実行されなかった(重なり・該当なし等)
  if (result.reply.startsWith("⚠")) throw new ToolError(result.reply.replace(/^⚠\s*/, ""));
  const groupId = Deno.env.get("STAFF_PUSH_GROUP_ID");
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  // スタッフグループの中で AI に頼んだときは、返事自体がグループに届くので二重に流さない
  const askedInPushGroup = !!groupId && ctx.caller.lineGroupId === groupId;
  if (result.notify && groupId && token && !askedInPushGroup) {
    try {
      const pushed = await pushLineMessage(groupId, result.notify, token);
      if (!pushed.ok) console.error("shift notify push failed:", pushed.status, pushed.body);
    } catch (error) {
      console.error("shift notify push error:", error);
    }
  }
  return { text: result.reply.replace(/^[✅🗑]\s*/u, "") };
};

const listShiftsTool: AgentTool<{ date_from: string; date_to?: string; staff?: string }> = {
  name: "list_shifts",
  title: "シフトを見る",
  description: "期間内のシフト(全員分。staff を指定するとその人だけ)を返します。1回で62日まで。",
  inputSchema: {
    type: "object",
    properties: {
      date_from: dateSchema("開始日"),
      date_to: dateSchema("終了日(省略すると開始日だけ)"),
      staff: { type: "string", description: "スタッフ名(省略で全員)" },
    },
    required: ["date_from"],
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx, { date_from, date_to, staff }) {
    const to = date_to ?? date_from;
    assertDateRange(date_from, to);
    let rows = await listShifts(ctx.sql, date_from, to);
    if (staff?.trim()) rows = rows.filter((r) => r.username.includes(staff.trim()));
    const label = date_from === to ? "この日" : "この期間";
    return { text: formatShiftsForRange(label, date_from, to, rows), data: rows };
  },
};

type ShiftInput = {
  date: string;
  start: string;
  end: string;
  break_minutes?: number;
  staff?: string;
};

const shiftTimeSchema = {
  type: "object" as const,
  properties: {
    date: dateSchema("シフトの日"),
    start: { type: "string" as const, pattern: TIME_PATTERN, description: "開始時刻 HH:MM(日本時間)" },
    end: { type: "string" as const, pattern: TIME_PATTERN, description: "終了時刻 HH:MM" },
    break_minutes: { type: "integer" as const, minimum: 0, maximum: 240, description: "休憩(分)" },
    staff: { type: "string" as const, description: "ほかのスタッフのシフトのとき、その人の名前(管理者のみ)。自分のシフトなら省略" },
  },
  required: ["date", "start", "end"],
  additionalProperties: false,
};

const checkTimes = (ctx: AgentContext, { date, start, end }: ShiftInput) => {
  if (date < addJstDays(ctx.todayYmd, -1)) throw new ToolError("過去のシフトは変更できません(管理画面から操作してください)");
  if (toHHMM(end) <= toHHMM(start)) throw new ToolError("終了時刻は開始時刻より後にしてください");
};

const addShift: AgentTool<ShiftInput> = {
  name: "add_shift",
  title: "シフトを追加",
  description: "シフトを追加します。同じ人の時間が重なるシフトがあれば追加しません。変更はスタッフの LINE グループに通知されます。",
  inputSchema: shiftTimeSchema,
  roles: ["admin", "staff"],
  kind: "write",
  run(ctx, input) {
    checkTimes(ctx, input);
    return runShiftCommand(ctx, {
      kind: "add",
      date: input.date,
      start: toHHMM(input.start),
      end: toHHMM(input.end),
      breakMinutes: input.break_minutes ?? null,
      staffName: staffNameFor(ctx, input.staff),
    });
  },
};

const updateShift: AgentTool<ShiftInput> = {
  name: "update_shift",
  title: "シフトの時間を変える",
  description: "その日のシフト(1人1日1件のとき)の時間を変えます。変更はスタッフの LINE グループに通知されます。",
  inputSchema: shiftTimeSchema,
  roles: ["admin", "staff"],
  kind: "write",
  run(ctx, input) {
    checkTimes(ctx, input);
    return runShiftCommand(ctx, {
      kind: "update",
      date: input.date,
      start: toHHMM(input.start),
      end: toHHMM(input.end),
      breakMinutes: input.break_minutes ?? null,
      staffName: staffNameFor(ctx, input.staff),
    });
  },
};

const cancelShift: AgentTool<{ date: string; staff?: string }> = {
  name: "cancel_shift",
  title: "シフトを取り消す",
  description: "その日のシフト(1人1日1件のとき)を取り消します。変更はスタッフの LINE グループに通知されます。",
  inputSchema: {
    type: "object",
    properties: {
      date: dateSchema("取り消すシフトの日"),
      staff: { type: "string", description: "ほかのスタッフのとき、その人の名前(管理者のみ)" },
    },
    required: ["date"],
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "write",
  run(ctx, { date, staff }) {
    if (date < addJstDays(ctx.todayYmd, -1)) throw new ToolError("過去のシフトは取り消せません(管理画面から操作してください)");
    return runShiftCommand(ctx, { kind: "delete", date, staffName: staffNameFor(ctx, staff) });
  },
};

// --- シフト希望(シフト希望ページと同じ枠) ---

const PREF_SLOTS: Record<string, string> = { morning: "午前(8:30-13:30)", afternoon: "午後(12:30-17:00)", evening: "夜(16:00-20:30)" };

const listShiftPreferences: AgentTool<{ date_from: string; date_to: string }> = {
  name: "list_shift_preferences",
  title: "シフト希望を見る",
  description: "スタッフが出したシフト希望(入れる/入れない)を期間で返します。スタッフは自分の分だけ。",
  inputSchema: {
    type: "object",
    properties: { date_from: dateSchema("開始日"), date_to: dateSchema("終了日") },
    required: ["date_from", "date_to"],
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx, { date_from, date_to }) {
    assertDateRange(date_from, date_to);
    const mine = ctx.caller.role !== "admin";
    const rows = await ctx.sql`
      select sp.date::text, sp.time_slot, sp.preference::text, p.username
      from public.shift_preferences sp join public.profiles p on p.id = sp.staff_id
      where sp.date between ${date_from}::date and ${date_to}::date
        ${mine ? ctx.sql`and sp.staff_id = ${ctx.caller.userId}::uuid` : ctx.sql``}
      order by sp.date, p.username, sp.time_slot
    `;
    const lines = rows.map((r: { date: string; time_slot: string; preference: string; username: string }) =>
      `${formatMdWithWeekday(r.date)} ${r.username} ${PREF_SLOTS[r.time_slot] ?? r.time_slot}: ${r.preference === "available" ? "入れる" : "入れない"}`
    );
    return { text: lines.length ? lines.join("\n") : "期間内のシフト希望はありません", data: rows };
  },
};

const setShiftPreference: AgentTool<{ date: string; time_slot: string; available: boolean; staff?: string }> = {
  name: "set_shift_preference",
  title: "シフト希望を出す",
  description: "シフト希望(その日のその時間帯に入れる/入れない)を出します。スタッフは自分の分だけ、管理者は staff で代わりに出せます。",
  inputSchema: {
    type: "object",
    properties: {
      date: dateSchema("日付"),
      time_slot: { type: "string", enum: ["morning", "afternoon", "evening"], description: "morning=午前(8:30-13:30) / afternoon=午後(12:30-17:00) / evening=夜(16:00-20:30)" },
      available: { type: "boolean", description: "true=入れる / false=入れない" },
      staff: { type: "string", description: "代わりに出すスタッフの名前(管理者のみ)" },
    },
    required: ["date", "time_slot", "available"],
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "write",
  async run(ctx, { date, time_slot, available, staff }) {
    if (date < ctx.todayYmd) throw new ToolError("過去の日付には希望を出せません");
    let staffId = ctx.caller.userId;
    let staffLabel = ctx.caller.name;
    const name = staffNameFor(ctx, staff);
    if (name) {
      const found = await ctx.sql`select id::text, username from public.profiles where role in ('admin', 'staff') and username = ${name}`;
      if (!found[0]) throw new ToolError(`スタッフ「${name}」が見つかりません`);
      staffId = found[0].id;
      staffLabel = found[0].username;
    }
    await ctx.sql`
      insert into public.shift_preferences (staff_id, date, time_slot, preference)
      values (${staffId}::uuid, ${date}::date, ${time_slot}, ${available ? "available" : "unavailable"})
      on conflict (staff_id, date, time_slot) do update set preference = excluded.preference, updated_at = now()
    `;
    return { text: `${staffLabel} の ${formatMdWithWeekday(date)} ${PREF_SLOTS[time_slot]} を「${available ? "入れる" : "入れない"}」にしました` };
  },
};

export const shiftTools: AgentTool[] = [listShiftsTool, addShift, updateShift, cancelShift, listShiftPreferences, setShiftPreference];
