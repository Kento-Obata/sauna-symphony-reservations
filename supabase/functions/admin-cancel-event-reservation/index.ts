// 管理者によるイベント予約キャンセル。
//
// 管理画面のキャンセルは（未払い分も含め）すべてこの関数を経由する。
// 直接の DB UPDATE だと支払い済み予約の返金がスキップされてしまうため、
// 返金の要否判定を含む cancelEventReservationRow に一本化する。
//
// 認証: config.toml で verify_jwt=true にしているが、それだけでは anon key の
// JWT でも通ってしまう。必ず関数内で auth.getUser + profiles.role='admin' を検証する
// （このリポジトリで in-function の管理者チェックを行う最初の関数）。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { isValidUuid } from "../_shared/event-validation.ts";
import { sendAppEmail } from "../_shared/lovable-email.ts";
import {
  buildEventCancellationEmail,
  cancelEventReservationRow,
} from "../_shared/event-payment.ts";

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
  console.log("Admin cancel event reservation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    // ---- 管理者認証 ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!jwt || !supabaseUrl || !serviceKey) {
      return json({ error: "認証情報がありません" }, 401);
    }
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return json({ error: "認証に失敗しました" }, 401);
    }
    const roleRows = await sql`
      select role from public.profiles where id = ${userData.user.id}::uuid limit 1
    `;
    if (roleRows[0]?.role !== 'admin') {
      return json({ error: "管理者権限がありません" }, 403);
    }

    // ---- 入力 ----
    const body = await req.json().catch(() => ({}));
    const { reservationId } = body || {};
    if (!isValidUuid(reservationId)) {
      return json({ error: "予約の指定が正しくありません" }, 400);
    }

    const rows = await sql`
      select r.id::text, r.status, r.guest_name, r.guest_count, r.email,
             r.payment_status, r.payment_method, r.square_payment_id, r.square_payment_link_id,
             r.total_price, r.reservation_code,
             s.date::text, s.start_time::text, s.end_time::text,
             e.title as event_title
      from public.event_reservations r
      join public.event_slots s on s.id = r.slot_id
      join public.events e on e.id = s.event_id
      where r.id = ${reservationId}::uuid
      limit 1
    `;
    const reservation = rows[0];

    if (!reservation) {
      return json({ error: "予約が見つかりませんでした" }, 404);
    }
    if (reservation.status === 'cancelled') {
      return json({ error: "この予約は既にキャンセル済みです" }, 400);
    }
    if (reservation.status === 'expired') {
      return json({ error: "この予約は期限切れのため操作不要です" }, 400);
    }

    // 管理者キャンセルに日付制限は設けない（当日対応・過去分の整理を想定）
    let refunded = false;
    try {
      // 自己キャンセルと同じ idempotency key（event-cancel-<code>）を使うため、
      // 半端に失敗した自己キャンセルの後に管理者が実行しても二重返金にならない
      ({ refunded } = await cancelEventReservationRow(
        sql,
        reservation,
        "店舗都合・管理者操作によるキャンセル",
      ));
    } catch (error) {
      console.error("Refund error:", error);
      return json({ error: "返金処理に失敗しました。Square ダッシュボードをご確認ください。" }, 500);
    }

    try {
      const mail = buildEventCancellationEmail({
        guestName: reservation.guest_name,
        guestCount: reservation.guest_count,
        eventTitle: reservation.event_title,
        date: reservation.date,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        reservationCode: reservation.reservation_code,
        refunded,
      });
      await sendAppEmail({
        to: reservation.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        idempotencyKey: `event-reservation-cancelled-${reservation.reservation_code}`,
        label: "event-reservation-cancelled",
      });
    } catch (error) {
      console.error("Cancellation email error:", error);
    }

    return json({ success: true, refunded }, 200);
  } catch (error) {
    console.error('Error in admin-cancel-event-reservation function:', error);
    return json({ error: "キャンセル処理中にエラーが発生しました" }, 500);
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
