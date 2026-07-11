// 確認期限(2時間)を過ぎた仮予約に期限切れ通知(メール+SMS)を送り、
// status を expired に遷移させる(スケジュール実行)。
//
// DB アクセスは直接 Postgres(POSTGRES_URL)を使う。本番では自動注入の
// SUPABASE_SERVICE_ROLE_KEY(legacy キー)が PostgREST に拒否され、
// supabase-js 経由のクエリが全て失敗していたため置き換えた(2026-07-11)。
// 注: 対象は現地払いの仮予約(status='pending')のみ。事前決済の pending_payment は
// expire-event-holds が処理する。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";
import { sendSMS } from "../_shared/twilio.ts";

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

// Twilio は E.164 形式(+81...)のみ受け付ける
const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? '+81' + digits.slice(1) : digits;
};

serve(async (_req) => {
  if (_req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    console.log("Running send-expiration-notification edge function");

    // 期限切れへ遷移させてから通知する(先に UPDATE することで、通知失敗時の
    // 再実行で同じ予約に重複送信されるのを防ぐ)
    const expiredReservations = await sql`
      update public.reservations
      set status = 'expired'
      where status = 'pending'
        and is_confirmed = false
        and expires_at < now()
      returning id::text, reservation_code, email, phone
    `;

    console.log(`Found ${expiredReservations.length} expired reservations`);

    if (expiredReservations.length === 0) {
      return new Response(JSON.stringify({ message: "No expired reservations found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const notifications = [];

    for (const reservation of expiredReservations) {
      console.log(`Processing expired reservation: ${reservation.id}`);

      try {
        const subject = "予約期限切れのお知らせ";
        const message = `
お客様の予約（予約コード: ${reservation.reservation_code}）の確認期限が切れました。
2時間以内に確認が行われなかったため、予約はキャンセルされました。

再度ご予約いただく場合は、弊社ウェブサイトからお手続きください。
        `;

        if (reservation.email) {
          console.log(`Sending expiration email to: ${reservation.email}`);
          await sendEmail(reservation.email, subject, message);
          notifications.push(`Email sent to ${reservation.email}`);
        }

        if (reservation.phone) {
          console.log(`Sending expiration SMS to: ${reservation.phone}`);
          await sendSMS(formatPhoneNumber(reservation.phone), message);
          notifications.push(`SMS sent to ${reservation.phone}`);
        }
      } catch (notificationError) {
        console.error(`Error sending notifications for reservation ${reservation.id}:`, notificationError);
      }
    }

    return new Response(JSON.stringify({
      message: "Expired reservations processed successfully",
      notifications
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
});
