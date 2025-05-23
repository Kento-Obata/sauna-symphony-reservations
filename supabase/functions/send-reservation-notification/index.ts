
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { sendSMS } from "../_shared/twilio.ts";

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
  confirmationToken: string;
}

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

const ITEMS_TO_BRING = `
・バスタオル
・フェイスタオル
・着替え
・シャンプー、リンス、ボディーソープ（備え付けもございます）
・ドライヤー（備え付けもございます）
`;

const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('0')) {
    return '+81' + digits.slice(1);
  }
  
  return digits;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: { ...corsHeaders }
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
    const OWNER_PHONE_NUMBER = Deno.env.get('OWNER_PHONE_NUMBER');

    console.log("Environment variables check:", {
      hasResendKey: !!RESEND_API_KEY,
      hasTwilioSid: !!TWILIO_ACCOUNT_SID,
      hasTwilioToken: !!TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!TWILIO_PHONE_NUMBER,
      hasOwnerPhone: !!OWNER_PHONE_NUMBER
    });

    if (!RESEND_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("Missing required environment variables");
      throw new Error("Server configuration error");
    }

    const resend = new Resend(RESEND_API_KEY);

    const reservation: ReservationNotification = await req.json();
    console.log("Received reservation data:", {
      ...reservation,
      phone: "REDACTED",
      confirmationToken: "REDACTED"
    });

    const notifications = [];
    const GOOGLE_MAPS_URL = "https://maps.google.com/maps?q=8Q5GHG7V%2BJ5";
    const BASE_URL = "https://www.u-sauna-private.com";
    const CONFIRMATION_URL = `${BASE_URL}/reservation/confirm/${reservation.confirmationToken}`;
    const RESERVATION_DETAILS_URL = `${BASE_URL}/reservation/${reservation.reservationCode}`;

    console.log("Generated URLs:", {
      CONFIRMATION_URL,
      GOOGLE_MAPS_URL,
      RESERVATION_DETAILS_URL
    });

    const commonMessageContent = `
ご予約ありがとうございます。

【ご予約内容】
予約コード: ${reservation.reservationCode}
日付: ${reservation.date}
時間: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}
人数: ${reservation.guestCount}名様

【受付時間】
ご予約時間の10分前からご案内いたします。

【設備・アメニティ】
タオル、水着、シャンプー・リンス・ボディソープ・フェイシャルパック・化粧水・乳液・ヘアオイル・ドライヤー・カールアイロン・ストレートアイロン を用意しております。

【アクセス】
住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4
Plus Code: 8Q5GHG7V+J5
Google Maps: ${GOOGLE_MAPS_URL}

ご予約の詳細はこちらからご確認いただけます：
${RESERVATION_DETAILS_URL}

心よりお待ちしております。
`;

    // オーナーへの通知メッセージを作成
    const ownerMessageContent = `
【新規仮予約のお知らせ】
予約コード: ${reservation.reservationCode}
お客様: ${reservation.guestName}様
日付: ${reservation.date}
時間: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}
人数: ${reservation.guestCount}名様
水風呂温度: ${reservation.waterTemperature}°C
電話番号: ${reservation.phone}
メール: ${reservation.email || "未登録"}
`;

    if (reservation.email) {
      try {
        console.log("Attempting to send email to:", reservation.email);
        const emailRes = await resend.emails.send({
          from: "Sauna U <onboarding@resend.dev>",
          to: [reservation.email],
          subject: "サウナのご予約確認",
          html: `
            <h1>ご予約ありがとうございます</h1>
            <p>${reservation.guestName}様</p>
            ${commonMessageContent.split('\n').map(line => `<p>${line}</p>`).join('')}
          `,
        });
        console.log("Email sent successfully:", emailRes);
        notifications.push("email");
      } catch (error) {
        console.error("Email sending error:", error);
        console.error("Full error details:", {
          name: error.name,
          message: error.message,
          cause: error.cause
        });
      }
    }

    try {
      const formattedPhone = formatPhoneNumber(reservation.phone);
      console.log("Attempting to send SMS to formatted number:", formattedPhone);

      const formData = new URLSearchParams();
      formData.append('To', formattedPhone);
      formData.append('From', TWILIO_PHONE_NUMBER);
      formData.append('Body', commonMessageContent);

      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          },
          body: formData,
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

    // オーナーへのSMS通知を送信（OWNER_PHONE_NUMBER が設定されている場合のみ）
    if (OWNER_PHONE_NUMBER) {
      try {
        console.log("Attempting to send notification SMS to owner:", OWNER_PHONE_NUMBER);
        
        await sendSMS(OWNER_PHONE_NUMBER, ownerMessageContent);
        
        console.log("Owner notification SMS sent successfully");
        notifications.push("owner_sms");
      } catch (error) {
        console.error("Owner notification SMS sending error:", error);
      }
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
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

serve(handler);
