// 期限切れの決済待ち予約（pending_payment）を expired に遷移させ、
// Square の決済リンクを削除して遅延入金の窓を閉じる。
//
// 残席の正しさはこの関数に依存しない（集計は expires_at を時間条件で評価する）。
// この関数の役割は (1) 終端状態への遷移 (2) リンク削除で支払い自体を不能にする、の2点。
// 冪等かつ誰が呼んでも無害なため verify_jwt=false・認証なし。
//
// 本番では pg_cron + pg_net で5分毎に起動する（既存の send-pending-reminder と同形式）:
//   select cron.schedule('expire-event-holds', '*/5 * * * *', $$ select net.http_post(
//     url:='https://<ref>.supabase.co/functions/v1/expire-event-holds',
//     headers:='{"Content-Type": "application/json", "Authorization": "Bearer <anon key>"}'::jsonb) $$);
// ステージングには pg_cron/pg_net が無いため、検証時は curl で直接叩く。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { deletePaymentLink } from "../_shared/square.ts";

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
    const stale = await sql`
      update public.event_reservations
      set status = 'expired'
      where status = 'pending_payment'
        and expires_at < now()
      returning id::text, reservation_code, square_payment_link_id
    `;

    // リンク削除は best-effort。失敗しても expired 遷移は成立しており、
    // 万一その後に支払われても webhook の自動返金網が受ける。
    let linksDeleted = 0;
    for (const row of stale) {
      if (!row.square_payment_link_id) continue;
      try {
        await deletePaymentLink(row.square_payment_link_id);
        linksDeleted++;
      } catch (error) {
        console.error(`deletePaymentLink error (${row.reservation_code}):`, error);
      }
    }

    if (stale.length > 0) {
      console.log(`Expired ${stale.length} holds, deleted ${linksDeleted} links`);
    }
    return new Response(
      JSON.stringify({ expired: stale.length, linksDeleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("expire-event-holds error:", error);
    return new Response(
      JSON.stringify({ error: "failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
