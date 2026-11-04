// 顧客・イベント・料金。顧客は予約の履歴(customer_search ビュー)から、電話番号ごとにまとめる。

import { formatMdWithWeekday } from "../../date-jst.ts";
import { toHHMM } from "../../reservation-time.ts";
import { type AgentTool, ToolError } from "../types.ts";
import { STATUS_LABELS } from "./common.ts";

const yen = (n: number) => `¥${Number(n).toLocaleString()}`;

interface CustomerRow {
  user_key: string;
  phone: string;
  guest_name: string;
  email: string | null;
  date: string;
  status: string;
  total_price: number;
  admin_memo: string | null;
}

const searchCustomers: AgentTool<{ query: string }> = {
  name: "search_customers",
  title: "お客様を探す",
  description:
    "お名前の一部か電話番号の一部(4桁以上)でお客様を探し、来店回数・最後の利用日・利用金額の合計・最近の予約を返します。",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string", minLength: 1, maxLength: 50 } },
    required: ["query"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "read",
  async run(ctx, { query }) {
    const q = query.trim();
    const digits = q.replace(/\D/g, "");
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await ctx.asUser((tx) => tx`
      select user_key, phone, guest_name, email, date::text, status, total_price, admin_memo
      from public.customer_search
      where guest_name ilike ${like}
        ${digits.length >= 4 ? tx`or regexp_replace(phone, '\\D', '', 'g') like ${`%${digits}%`}` : tx``}
      order by date desc
      limit 300
    `) as CustomerRow[];
    if (!rows.length) return { text: `「${q}」に当てはまるお客様はいません` };

    const byKey = new Map<string, CustomerRow[]>();
    for (const r of rows) byKey.set(r.user_key, [...(byKey.get(r.user_key) ?? []), r]);
    const customers = [...byKey.values()].slice(0, 20).map((list) => {
      // 来店 = 今日までの確定済みの予約。これからの予約は upcoming に分ける
      const visits = list.filter((r) => r.status === "confirmed" && r.date <= ctx.todayYmd);
      const upcoming = list.filter((r) => r.status === "confirmed" && r.date > ctx.todayYmd);
      return {
        name: list[0].guest_name,
        phone: list[0].phone,
        email: list.find((r) => r.email)?.email ?? null,
        visits: visits.length,
        last_date: visits[0]?.date ?? null,
        next_date: upcoming[upcoming.length - 1]?.date ?? null,
        total_spent: visits.reduce((sum, r) => sum + Number(r.total_price), 0),
        recent: list.slice(0, 5).map((r) => ({ date: r.date, status: r.status, total_price: r.total_price, memo: r.admin_memo })),
      };
    });
    return {
      text: customers.map((c) =>
        `${c.name}様 ${c.phone} 来店${c.visits}回${c.last_date ? `（最後 ${formatMdWithWeekday(c.last_date)}）` : ""} 合計${yen(c.total_spent)}${c.next_date ? ` 次回 ${formatMdWithWeekday(c.next_date)}` : ""}\n  ` +
        c.recent.map((r) => `${r.date} ${STATUS_LABELS[r.status] ?? r.status}`).join(" / ")
      ).join("\n"),
      data: customers,
    };
  },
};

const listEvents: AgentTool<{ include_past: boolean }> = {
  name: "list_events",
  title: "イベントの一覧",
  description: "パブリックイベントと各回(日時・定員・予約人数)を返します。既定は今日以降の回だけ。",
  inputSchema: {
    type: "object",
    properties: { include_past: { type: "boolean", default: false } },
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx, { include_past }) {
    const rows = await ctx.asUser((tx) => tx`
      select e.title, e.status, e.price_per_person, s.date::text, s.start_time::text, s.end_time::text, s.capacity, s.is_active,
             coalesce((
               select sum(r.guest_count) from public.event_reservations r
               where r.slot_id = s.id and (r.status = 'confirmed' or (r.status = 'pending_payment' and r.expires_at > now()))
             ), 0)::int as reserved
      from public.events e join public.event_slots s on s.event_id = e.id
      where ${include_past ? tx`true` : tx`s.date >= ${ctx.todayYmd}::date`}
      order by s.date, s.start_time
      limit 100
    `) as { title: string; status: string; price_per_person: number; date: string; start_time: string; end_time: string; capacity: number; is_active: boolean; reserved: number }[];
    return {
      text: rows.length
        ? rows.map((r) =>
          `${formatMdWithWeekday(r.date)} ${toHHMM(r.start_time)}-${toHHMM(r.end_time)} 「${r.title}」 ${r.reserved}/${r.capacity}名${r.is_active ? "" : "（受付停止中）"}${r.status !== "published" ? `（${r.status}）` : ""}`
        ).join("\n")
        : "予定のイベントはありません",
      data: rows,
    };
  },
};

const getPrices: AgentTool = {
  name: "get_prices",
  title: "料金とオプション",
  description: "人数ごとの1人あたり料金と、受付中のオプション(料金のかかり方つき)を返します。",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx) {
    const { prices, options } = await ctx.asUser(async (tx) => ({
      prices: await tx`select guest_count, price_per_person from public.price_settings order by guest_count`,
      options: await tx`select name, pricing_type::text, price_per_person, flat_price from public.options where is_active order by name`,
    }));
    const optionLabel = (o: { pricing_type: string; price_per_person: number; flat_price: number | null }) =>
      o.pricing_type === "flat" ? `1組${yen(o.flat_price ?? 0)}` : o.pricing_type === "per_guest" ? `人数分 1人${yen(o.price_per_person)}` : `1つ${yen(o.price_per_person)}`;
    return {
      text: [
        ...prices.map((p: { guest_count: number; price_per_person: number }) =>
          `${p.guest_count}名: 1人${yen(p.price_per_person)}（合計${yen(p.price_per_person * p.guest_count)}）`
        ),
        options.length ? `オプション: ${options.map((o: { name: string } & Parameters<typeof optionLabel>[0]) => `${o.name} ${optionLabel(o)}`).join("、")}` : "受付中のオプションはありません",
        "事前決済は5%引き",
      ].join("\n"),
      data: { prices, options },
    };
  },
};

