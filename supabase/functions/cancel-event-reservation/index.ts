// イベント予約の自己キャンセル（確定メール内リンクの access_token で認証）。
//
// 物理削除はしない。status='cancelled' に更新すると残席集計（confirmed + 期限内
// pending_payment の合計）から自動的に外れ、席が解放される。
//
// 支払い済み（Square 事前決済）の場合は返金成功後にのみキャンセルへ更新する。
// 返金 API が失敗した場合、予約は confirmed のまま残り 500 を返す（電話案内）。
// 決済待ち（pending_payment）は日付によらずキャンセル可（金銭の授受が無いため）。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { getJstTodayYmd } from "../_shared/date-jst.ts";
import { getClientIp, isRateLimited, recordAttempt } from "../_shared/rate-limit.ts";
import { sendAppEmail } from "../_shared/lovable-email.ts";
import {
  buildEventCancellationEmail,
  cancelEventReservationRow,
} from "../_shared/event-payment.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION = "event-cancel";
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
  console.log("Cancel event reservation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const body = await req.json().catch(() => ({}));
    const { reservationCode, accessToken } = body || {};

    if (typeof reservationCode !== 'string' || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
      return new Response(
        JSON.stringify({ error: "予約コードの形式が正しくありません" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    if (typeof accessToken !== 'string' || !/^[0-9a-f]{64}$/.test(accessToken)) {
      return new Response(
        JSON.stringify({ error: "リンクが無効です。メール内のリンクからアクセスしてください。" }),
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

    const rows = await sql`
      select r.id::text, r.status, r.access_token, r.guest_name, r.guest_count, r.email,
             r.payment_status, r.payment_method, r.square_payment_id, r.square_payment_link_id,
             r.total_price, r.reservation_code,
             s.date::text, s.start_time::text, s.end_time::text,
             e.title as event_title
      from public.event_reservations r
      join public.event_slots s on s.id = r.slot_id
      join public.events e on e.id = s.event_id
      where r.reservation_code = ${reservationCode}
      limit 1
    `;
    const reservation = rows[0];

    if (!reservation) {
      await recordAttempt(sql, ACTION, [ip], false);
      return new Response(
        JSON.stringify({ error: "予約が見つかりませんでした" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (!safeEqual(accessToken, reservation.access_token)) {
      await recordAttempt(sql, ACTION, [reservationCode, ip], false);
      return new Response(
        JSON.stringify({ error: "リンクが無効です。メール内のリンクからアクセスしてください。" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    if (reservation.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: "この予約は既にキャンセル済みです" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    if (reservation.status === 'expired') {
      return new Response(
        JSON.stringify({ error: "この予約は無効になっています" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 決済待ちは金銭の授受が無いため日付によらずキャンセル可。確定済みは前日まで。
    if (reservation.status === 'confirmed') {
      const today = getJstTodayYmd();
      if (reservation.date === today) {
        return new Response(
          JSON.stringify({ error: "当日のキャンセルはできません。直接お電話にてご連絡ください。" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      if (reservation.date < today) {
        return new Response(
          JSON.stringify({ error: "開催日を過ぎた予約はキャンセルできません" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    let refunded = false;
    try {
      ({ refunded } = await cancelEventReservationRow(
        sql,
        reservation,
        "お客様都合によるキャンセル",
      ));
    } catch (error) {
      console.error("Refund error:", error);
      return new Response(
        JSON.stringify({ error: "返金処理に失敗しました。お手数ですがお電話にてご連絡ください。" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // キャンセル確認メール。失敗してもキャンセル自体は成立させる。
    try {
      const mail = buildEventCancellationEmail({
        guestName: reservation.guest_name,
        guestCount: reservation.guest_count,
        eventTitle: reservation.event_title,
        date: reservation.date,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        reservationCode,
        refunded,
      });
      await sendAppEmail({
        to: reservation.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        idempotencyKey: `event-reservation-cancelled-${reservationCode}`,
        label: "event-reservation-cancelled",
      });
    } catch (error) {
      console.error("Cancellation email error:", error);
    }

    return new Response(
      JSON.stringify({ success: true, refunded, message: "予約をキャンセルしました" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error('Error in cancel-event-reservation function:', error);
    return new Response(
      JSON.stringify({ error: "予約のキャンセル処理中にエラーが発生しました" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
