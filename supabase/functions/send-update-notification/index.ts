import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

interface UpdateNotification {
  date: string;
  timeSlot: string;
  guestName: string;
  guestCount: number;
  email: string | null;
  phone: string;
  waterTemperature: number;
  reservationCode: string;
}

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
  console.log("予約更新通知機能が呼び出されました");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reservation: UpdateNotification = await req.json();
    console.log("予約更新情報を受信:", reservation);

    const notifications = [];
    const GOOGLE_MAPS_URL = "https://maps.google.com/maps?q=8Q5GHG7V%2BJ5";
    const BASE_URL = "https://www.u-sauna-private.com";
    const RESERVATION_URL = `${BASE_URL}/reservation/${reservation.reservationCode}`;

    if (reservation.email) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Sauna Reservation <onboarding@resend.dev>",
            to: [reservation.email],
            subject: "サウナのご予約内容変更のお知らせ",
            html: `
              <h1>ご予約内容変更のお知らせ</h1>
              <p>${reservation.guestName}様</p>
              <p>サウナのご予約内容が以下の通り変更されました：</p>
              <ul>
                <li>予約コード: ${reservation.reservationCode}</li>
                <li>日付: ${reservation.date}</li>
                <li>時間: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}</li>
                <li>人数: ${reservation.guestCount}名</li>
                <li>水風呂温度: ${reservation.waterTemperature}°C</li>
              </ul>
              <p>予約の詳細は以下のURLからご確認いただけます：</p>
              <p><a href="${RESERVATION_URL}">${RESERVATION_URL}</a></p>
              <p>住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4</p>
              <p>Plus Code: 8Q5GHG7V+J5</p>
              <p>Google Maps: <a href="${GOOGLE_MAPS_URL}">こちらから確認できます</a></p>
              <p>ご来店を心よりお待ちしております。</p>
            `,
          }),
        });

        if (!emailRes.ok) {
          throw new Error(`メール送信に失敗しました: ${await emailRes.text()}`);
        }
        console.log("更新通知メールを送信しました");
        notifications.push("email");
      } catch (error) {
        console.error("メール送信エラー:", error);
      }
    }

    try {
      const formattedPhone = formatPhoneNumber(reservation.phone);
      console.log("電話番号:", reservation.phone);
      console.log("フォーマット後の電話番号:", formattedPhone);

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const formData = new URLSearchParams();
      formData.append('To', formattedPhone);
      formData.append('From', TWILIO_PHONE_NUMBER);
      formData.append('Body', `サウナのご予約内容が変更されました。\n\n予約コード: ${reservation.reservationCode}\n\n日付: ${reservation.date}\n時間: ${
        TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]
      }\n人数: ${reservation.guestCount}名\n水風呂温度: ${
        reservation.waterTemperature
      }°C\n\n予約の詳細はこちら：\n${RESERVATION_URL}\n\n住所: 〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4\nPlus Code: 8Q5GHG7V+J5\nGoogle Maps: ${GOOGLE_MAPS_URL}\n\nご来店を心よりお待ちしております。`);

      console.log("SMS更新通知を送信:", formattedPhone);
      console.log("SMS内容:", formData.toString());

      const smsRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: formData,
      });

      const smsResponseText = await smsRes.text();
      console.log("Twilio APIレスポンス:", smsResponseText);

      if (!smsRes.ok) {
        console.error("SMS送信に失敗しました:", smsResponseText);
      } else {
        console.log("SMS更新通知を送信しました");
        notifications.push("sms");
      }
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