// 会話の最初に使う概要。日付の取り違えを防ぐため、今日(JST)の日付と曜日を必ず返す。

import { addJstDays, formatYmdWithWeekday } from "../../date-jst.ts";
import type { AgentTool } from "../types.ts";
import { BLOCK_NAME } from "./common.ts";

const ACTIVE_STATUSES = ["confirmed", "pending", "pending_payment"];

interface DayCount {
  date: string;
  reservations: number;
  guests: number;
}

const getOverview: AgentTool = {
  name: "get_overview",
  title: "今日の概要",
  description:
    "今日の日付(日本時間・曜日つき)と、今日・明日の予約の組数と人数を返します。" +
    "「今日」「明日」「来週」などの日付を決める前に、まずこれで今日の日付を確認してください。",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx) {
    const tomorrow = addJstDays(ctx.todayYmd, 1);
    const rows = await ctx.asUser<DayCount[]>((tx) => tx`
      select date::text as date, count(*)::int as reservations, coalesce(sum(guest_count), 0)::int as guests
      from public.reservations
      where date in (${ctx.todayYmd}::date, ${tomorrow}::date)
        and status = any(${ACTIVE_STATUSES})
        and guest_name <> ${BLOCK_NAME}
      group by date
    `);
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const day = (ymd: string) => ({
      date: ymd,
      label: formatYmdWithWeekday(ymd),
      reservations: byDate.get(ymd)?.reservations ?? 0,
      guests: byDate.get(ymd)?.guests ?? 0,
    });
    const today = day(ctx.todayYmd);
    const next = day(tomorrow);
    return {
      text: `今日は ${today.label} です。予約は今日 ${today.reservations}組(${today.guests}名)、明日 ${next.reservations}組(${next.guests}名)`,
      data: { caller: { name: ctx.caller.name, role: ctx.caller.role }, today, tomorrow: next },
    };
  },
};

export const overviewTools: AgentTool[] = [getOverview];
