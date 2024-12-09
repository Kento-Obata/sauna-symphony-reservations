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

interface ExpirationNotification {
  guestName: string;
  email: string | null;
  phone: string;
  reservationCode: string;
  date: string;
  timeSlot: string;
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
  console.log("予約期限切れ通知機能が呼び出されました");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reservation: ExpirationNotification = await req.json();
    console.log("予約期限切れ情報を受信:", reservation);

    const notifications = [];
    const TIME_SLOTS = {
      morning: "10:00-12:30",
      afternoon: "13:30-16:00",
      evening: "17:00-19:30",
    };

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
            subject: "サウナの仮予約が期限切れになりました",
            html: `
              <h1>仮予約期限切れのお知らせ</h1>
              <p>${reservation.guestName}様</p>
              <p>申し訳ございませんが、以下の仮予約は20分以内に確定されなかったため、キャンセルされました：</p>
              <ul>
                <li>予約コード: ${reservation.reservationCode}</li>
                <li>日付: ${reservation.date}</li>
                <li>時間: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}</li>
              </ul>
              <p>もう一度予約をご希望の場合は、お手数ですが再度予約手続きをお願いいたします。</p>
            `,
          }),
        });

        if (!emailRes.ok) {
          throw new Error(`メール送信に失敗しました: ${await emailRes.text()}`);
        }
        console.log("期限切れ通知メールを送信しました");
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
      formData.append('Body', 
        `${reservation.guestName}様\n\n` +
        `申し訳ございませんが、以下の仮予約は20分以内に確定されなかったため、キャンセルされました：\n\n` +
        `予約コード: ${reservation.reservationCode}\n` +
        `日付: ${reservation.date}\n` +
        `時間: ${TIME_SLOTS[reservation.timeSlot as keyof typeof TIME_SLOTS]}\n\n` +
        `もう一度予約をご希望の場合は、お手数ですが再度予約手続きをお願いいたします。`
      );

      console.log("SMS期限切れ通知を送信:", formattedPhone);
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
        console.log("SMS期限切れ通知を送信しました");
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