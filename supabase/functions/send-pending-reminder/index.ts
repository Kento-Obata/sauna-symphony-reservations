// 仮予約の確認期限(2時間)が30分以内に迫った予約へ SMS リマインドを送る(10分毎の cron)。
//
// DB アクセスは直接 Postgres(POSTGRES_URL)を使う。本番では自動注入の
// SUPABASE_SERVICE_ROLE_KEY(legacy キー)が PostgREST に拒否され、
// supabase-js 経由のクエリが全て失敗していたため置き換えた(2026-07-11)。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { corsHeaders } from "../_shared/cors.ts";
import { sendSMS } from "../_shared/twilio.ts";

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    console.log("Running send-pending-reminder edge function");

    // 期限まで30分以内の仮予約(メール確認待ち)を取得
    const pendingReservations = await sql`
      select id::text, reservation_code, confirmation_token, phone, expires_at
      from public.reservations
      where status = 'pending'
        and is_confirmed = false
        and expires_at > now()
        and expires_at < now() + interval '30 minutes'
    `;

    console.log(`Found ${pendingReservations.length} pending reservations approaching expiration`);

    if (pendingReservations.length === 0) {
      return new Response(JSON.stringify({ message: "No pending reminders to send" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const notifications = [];

    for (const reservation of pendingReservations) {
      try {
        // 既定は本番フロント。staging/ローカル検証時は APP_BASE_URL で上書き可（本番は未設定なので不変）。
        const BASE_URL = Deno.env.get('APP_BASE_URL') ?? "https://www.u-sauna-private.com";
        const CONFIRMATION_URL = `${BASE_URL}/reservation/confirm/${reservation.confirmation_token}`;

        const expiresAt = new Date(reservation.expires_at);
        const remainingMinutes = Math.round((expiresAt.getTime() - now.getTime()) / 60000);

        const message = `【Sauna U リマインド】仮予約（${reservation.reservation_code}）の確認期限が残り約${remainingMinutes}分です。\nまだ本予約が完了しておりません。下記リンクより予約確定をお願いいたします。\n${CONFIRMATION_URL}`;

        if (reservation.phone) {
          const formattedPhone = reservation.phone.replace(/\D/g, '');
          const internationalPhone = formattedPhone.startsWith('0')
            ? '+81' + formattedPhone.slice(1)
            : formattedPhone;

          await sendSMS(internationalPhone, message);
          notifications.push(`SMS reminder sent to ${reservation.phone}`);
          console.log(`Reminder SMS sent for reservation ${reservation.reservation_code}`);
        }
      } catch (notificationError) {
        console.error(`Error sending reminder for reservation ${reservation.id}:`, notificationError);
      }
    }

    return new Response(
      JSON.stringify({ message: "Reminders processed", notifications }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
