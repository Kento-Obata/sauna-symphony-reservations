import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { getClientIp, isRateLimited, recordAttempt } from "../_shared/rate-limit.ts";
import { retrieveOrder } from "../_shared/square.ts";
import {
  confirmReservationPaymentByOrderId,
  notifyReservationConfirmed,
} from "../_shared/reservation-payment.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION = "lookup";
const CODE_MAX = 5;   // failed attempts per reservation code
const IP_MAX = 20;    // failed attempts per IP
const WINDOW_MIN = 15;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Get reservation by code function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const body = await req.json().catch(() => ({}));
    const { reservationCode, accessToken, phoneLastFourDigits, verifyPayment } = body || {};

    if (typeof reservationCode !== "string" || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
      return new Response(
        JSON.stringify({ error: "予約コードが必要です" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const ip = getClientIp(req);
    if (await isRateLimited(sql, [
      { action: ACTION, identifier: reservationCode, max: CODE_MAX, windowMinutes: WINDOW_MIN },
      { action: ACTION, identifier: ip, max: IP_MAX, windowMinutes: WINDOW_MIN },
    ])) {
      return new Response(
        JSON.stringify({ error: "試行回数が多すぎます。しばらく時間をおいて再度お試しください。" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Note: confirmation_token and admin_memo* are intentionally NOT selected.
    // This is a customer-facing endpoint; those fields are internal/sensitive and
    // are never consumed by the customer UI. access_token is selected only for the
    // auth comparison below and is stripped from the response.
    const selectReservation = () => sql`
      select id::text, date::text, time_slot::text, guest_name, guest_count, email, phone, water_temperature,
             created_at, reservation_code, status, is_confirmed, expires_at, total_price, access_token,
             payment_method, payment_status, square_order_id
      from public.reservations
      where reservation_code = ${reservationCode}
      limit 1
    `;
    let rows = await selectReservation();
    let reservation = rows[0];

    const authRequired = () =>
      new Response(
        JSON.stringify({ error: "認証が必要です", requiresAuth: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );

    if (!reservation) {
      await recordAttempt(sql, ACTION, [ip], false);
      return authRequired();
    }

    let authorized = false;

    if (accessToken && typeof accessToken === "string" && reservation.access_token) {
      if (safeEqual(accessToken, reservation.access_token)) authorized = true;
    }

    if (!authorized && phoneLastFourDigits && typeof phoneLastFourDigits === "string") {
      const digits = phoneLastFourDigits.replace(/\D/g, "");
      const phoneDigits = (reservation.phone || "").replace(/\D/g, "");
      const last4 = phoneDigits.slice(-4);
      if (digits.length === 4 && last4.length === 4 && safeEqual(digits, last4)) authorized = true;
    }

    if (!authorized) {
      console.log("Auth failed for reservation:", reservation.id);
      await recordAttempt(sql, ACTION, [reservationCode, ip], false);
      return authRequired();
    }

    // バックストップ: 決済完了を Square に直接確認(webhook 不達時の自己修復)。
    // 決済ページから戻った直後のポーリング(verifyPayment=true)でのみ実行する
    if (
      verifyPayment === true &&
      reservation.status === 'pending_payment' &&
      reservation.square_order_id
    ) {
      try {
        const order = await retrieveOrder(reservation.square_order_id);
        const paymentId = order.tenders[0]?.payment_id ?? order.tenders[0]?.id;
        if (order.state === 'COMPLETED' && paymentId) {
          const result = await confirmReservationPaymentByOrderId(
            sql,
            reservation.square_order_id,
            paymentId,
          );
          if (result.outcome === 'confirmed') {
            console.log("Reservation payment confirmed via backstop:", reservation.reservation_code);
            try {
              await notifyReservationConfirmed(result.reservation);
            } catch (error) {
              console.error("Confirmation notification error:", error);
            }
          }
          // needs_refund は webhook 側に任せる(返金はここでは行わない)
          rows = await selectReservation();
          reservation = rows[0];
        }
      } catch (error) {
        console.error("verifyPayment backstop error:", error);
      }
    }

    const {
      access_token: _omit,
      square_order_id: _omitOrder,
      ...safeReservation
    } = reservation as Record<string, unknown>;

    return new Response(
      JSON.stringify({ reservation: safeReservation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error && error.message ? error.message : "予約情報の取得に失敗しました",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
