// ハーブ蒸し: ブレンドと在庫の確認、仕込みリスト、在庫・おすすめの変更、予約のハーブの入力。
// 検証とスナップショット作成は DB(build_herb_selection / admin_set_reservation_herbs)に任せる。

import { formatMdWithWeekday } from "../../date-jst.ts";
import { formatHerbStaffLine, HERB_CHOICE_LABELS, type HerbChoice, herbErrorMessage } from "../../herb.ts";
import { toHHMM } from "../../reservation-time.ts";
import { type AgentTool, type Sql, ToolError } from "../types.ts";
import { ACTIVE_STATUSES, dateSchema, findReservationByCode, reservationCodeSchema, reservationLabel } from "./common.ts";

interface HerbRow {
  id: string;
  name: string;
  note: string;
  active: boolean;
}

interface BlendRow {
  id: string;
  code: string;
  title: string;
  is_original: boolean;
  needs_prep: boolean;
  active: boolean;
  available: boolean;
  herbs: { name: string; note: string }[];
}

const NOTE_LABELS: Record<string, string> = { top: "TOP", middle: "MIDDLE", base: "BASE" };

const loadHerbs = (tx: Sql): Promise<HerbRow[]> => tx`
  select id::text, name, note, active
  from public.herbs
  order by case note when 'top' then 0 when 'middle' then 1 else 2 end, sort_order, name
`;

const loadBlends = (tx: Sql): Promise<BlendRow[]> => tx`
  select b.id::text, b.code, b.title, b.is_original, b.needs_prep, b.active,
         b.active and (
           case when b.is_original then exists (select 1 from public.herbs h where h.active)
                else not exists (
                  select 1 from public.herb_blend_herbs bh join public.herbs h on h.id = bh.herb_id
                  where bh.blend_id = b.id and not h.active
                ) end
         ) as available,
         coalesce((
           select jsonb_agg(jsonb_build_object('name', h.name, 'note', h.note) order by bh.sort_order, h.sort_order)
           from public.herb_blend_herbs bh join public.herbs h on h.id = bh.herb_id
           where bh.blend_id = b.id
         ), '[]'::jsonb) as herbs
  from public.herb_blends b
  order by b.sort_order, b.code
`;

const normalizeBlendCode = (code: string) => code.trim().padStart(2, "0");

const findBlend = (blends: BlendRow[], code: string) => {
  const blend = blends.find((b) => b.code === normalizeBlendCode(code));
  if (!blend) throw new ToolError(`ブレンド ${code} はありません（${blends.map((b) => b.code).join("・")} から選んでください）`);
  return blend;
};

const findHerb = (herbs: HerbRow[], name: string) => {
  const herb = herbs.find((h) => h.name === name.trim());
  if (!herb) throw new ToolError(`ハーブ「${name}」はありません（${herbs.map((h) => h.name).join("・")}）`);
  return herb;
};

/** DB の例外をお客様向けと同じ日本語に直す。該当しなければそのまま投げる */
const rethrowHerbError = (error: unknown): never => {
  const message = herbErrorMessage(error);
  if (message) throw new ToolError(message.replace(/\u3000/g, " "));
  throw error;
};

const getHerbCatalog: AgentTool = {
  name: "get_herb_catalog",
  title: "ハーブとブレンドの一覧",
  description:
    "ハーブ蒸しのハーブ(在庫あり/切れ)、ブレンド01〜07の構成と選べるかどうか、今のおすすめの組み合わせを返します。",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx) {
    const { herbs, blends, recommended } = await ctx.asUser(async (tx) => {
      const settings = await tx`select recommended_tier1_blend_id::text as t1, recommended_tier2_blend_id::text as t2 from public.herb_settings where id`;
      return { herbs: await loadHerbs(tx), blends: await loadBlends(tx), recommended: settings[0] ?? null };
    });
    const byId = new Map(blends.map((b) => [b.id, b]));
    const rec1 = recommended?.t1 ? byId.get(recommended.t1) : undefined;
    const rec2 = recommended?.t2 ? byId.get(recommended.t2) : undefined;
    const out = herbs.filter((h) => !h.active).map((h) => h.name);
    return {
      text: [
        `おすすめ: ${rec1 ? `${rec1.code} ${rec1.title}` : "未設定"} ＋ ${rec2 ? `${rec2.code} ${rec2.title}` : "未設定"}`,
        out.length ? `在庫切れ: ${out.join("・")}` : "在庫切れのハーブはありません",
        ...blends.map((b) =>
          `${b.code} ${b.title}${b.is_original ? "（お客様が1〜3種を選ぶ）" : `（${b.herbs.map((h) => h.name).join("・")}）`}` +
          `${b.needs_prep ? " 仕込みあり" : ""}${b.available ? "" : " ※今は選べません"}`
        ),
      ].join("\n"),
      data: {
        herbs: herbs.map((h) => ({ name: h.name, note: NOTE_LABELS[h.note] ?? h.note, in_stock: h.active })),
        blends: blends.map((b) => ({
          code: b.code,
          title: b.title,
          herbs: b.herbs.map((h) => h.name),
          is_original: b.is_original,
          needs_prep: b.needs_prep,
          available: b.available,
        })),
        recommended: { tier1: rec1?.code ?? null, tier2: rec2?.code ?? null },
      },
    };
  },
};

