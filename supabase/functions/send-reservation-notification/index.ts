import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GOOGLE_MAPS_URL = "https://maps.google.com/maps?q=8Q5GHG7V%2BJ5";

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
  baseUrl: string;
}

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('0')) {
    return '+81' + digits.slice(1);
  }
  
  if (!digits.startsWith('0')) {
    return '+' + digits;
  }
  
  return digits;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("通知機能が呼び出されました");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reservation: ReservationNotification = await req.json();
    console.log("予約情報を受信:", reservation);

    const notifications = [];

    const CONFIRMATION_URL = `${reservation.baseUrl}/reservation/confirm/${reservation.confirmationToken}`;
    console.log("確認URL:", CONFIRMATION_URL);

    if (reservation.email) {
      try {
        console.log("メール送信を試行中...");
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          },
          body: JSON.stringify({
            from: "Sauna Reservation <onboarding@resend.dev>",
            to: [reservation.email],
            subject: "サウナの仮予約確認",
            html: `
              <h1>仮予約確認</h1>
              <p>${reservation.guestName}様</p>
              <p>サウナの仮予約を受け付けました。以下のリンクから20分以内に予約を確定してください：</p>
              <p><a href="${CONFIRMATION_URL}">予約を確定する</a></p>
              <p>予約内容：</p>
              <ul>
                <li>予約コード: ${reservation.reservationCode}</li>
                <li>日付: ${reservation.date}</li>
                <li>時間: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}</li>
                <li>人数: ${reservation.guestCount}名</li>
                <li>水風呂温度: ${reservation.waterTemperature}°C</li>
              </ul>
              <p>※このリンクの有効期限は20分です。</p>
              <p>住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4</p>
              <p>Plus Code: 8Q5GHG7V+J5</p>
              <p>Google Maps: <a href="${GOOGLE_MAPS_URL}">こちらから確認できます</a></p>
            `,
          }),
        });

        const emailResponseData = await emailRes.text();
        console.log("メール送信レスポンス:", emailResponseData);

        if (!emailRes.ok) {
          throw new Error(`メール送信に失敗しました: ${emailResponseData}`);
        }
        console.log("メールを送信しました");
        notifications.push("email");
      } catch (error) {
        console.error("メール送信エラー:", error);
      }
    }

    try {
      const formattedPhone = formatPhoneNumber(reservation.phone);
      console.log("電話番号:", reservation.phone);
      console.log("フォーマット後の電話番号:", formattedPhone);

      const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
      const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
      const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const messageBody = `サウナの仮予約を受け付けました。\n\n以下のリンクから20分以内に予約を確定してください：\n${CONFIRMATION_URL}\n\n予約内容：\n予約コード: ${reservation.reservationCode}\n日付: ${reservation.date}\n時間: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}\n人数: ${reservation.guestCount}名\n水風呂温度: ${reservation.waterTemperature}°C\n\n※このリンクの有効期限は20分です。\n\n住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4\nPlus Code: 8Q5GHG7V+J5\nGoogle Maps: ${GOOGLE_MAPS_URL}`;

      const formData = new URLSearchParams();
      formData.append('To', formattedPhone);
      formData.append('From', TWILIO_PHONE_NUMBER || '');
      formData.append('Body', messageBody);

      console.log("SMS送信を試行中...");
      const smsRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: formData.toString(),
      });

      const smsResponseData = await smsRes.text();
      console.log("SMS送信レスポンス:", smsResponseData);

      if (!smsRes.ok) {
        throw new Error(`SMS送信に失敗しました: ${smsResponseData}`);
      }
      console.log("SMSを送信しました");
      notifications.push("sms");
    } catch (error) {
      console.error("SMS送信エラー:", error);
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
    console.error("通知機能でエラーが発生しました:", error);
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