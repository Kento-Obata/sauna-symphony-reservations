// 公開イベントの詳細 + 枠ごとの残席を返す（認証不要の公開読み取り）。
//
// event_reservations は RLS で公開アクセス不可のため、残席の集計は
// この edge function（直接 postgres 接続）経由でのみ公開する。
// 個人情報は一切返さない（confirmed の人数合計だけを使う）。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { isValidSlug } from "../_shared/event-validation.ts";
import { getJstTodayYmd } from "../_shared/date-jst.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const body = await req.json().catch(() => ({}));
    const { slug } = body || {};

    if (!isValidSlug(slug)) {
      return new Response(
        JSON.stringify({ error: "イベントの指定が正しくありません" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const eventRows = await sql`
      select id::text, slug, title, description, venue,
             price_per_person, price_note, max_guests_per_reservation
      from public.events
      where slug = ${slug}
        and status = 'published'
      limit 1
    `;
    const event = eventRows[0];

    if (!event) {
      return new Response(
        JSON.stringify({ error: "イベントが見つかりません" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const today = getJstTodayYmd();
    const slots = await sql`
      select s.id::text, s.date::text, s.start_time::text, s.end_time::text, s.capacity,
             greatest(s.capacity - coalesce(r.taken, 0), 0)::int as remaining
      from public.event_slots s
      left join (
        select slot_id, sum(guest_count)::int as taken
        from public.event_reservations
        where status = 'confirmed'
        group by slot_id
      ) r on r.slot_id = s.id
      where s.event_id = ${event.id}::uuid
        and s.is_active = true
        and s.date >= ${today}::date
      order by s.date, s.start_time
    `;

    return new Response(
      JSON.stringify({ event, slots }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "イベント情報の取得に失敗しました" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
