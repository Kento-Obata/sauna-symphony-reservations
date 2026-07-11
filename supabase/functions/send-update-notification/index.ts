
// 管理画面からの予約変更・キャンセル時の顧客通知(SMS + email)。
//
// DB アクセスは直接 Postgres(POSTGRES_URL)を使う。旧実装は ANON キーの
// supabase-js で reservations を読んでいたが、RLS 強化(公開 SELECT 廃止)以降は
// 常に「予約が見つかりませんでした」となり通知が送られていなかった(2026-07-11 修正)。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { corsHeaders } from "../_shared/cors.ts";
import { sendSMS } from "../_shared/twilio.ts";
import { sendEmail } from "../_shared/email.ts";

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const { reservationCode } = await req.json();

    if (typeof reservationCode !== 'string' || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
      throw new Error("予約コードの形式が正しくありません");
    }

    const rows = await sql`
      select status, phone, email
      from public.reservations
      where reservation_code = ${reservationCode}
      limit 1
    `;
    const reservation = rows[0];

    if (!reservation) {
      throw new Error("予約が見つかりませんでした");
    }

    // キャンセル通知の場合は専用のメッセージを送信
    const isCancel = reservation.status === "cancelled";
    const subject = isCancel ? "予約キャンセルのお知らせ" : "予約更新のお知らせ";
    const message = isCancel
      ? `ご予約(予約コード: ${reservationCode})のキャンセルを承りました。またのご利用をお待ちしております。`
      : `ご予約(予約コード: ${reservationCode})が更新されました。詳細は予約確認ページをご確認ください。`;

    // Send SMS notification
    if (reservation.phone) {
      await sendSMS(formatPhoneNumber(reservation.phone), message);
    }

    // Send email notification
    if (reservation.email) {
      await sendEmail(reservation.email, subject, message);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "failed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
