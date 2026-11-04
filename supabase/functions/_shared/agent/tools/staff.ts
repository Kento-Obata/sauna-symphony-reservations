// スタッフと給与。給与は管理画面の給与計算と同じ集計(monthly_salary_summary)に、作業ボーナスを添える。

import { type AgentTool, ToolError } from "../types.ts";

const yen = (n: number) => `¥${Math.round(Number(n)).toLocaleString()}`;

const listStaff: AgentTool = {
  name: "list_staff",
  title: "スタッフの一覧",
  description: "管理者・スタッフの名前、時給(平日/土日)、期間限定の時給、LINE の連携、作業記録用リンクの有無を返します。",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  roles: ["admin"],
  kind: "read",
  async run(ctx) {
    const rows = await ctx.sql`
      select p.id::text, p.username, p.role,
             hr.weekday_rate, hr.weekend_rate,
             (select json_agg(json_build_object('from', r.start_date, 'to', r.end_date, 'weekday', r.weekday_rate, 'weekend', r.weekend_rate) order by r.start_date)
              from public.staff_hourly_rate_periods r
              where r.staff_id = p.id and r.end_date >= (now() at time zone 'Asia/Tokyo')::date) as rate_periods,
             exists (select 1 from public.staff_line_users u where u.staff_id = p.id and u.is_active) as line_linked,
             exists (select 1 from public.staff_access_tokens t where t.staff_id = p.id) as work_link_issued
      from public.profiles p
      left join public.staff_hourly_rates hr on hr.staff_id = p.id
      where p.role in ('admin', 'staff') and p.username is not null
      order by p.role, p.username
    `;
    const lines = rows.map((r: {
      username: string;
      role: string;
      weekday_rate: number | null;
      weekend_rate: number | null;
      rate_periods: { from: string; to: string; weekday: number; weekend: number }[] | null;
      line_linked: boolean;
    }) => {
      const rate = `時給 平日${yen(r.weekday_rate ?? 1300)}・土日${yen(r.weekend_rate ?? 1450)}`;
      const periods = (r.rate_periods ?? []).map((p) => `${p.from}〜${p.to} は平日${yen(p.weekday)}・土日${yen(p.weekend)}`).join("、");
      return `${r.username}（${r.role === "admin" ? "管理者" : "スタッフ"}） ${rate}${periods ? `（${periods}）` : ""}${r.line_linked ? " LINE連携あり" : ""}`;
    });
    return { text: lines.join("\n"), data: rows };
  },
};

interface SalaryRow {
  staff_name: string;
  total_shifts: number;
  hours: number;
  salary: number;
}

const getSalarySummary: AgentTool<{ year: number; month: number }> = {
  name: "get_salary_summary",
  title: "月の給与と作業ボーナス",
  description:
    "指定した月のスタッフごとのシフト数・勤務時間・給与(管理画面の給与計算と同じ集計)と、作業ポイントのボーナスを返します。",
  inputSchema: {
    type: "object",
    properties: {
      year: { type: "integer", minimum: 2024, maximum: 2100 },
      month: { type: "integer", minimum: 1, maximum: 12 },
    },
    required: ["year", "month"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "read",
  async run(ctx, { year, month }) {
    const [salary, bonus] = await Promise.all([
      ctx.asUser<SalaryRow[]>((tx) => tx`
        select staff_name, total_shifts::int, round(total_work_hours::numeric, 2)::float as hours, round(total_salary::numeric)::int as salary
        from public.monthly_salary_summary
        where year = ${year} and month = ${month}
        order by staff_name
      `),
      ctx.sql`select staff_name, points::int, bonus_yen::int from public.work_bonus_summary_internal(${year}, ${month})`,
    ]);
    if (!salary.length && !bonus.length) throw new ToolError(`${year}年${month}月のシフトと作業記録はありません`);
    const names = [...new Set([...salary.map((s) => s.staff_name), ...bonus.map((b: { staff_name: string }) => b.staff_name)])];
    const lines = names.map((name) => {
      const s = salary.find((x) => x.staff_name === name);
      const b = bonus.find((x: { staff_name: string }) => x.staff_name === name);
      return `${name}: ${s ? `${s.total_shifts}回 ${s.hours}時間 ${yen(s.salary)}` : "シフトなし"}${b ? ` / 作業 ${b.points}pt ボーナス${yen(b.bonus_yen)}` : ""}`;
    });
    const total = salary.reduce((sum, s) => sum + s.salary, 0);
    return { text: [`${year}年${month}月`, ...lines, `給与合計 ${yen(total)}`].join("\n"), data: { salary, bonus } };
  },
};

export const staffTools: AgentTool[] = [listStaff, getSalarySummary];
