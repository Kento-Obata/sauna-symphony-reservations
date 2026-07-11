import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { getClientIp, isRateLimited, recordAttempt } from "../_shared/rate-limit.ts";
import { cancelReservationRow } from "../_shared/reservation-payment.ts";
import { sendLineGroupMessage } from "../_shared/line.ts";
import { getJstTodayYmd } from "../_shared/date-jst.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION = "cancel";
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    console.log("Cancel reservation function called");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: "リクエストが不正です" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { reservationCode, phoneLastFourDigits } = body as Record<string, unknown>;

    if (typeof reservationCode !== 'string' || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
      return new Response(
        JSON.stringify({ error: "予約コードの形式が正しくありません" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof phoneLastFourDigits !== 'string' || !/^\d{4}$/.test(phoneLastFourDigits)) {
      return new Response(
        JSON.stringify({ error: "電話番号は4桁の数字で入力してください" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ip = getClientIp(req);
    if (await isRateLimited(sql, [
      { action: ACTION, identifier: reservationCode, max: CODE_MAX, windowMinutes: WINDOW_MIN },
      { action: ACTION, identifier: ip, max: IP_MAX, windowMinutes: WINDOW_MIN },
    ])) {
      return new Response(
        JSON.stringify({ error: "試行回数が多すぎます。しばらく時間をおいて再度お試しください。" }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rows = await sql`
      select id::text, date::text, phone, status, guest_name,
             payment_method, payment_status, square_payment_id, square_payment_link_id,
             total_price, reservation_code
      from public.reservations
      where reservation_code = ${reservationCode}
      limit 1
    `;
    const reservation = rows[0];

    if (!reservation) {
      await recordAttempt(sql, ACTION, [ip], false);
      return new Response(
        JSON.stringify({ error: "予約が見つかりませんでした" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneDigits = (reservation.phone || '').replace(/\D/g, '');
    const last4Digits = phoneDigits.slice(-4);
    if (last4Digits.length !== 4 || !safeEqual(last4Digits, phoneLastFourDigits)) {
      await recordAttempt(sql, ACTION, [reservationCode, ip], false);
      return new Response(
        JSON.stringify({ error: "電話番号の下4桁が一致しません" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (reservation.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: "この予約は既にキャンセル済みです" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (reservation.status === 'expired') {
      return new Response(
        JSON.stringify({ error: "この予約は無効になっています" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 当日ブロックは確定済み予約のみ。決済待ち(pending_payment)は金銭の授受が
    // 無いため日付によらずキャンセル可
    if (reservation.status !== 'pending_payment') {
      // JST 基準の当日判定(旧実装の UTC 基準は最大9時間ズレるため置換)
      const todayStr = getJstTodayYmd();
      if (reservation.date === todayStr) {
        return new Response(
          JSON.stringify({ error: "当日のキャンセルはできません。直接お電話にてご連絡ください。" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 支払い済み(Square)は返金成功後にのみキャンセルされる。返金失敗時は
    // confirmed のまま 500 を返す(リトライ可能・冪等キー resv-cancel-<code>)
    let refunded = false;
    try {
      ({ refunded } = await cancelReservationRow(
        sql,
        reservation,
        "お客様都合によるキャンセル",
      ));
    } catch (error) {
      console.error("Refund error:", error);
      return new Response(
        JSON.stringify({ error: "返金処理に失敗しました。お手数ですがお電話にてご連絡ください。" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (refunded) {
      // 金銭移動の可視化のためオーナーへ LINE 通知(失敗してもキャンセルは成立)
      try {
        await sendLineGroupMessage(
          `【返金キャンセル】貸切予約\n${reservation.guest_name} 様（${reservationCode}・${reservation.date}）のキャンセルに伴い、¥${Number(reservation.total_price).toLocaleString()} を自動返金しました。`,
        );
      } catch (error) {
        console.error("LINE notification error:", error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        refunded,
        message: refunded
          ? "予約をキャンセルしました。全額返金の手続きを行いました。"
          : "予約をキャンセルしました",
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cancel-reservation function:', error);
    return new Response(
      JSON.stringify({ error: "予約のキャンセル処理中にエラーが発生しました" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
});