const updatePrice: AgentTool<{ guest_count: number; price_per_person: number }> = {
  name: "update_price",
  title: "料金を変える",
  description: "人数ごとの1人あたり料金を変えます。これからの予約に使われ、すでにある予約の料金は変わりません。",
  inputSchema: {
    type: "object",
    properties: {
      guest_count: { type: "integer", minimum: 1, maximum: 6 },
      price_per_person: { type: "integer", minimum: 1000, maximum: 100000, description: "1人あたりの料金(円・税込)" },
    },
    required: ["guest_count", "price_per_person"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "dangerous",
  async preview(ctx, { guest_count, price_per_person }) {
    const rows = await ctx.asUser((tx) => tx`select price_per_person from public.price_settings where guest_count = ${guest_count}`) as { price_per_person: number }[];
    const before = rows[0]?.price_per_person;
    if (before === price_per_person) throw new ToolError(`${guest_count}名の料金はすでに1人${yen(price_per_person)}です`);
    return [
      `${guest_count}名の1人あたり料金を ${before === undefined ? "未設定" : yen(before)} → ${yen(price_per_person)} に変えます（合計 ${yen(price_per_person * guest_count)}）`,
      "これからの予約に使われます。すでにある予約の料金は変わりません",
    ].join("\n");
  },
  async run(ctx, { guest_count, price_per_person }) {
    await ctx.asUser(async (tx) => {
      const updated = await tx`update public.price_settings set price_per_person = ${price_per_person}, updated_at = now() where guest_count = ${guest_count} returning guest_count`;
      if (!updated.length) await tx`insert into public.price_settings (guest_count, price_per_person) values (${guest_count}, ${price_per_person})`;
    });
    return { text: `${guest_count}名の料金を1人${yen(price_per_person)}にしました` };
  },
};

export const businessTools: AgentTool[] = [searchCustomers, listEvents, getPrices, updatePrice];
