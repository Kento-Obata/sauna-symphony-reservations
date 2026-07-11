// イベント予約の照会（確定メール内リンクの access_token で認証）。
// 予約詳細ページ /events/reservation/:code?t=... から呼ばれる。
// access_token・square_* の内部IDはレスポンスから除去する。
//
// バックストップ: verifyPayment=true かつ決済待ち(pending_payment)の場合、
// Square に注文状態を直接照会し、支払い完了していれば webhook と同じ確定処理を行う。
// Webhook の未登録・遅延・失敗があっても、決済後のポーリングで自己修復できる。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { getClientIp, isRateLimited, recordAttempt } from "../_shared/rate-limit.ts";
import { retrieveOrder } from "../_shared/square.ts";
import {
  buildEventConfirmationEmail,
  confirmEventPaymentByOrderId,
} from "../_shared/event-payment.ts";
import { formatJstDateLabel, formatTimeRange } from "../_shared/event-format.ts";
import { sendAppEmail } from "../_shared/lovable-email.ts";
import { sendLineGroupMessage } from "../_shared/line.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION = "event-lookup";
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

const SELECT_RESERVATION = (sql: ReturnType<typeof getDb>, reservationCode: string) => sql`
  select r.id::text, r.guest_name, r.guest_count, r.email, r.phone, r.status,
         r.reservation_code, r.total_price, r.payment_status, r.payment_method,
         r.expires_at, r.created_at, r.cancelled_at, r.access_token, r.square_order_id,
         s.date::text, s.start_time::text, s.end_time::text,
         e.title as event_title, e.slug as event_slug, e.venue as event_venue,
         e.price_note, e.payment_type
  from public.event_reservations r
  join public.event_slots s on s.id = r.slot_id
  join public.events e on e.id = s.event_id
  where r.reservation_code = ${reservationCode}
  limit 1
`;

const handler = async (req: Request): Promise<Response> => {
  console.log("Get event reservation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const body = await req.json().catch(() => ({}));
    const { reservationCode, accessToken, verifyPayment } = body || {};

    if (typeof reservationCode !== 'string' || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
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

    let rows = await SELECT_RESERVATION(sql, reservationCode);
    let reservation = rows[0];

    const authRequired = () =>
      new Response(
        JSON.stringify({ error: "認証が必要です。メール内のリンクからアクセスしてください。" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );

    if (!reservation) {
      await recordAttempt(sql, ACTION, [ip], false);
      return authRequired();
    }

    if (
      typeof accessToken !== 'string' ||
      !safeEqual(accessToken, reservation.access_token)
    ) {
      await recordAttempt(sql, ACTION, [reservationCode, ip], false);
      return authRequired();
    }

    // バックストップ: 決済完了を Square に直接確認（webhook 不達時の自己修復）
    if (
      verifyPayment === true &&
      reservation.status === 'pending_payment' &&
      reservation.square_order_id
    ) {
      try {
        const order = await retrieveOrder(reservation.square_order_id);
        const paymentId = order.tenders[0]?.payment_id ?? order.tenders[0]?.id;
        if (order.state === 'COMPLETED' && paymentId) {
          const result = await confirmEventPaymentByOrderId(
            sql,
            reservation.square_order_id,
            paymentId,
          );
          if (result.outcome === 'confirmed') {
            const r = result.reservation;
            console.log("Payment confirmed via backstop:", r.reservation_code);
            const baseUrl = Deno.env.get('APP_BASE_URL') ?? "https://www.u-sauna-private.com";
            const detailUrl = `${baseUrl}/events/reservation/${r.reservation_code}?t=${r.access_token}`;
            try {
              const mail = buildEventConfirmationEmail({ reservation: r, detailUrl, paid: true });
              await sendAppEmail({
                to: r.email,
                subject: mail.subject,
                html: mail.html,
                text: mail.text,
                // webhook 側と同一キー: 両方走っても Resend が重複排除する
                idempotencyKey: `event-reservation-confirmed-${r.reservation_code}`,
                label: "event-reservation-confirmed",
              });
            } catch (error) {
              console.error("Confirmation email error:", error);
            }
            try {
              await sendLineGroupMessage(
                `【イベント予約】${r.event_title}\n${formatJstDateLabel(r.date)} ${formatTimeRange(r.start_time, r.end_time)}\n${r.guest_name} 様 ${r.guest_count}名（${r.reservation_code}・事前決済）`,
              );
            } catch (error) {
              console.error("LINE notification error:", error);
            }
          }
          // needs_refund は webhook 側に任せる（返金はここでは行わない）
          rows = await SELECT_RESERVATION(sql, reservationCode);
          reservation = rows[0];
        }
      } catch (error) {
        // 照会失敗は無視して現状のまま返す（ポーリングが再試行する）
        console.error("verifyPayment backstop error:", error);
      }
    }

    const {
      access_token: _omitToken,
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
      JSON.stringify({ error: "予約情報の取得に失敗しました" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
