
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { format, addDays } from "https://esm.sh/date-fns@3.3.1";
import { sendAppEmail, buildSimpleEmailHtml } from "../_shared/lovable-email.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

import { getTimeSlotLabelViaSql } from "../_shared/time-slot-rules.ts";

// DB アクセスは直接 Postgres(POSTGRES_URL)を使う。本番では自動注入の
// SUPABASE_SERVICE_ROLE_KEY(legacy キー)が PostgREST に拒否され、
// supabase-js 経由のクエリが失敗していたため置き換えた(2026-07-11)。
const getDb = () => {
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return "+81" + digits.slice(1);
  }
  if (!digits.startsWith("0")) {
    return "+" + digits;
  }
  return digits;
};

interface ReminderReservation {
  reservation_code: string;
  guest_name: string;
  guest_count: number;
  water_temperature: number;
  date: string;
}

const sendEmail = async (to: string, reservation: ReminderReservation, timeSlotLabel: string) => {
  try {
    const subject = "【明日】サウナUのご予約リマインダー";
    const heading = "明日のご予約のお知らせ";
    const body = `${reservation.guest_name}様

明日のサウナのご予約についてお知らせいたします。

【ご予約内容】
日時: ${reservation.date}
時間: ${timeSlotLabel}
人数: ${reservation.guest_count}名
水風呂温度: ${reservation.water_temperature}°C

【所在地】
〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4
Plus Code: 8Q5GHG7V+J5
Google Maps: https://maps.google.com/maps?q=8Q5GHG7V%2BJ5

ご来店を心よりお待ちしております。`;

    await sendAppEmail({
      to,
      subject,
      html: buildSimpleEmailHtml(heading, body),
      text: body,
      idempotencyKey: `reservation-reminder-${reservation.reservation_code}-${reservation.date}`,
      label: "reservation-reminder",
    });
    console.log(`メールを送信しました: ${to}`);
  } catch (error) {
    console.error("メール送信エラー:", error);
  }
};

const sendSMS = async (phone: string, reservation: ReminderReservation, timeSlotLabel: string) => {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Missing Twilio credentials");
    }
    const formattedPhone = formatPhoneNumber(phone);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append("To", formattedPhone);
    formData.append("From", TWILIO_PHONE_NUMBER);
    formData.append(
      "Body",
      `【明日のご予約リマインダー】\n${reservation.guest_name}様\n\n日時: ${
        reservation.date
      }\n時間: ${timeSlotLabel}\n人数: ${
        reservation.guest_count
      }名\n水風呂温度: ${
        reservation.water_temperature
      }°C\n\n住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4\nPlus Code: 8Q5GHG7V+J5\n\nご来店を心よりお待ちしております。`
    );

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`SMS送信に失敗しました: ${await res.text()}`);
    }
    console.log(`SMSを送信しました: ${phone}`);
  } catch (error) {
    console.error("SMS送信エラー:", error);
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("予約リマインダー処理を開始します");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    // 明日の日付を取得
    const tomorrow = addDays(new Date(), 1);
    const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

    console.log(`明日の予約を確認します: ${tomorrowStr}`);

    // 明日の予約を取得。リマインド対象は確定済みのみ
    // (旧実装の neq('status','cancelled') は pending / 決済待ち / expired も
    //  含んでしまっていたため、confirmed に絞る)
    const reservations = await sql`
      select id::text, reservation_code, guest_name, guest_count, water_temperature,
             email, phone, status, date::text, time_slot::text
      from public.reservations
      where date = ${tomorrowStr}::date
        and status = 'confirmed'
    `;

    console.log(`明日の有効な予約数: ${reservations.length}`);

    // 各予約に対して通知を送信
    for (const reservation of reservations) {
      console.log(`予約を処理中: ${reservation.guest_name} (ステータス: ${reservation.status})`);

      // 動的時間帯を取得
      const timeSlotLabel = await getTimeSlotLabelViaSql(sql, reservation.time_slot, reservation.date);

      // メールがある場合は送信
      if (reservation.email) {
        await sendEmail(reservation.email, reservation, timeSlotLabel);
      }

      // SMSを送信
      await sendSMS(reservation.phone, reservation, timeSlotLabel);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${reservations.length}件の予約通知を送信しました`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("予約リマインダー処理でエラーが発生しました:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "failed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
