
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { sendSMS } from "../_shared/twilio.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const DEFAULT_TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

const getTimeSlotLabel = async (timeSlot: string, date: string, supabase: any) => {
  try {
    const { data, error } = await supabase
      .from('daily_time_slots')
      .select('start_time, end_time')
      .eq('date', date)
      .eq('time_slot', timeSlot)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return DEFAULT_TIME_SLOTS[timeSlot as keyof typeof DEFAULT_TIME_SLOTS];
    }

    return `${data.start_time.slice(0, 5)}-${data.end_time.slice(0, 5)}`;
  } catch (error) {
    console.error('Error fetching time slot:', error);
    return DEFAULT_TIME_SLOTS[timeSlot as keyof typeof DEFAULT_TIME_SLOTS];
  }
};

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

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
    const OWNER_PHONE_NUMBER = Deno.env.get('OWNER_PHONE_NUMBER');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log("Environment variables check:", {
      hasResendKey: !!RESEND_API_KEY,
      hasTwilioSid: !!TWILIO_ACCOUNT_SID,
      hasTwilioToken: !!TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!TWILIO_PHONE_NUMBER,
      hasOwnerPhone: !!OWNER_PHONE_NUMBER
    });

    if (!RESEND_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !OWNER_PHONE_NUMBER || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables");
      throw new Error("Server configuration error");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);
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
    const timeSlotLabel = await getTimeSlotLabel(reservation.timeSlot, reservation.date, supabase);

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

【予約変更・遅刻の際の事前連絡について】
予約の変更やキャンセル、遅刻の可能性がある場合は、事前にご連絡をお願いいたします。
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
        const emailRes = await resend.emails.send({
          from: "Sauna U <onboarding@resend.dev>",
          to: [reservation.email],
          subject: "サウナのご予約確定のお知らせ",
          html: `
            <h1>ご予約ありがとうございます</h1>
            <p>${reservation.guestName}様</p>
            ${messageContent.split('\n').map(line => `<p>${line}</p>`).join('')}
          `,
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