interface PrepRow {
  reservation_code: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  guest_name: string;
  guest_count: number;
  status: string;
  herb_choice: string | null;
  herb_selection: { tiers?: { code: string; title: string; needs_prep: boolean }[] } | null;
  out_of_stock: boolean;
}

const getHerbPrepList: AgentTool<{ date: string }> = {
  name: "get_herb_prep_list",
  title: "ハーブの仕込みリスト",
  description:
    "指定した日の予約ごとのハーブ蒸しの内容(1段目・2段目)と、ブレンドごとの数をまとめます。" +
    "仕込みが要るもの(06・07)、受付で相談するもの、在庫切れで入れ替えが要るものに印を付けます。",
  inputSchema: {
    type: "object",
    properties: { date: dateSchema("対象の日付") },
    required: ["date"],
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "read",
  async run(ctx, { date }) {
    const rows = await ctx.asUser<PrepRow[]>((tx) => tx`
      select r.reservation_code, r.date::text, r.start_time::text, r.end_time::text, r.guest_name, r.guest_count,
             r.status, r.herb_choice, r.herb_selection,
             exists (select 1 from public.herb_affected_reservations a where a.id = r.id) as out_of_stock
      from public.reservations r
      where r.date = ${date}::date and r.status = any(${ACTIVE_STATUSES})
      order by r.start_time nulls last, r.created_at
    `);
    const counts = new Map<string, number>();
    const lines = rows.map((r) => {
      for (const t of r.herb_selection?.tiers ?? []) {
        const key = `${t.code} ${t.title}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const herb = formatHerbStaffLine(r.herb_choice, r.herb_selection)?.replace(/^🌿 /, "") ?? "導入前の予約（未設定）";
      const flags = [r.status !== "confirmed" ? "未確定" : "", r.out_of_stock ? "⚠在庫切れを含む" : ""].filter(Boolean);
      return `${toHHMM(r.start_time)} ${r.guest_name}様 ${r.guest_count}名: ${herb}${flags.length ? `（${flags.join("・")}）` : ""}`;
    });
    const summary = [...counts.entries()].map(([k, n]) => `${k} ×${n}`).join(" / ");
    return {
      text: rows.length
        ? [`${formatMdWithWeekday(date)} のハーブ蒸し（${rows.length}組）`, ...lines, summary ? `集計: ${summary}` : ""]
          .filter(Boolean).join("\n")
        : `${formatMdWithWeekday(date)} の予約はありません`,
      data: rows.map((r) => ({
        code: r.reservation_code,
        start: toHHMM(r.start_time),
        guest_name: r.guest_name,
        guest_count: r.guest_count,
        status: r.status,
        herb_choice: r.herb_choice,
        tiers: (r.herb_selection?.tiers ?? []).map((t) => `${t.code} ${t.title}`),
        out_of_stock: r.out_of_stock,
      })),
    };
  },
};

interface AffectedRow {
  reservation_code: string;
  date: string;
  start_time: string | null;
  guest_name: string;
  guest_count: number;
  phone: string;
}

const setHerbStock: AgentTool<{ herb: string; in_stock: boolean }> = {
  name: "set_herb_stock",
  title: "ハーブの在庫を切り替える",
  description:
    "ハーブの在庫あり/切れを切り替えます。在庫切れにすると、そのハーブを含むブレンドはお客様が選べなくなります。" +
    "結果に、在庫切れのハーブを含む今後の予約(連絡先つき)を返すので、必要ならお客様への連絡を店に促してください。",
  inputSchema: {
    type: "object",
    properties: {
      herb: { type: "string", description: "ハーブの名前(get_herb_catalog の名前と同じ表記)" },
      in_stock: { type: "boolean", description: "true=在庫あり / false=在庫切れ" },
    },
    required: ["herb", "in_stock"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "write",
  async run(ctx, { herb, in_stock }) {
    const affected = await ctx.asUser<AffectedRow[]>(async (tx) => {
      const target = findHerb(await loadHerbs(tx), herb);
      await tx`update public.herbs set active = ${in_stock}, updated_at = now() where id = ${target.id}::uuid`;
      return await tx`
        select distinct reservation_code, date::text, start_time::text, guest_name, guest_count, phone
        from public.herb_affected_reservations
        order by date, start_time
      `;
    });
    const list = affected.map((r: AffectedRow) =>
      `${r.reservation_code} ${formatMdWithWeekday(r.date)} ${toHHMM(r.start_time)} ${r.guest_name}様 ${r.guest_count}名 ${r.phone}`
    );
    return {
      text: [
        `${herb.trim()} を${in_stock ? "在庫あり" : "在庫切れ"}にしました`,
        list.length ? `在庫切れのハーブを含む今後の予約（${list.length}件）:\n${list.join("\n")}` : "在庫切れのハーブを含む今後の予約はありません",
      ].join("\n"),
      data: { affected_reservations: affected },
    };
  },
};

const setHerbRecommendation: AgentTool<{ tier1: string; tier2: string }> = {
  name: "set_herb_recommendation",
  title: "おすすめの組み合わせを変える",
  description: "予約画面の「おすすめ」の1段目・2段目のブレンドを変えます(07 ORIGINAL は指定できません)。すでにある予約の内容は変わりません。",
  inputSchema: {
    type: "object",
    properties: {
      tier1: { type: "string", description: "1段目のブレンド番号(例: 01)" },
      tier2: { type: "string", description: "2段目のブレンド番号(例: 02)" },
    },
    required: ["tier1", "tier2"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "write",
  async run(ctx, { tier1, tier2 }) {
    const [b1, b2] = await ctx.asUser(async (tx) => {
      const blends = await loadBlends(tx);
      const picked = [findBlend(blends, tier1), findBlend(blends, tier2)];
      for (const b of picked) {
        if (b.is_original) throw new ToolError("ORIGINAL はおすすめにできません");
        if (!b.available) throw new ToolError(`${b.code} ${b.title} は今は選べないため、おすすめにできません`);
      }
      await tx`
        update public.herb_settings
        set recommended_tier1_blend_id = ${picked[0].id}::uuid, recommended_tier2_blend_id = ${picked[1].id}::uuid, updated_at = now()
        where id
      `;
      return picked;
    });
    return { text: `おすすめを ${b1.code} ${b1.title} ＋ ${b2.code} ${b2.title} にしました` };
  },
};

interface TierInput {
  tier: 1 | 2;
  blend: string;
  herbs?: string[];
}

const setReservationHerbs: AgentTool<{ reservation_code: string; choice: HerbChoice; tiers?: TierInput[] }> = {
  name: "set_reservation_herbs",
  title: "予約のハーブを入力・変更する",
  description:
    "予約のハーブ蒸しの選び方と内容を入力・変更します(受付での代理入力。締切はありません)。" +
    "choice=select は tiers に1段目・2段目の両方が必要。choice=recommended は今のおすすめの内容で保存。" +
    "choice=consult は当日相談のまま(受付で決まった内容があれば tiers に入れると確定内容として保存)。" +
    "07 ORIGINAL は herbs にハーブ名を1〜3種入れてください。",
  inputSchema: {
    type: "object",
    properties: {
      reservation_code: reservationCodeSchema,
      choice: { type: "string", enum: ["select", "recommended", "consult"], description: "select=事前に選ぶ / recommended=おすすめ / consult=当日相談" },
      tiers: {
        type: "array",
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            tier: { type: "integer", enum: [1, 2] },
            blend: { type: "string", description: "ブレンド番号(01〜07)" },
            herbs: { type: "array", maxItems: 3, items: { type: "string" }, description: "07 ORIGINAL のときだけ: ハーブ名" },
          },
          required: ["tier", "blend"],
          additionalProperties: false,
        },
      },
    },
    required: ["reservation_code", "choice"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "write",
  async run(ctx, { reservation_code, choice, tiers }) {
    const { reservation, saved } = await ctx.asUser(async (tx) => {
      const reservation = await findReservationByCode(tx, reservation_code);
      const [herbs, blends] = [await loadHerbs(tx), await loadBlends(tx)];
      const payload = (tiers ?? []).map((t) => {
        const blend = findBlend(blends, t.blend);
        return { tier: t.tier, blend_id: blend.id, herb_ids: blend.is_original ? (t.herbs ?? []).map((n) => findHerb(herbs, n).id) : [] };
      });
      try {
        const rows = await tx`
          select public.admin_set_reservation_herbs(${reservation.id}::uuid, ${choice}, ${ctx.sql.json(payload)}::jsonb) as saved
        `;
        return { reservation, saved: rows[0].saved };
      } catch (error) {
        return rethrowHerbError(error);
      }
    });
    // 戻り値は保存したスナップショット(当日相談で内容が未定なら null)
    const line = formatHerbStaffLine(choice, saved)?.replace(/^🌿 /, "") ?? HERB_CHOICE_LABELS[choice];
    return { text: `${reservation.reservation_code}（${reservationLabel(reservation)}）のハーブを「${line}」にしました` };
  },
};

export const herbTools: AgentTool[] = [getHerbCatalog, getHerbPrepList, setHerbStock, setHerbRecommendation, setReservationHerbs];
