// 管理者による貸切予約キャンセル。
//
// 管理画面から支払い済み(Square 事前決済)予約をキャンセルする際は、
// 直接の DB UPDATE では返金がスキップされるため必ずこの関数を経由する。
// (未払い予約の直接 UPDATE は従来どおり許容 — フロント側でルーティングする)
//
// 認証: verify_jwt=true + 関数内で profiles.role='admin' を検証(_shared/admin-auth.ts)。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { isValidUuid } from "../_shared/event-validation.ts";
import { adminCancelReservation, loadAdminCancelTarget } from "../_shared/admin-reservation-cancel.ts";

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

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const handler = async (req: Request): Promise<Response> => {
  console.log("Admin cancel reservation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const auth = await requireAdmin(req, sql);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const body = await req.json().catch(() => ({}));
    const { reservationId } = body || {};
    if (!isValidUuid(reservationId)) {
      return json({ error: "予約の指定が正しくありません" }, 400);
    }

    // 返金・お客様への通知まで含めて共通処理(AI エージェントの道具と同じ)
    const reservation = await loadAdminCancelTarget(sql, { id: reservationId });
    if (!reservation) {
      return json({ error: "予約が見つかりませんでした" }, 404);
    }
    const result = await adminCancelReservation(sql, reservation);
    if (!result.ok) {
      return json({ error: result.error }, result.status);
    }
    const { refunded } = result;

    return json({ success: true, refunded }, 200);
  } catch (error) {
    console.error('Error in admin-cancel-reservation function:', error);
    return json({ error: "キャンセル処理中にエラーが発生しました" }, 500);
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
