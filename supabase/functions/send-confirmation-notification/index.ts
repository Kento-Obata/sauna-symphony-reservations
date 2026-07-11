
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { sendSMS } from "../_shared/twilio.ts";
import { sendLineGroupMessage } from "../_shared/line.ts";
import { buildSimpleEmailHtml, sendAppEmail } from "../_shared/lovable-email.ts";

// DB アクセスは直接 Postgres(POSTGRES_URL)を使う。本番では自動注入の
// SUPABASE_SERVICE_ROLE_KEY(legacy キー)が PostgREST に拒否され、
// supabase-js 経由のクエリ(枠ラベル・access_token 取得)が失敗していたため
// 置き換えた(2026-07-11)。
const getDb = () => {
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReservationNotification {
  date: string;
  timeSlot: string;
  guestName: string;
  guestCount: number;
  email: string | null;
  phone: string;
  waterTemperature: number;
  reservationCode: string;
  total_price: number;
}

import { getTimeSlotLabelViaSql } from "../_shared/time-slot-rules.ts";

const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? '+81' + digits.slice(1) : digits;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Confirmation notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { ...corsHeaders }
    });
  }

  const sql = getDb();

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
    const OWNER_PHONE_NUMBER = Deno.env.get('OWNER_PHONE_NUMBER');

    console.log("Environment variables check:", {
      hasTwilioSid: !!TWILIO_ACCOUNT_SID,
      hasTwilioToken: !!TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!TWILIO_PHONE_NUMBER,
      hasOwnerPhone: !!OWNER_PHONE_NUMBER
    });

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !OWNER_PHONE_NUMBER) {
      console.error("Missing required environment variables");
      throw new Error("Server configuration error");
    }

    const reservation: ReservationNotification = await req.json();
    console.log("Received reservation data:", {
      ...reservation,
      phone: "REDACTED"
    });

    const notifications = [];
    const GOOGLE_MAPS_URL = "https://maps.google.com/maps?q=8Q5GHG7V%2BJ5";

    const totalPrice = reservation.total_price || 0;
    console.log("Using stored total price:", totalPrice);
    
    // Get dynamic time slot label
    const timeSlotLabel = await getTimeSlotLabelViaSql(sql, reservation.timeSlot, reservation.date);

    // Fetch access_token to build a signed detail URL (so the link auto-authenticates)
    let tokenQuery = "";
    try {
      const tokenRows = await sql`
        select access_token
        from public.reservations
        where reservation_code = ${reservation.reservationCode}
        limit 1
      `;
      if (tokenRows[0]?.access_token) tokenQuery = `?t=${tokenRows[0].access_token}`;
    } catch (error) {
      console.error("access_token lookup error:", error);
    }
    // 既定は本番フロント。staging/ローカル検証時は APP_BASE_URL で上書き可（本番は未設定なので不変）。
    const BASE_URL = Deno.env.get('APP_BASE_URL') ?? "https://www.u-sauna-private.com";
    const reservationDetailUrl = `${BASE_URL}/reservation/${reservation.reservationCode}${tokenQuery}`;
    
    const messageContent = `
ご予約いただきありがとうございます！

【ご予約内容】
予約コード: ${reservation.reservationCode}
日付: ${reservation.date}
時間: ${timeSlotLabel}
人数: ${reservation.guestCount}名様
料金: ¥${totalPrice.toLocaleString()} (税込)

【受付時間】
ご予約時間の10分前からご案内いたします。

【設備・アメニティ】
タオル、水着、シャンプー・リンス・ボディソープ・フェイシャルパック・化粧水・乳液・ヘアオイル・ドライヤー・カールアイロン・ストレートアイロン を用意しております。

【アクセス】
住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4
Plus Code: 8Q5GHG7V+J5
Google Maps: ${GOOGLE_MAPS_URL}

【予約の確認・変更・キャンセル】
以下のURLから予約内容の確認、変更、キャンセルが可能です：
${reservationDetailUrl}

【遅刻の際の事前連絡について】
遅刻の可能性がある場合は、事前にご連絡をお願いいたします。
・電話: 090-9370-2960
・Instagram DM も可能です

心よりお待ちしております。
`;

    // オーナーへの通知メッセージを作成
    const ownerMessageContent = `
【新規予約確定のお知らせ】
予約コード: ${reservation.reservationCode}
お客様: ${reservation.guestName}様
日付: ${reservation.date}
時間: ${timeSlotLabel}
人数: ${reservation.guestCount}名様
水風呂温度: ${reservation.waterTemperature}°C
料金: ¥${totalPrice.toLocaleString()} (税込)
電話番号: ${reservation.phone}
メール: ${reservation.email || "未登録"}
`;

    if (reservation.email) {
      try {
        console.log("Attempting to send email to:", reservation.email);
        const emailRes = await sendAppEmail({
          to: reservation.email,
          subject: "サウナのご予約確定のお知らせ",
          html: buildSimpleEmailHtml("ご予約ありがとうございます", `${reservation.guestName}様\n${messageContent}`),
          text: `${reservation.guestName}様\n${messageContent}`,
          idempotencyKey: `reservation-confirmed-${reservation.reservationCode}`,
          label: "reservation-confirmed",
        });
        console.log("Email sent successfully:", emailRes);
        notifications.push("email");
      } catch (error) {
        console.error("Email sending error:", error);
      }
    }

    try {
      const formattedPhone = formatPhoneNumber(reservation.phone);
      console.log("Attempting to send SMS to formatted number:", formattedPhone);

      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          },
          body: new URLSearchParams({
            'To': formattedPhone,
            'From': TWILIO_PHONE_NUMBER,
            'Body': messageContent
          }),
        }
      );

      const twilioResult = await twilioResponse.json();
      console.log("Twilio API Response:", twilioResult);

      if (!twilioResponse.ok) {
        throw new Error(`Twilio API error: ${JSON.stringify(twilioResult)}`);
      }

      console.log("SMS sent successfully");
      notifications.push("sms");
    } catch (error) {
      console.error("SMS sending error:", error);
    }

    // オーナーへのSMS通知を送信
    try {
      console.log("Attempting to send notification SMS to owner:", OWNER_PHONE_NUMBER);

      await sendSMS(OWNER_PHONE_NUMBER, ownerMessageContent);

      console.log("Owner notification SMS sent successfully");
      notifications.push("owner_sms");
    } catch (error) {
      console.error("Owner notification SMS sending error:", error);
    }

    // LINEグループへの通知を送信
    try {
      await sendLineGroupMessage(ownerMessageContent.trim());
      console.log("LINE group notification sent successfully");
      notifications.push("line_group");
    } catch (error) {
      console.error("LINE group notification error:", error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications: notifications,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "notification failed",
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
