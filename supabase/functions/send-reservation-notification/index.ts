import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/@resend/node@0.16.0";
import { Twilio } from "https://esm.sh/twilio@4.19.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

const timeSlotLabels: { [key: string]: string } = {
  morning: "午前（10:00-12:00）",
  afternoon: "午後（14:00-16:00）",
  evening: "夜（18:00-20:00）",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const reservation: ReservationNotification = await req.json();
    console.log("Received reservation notification request:", reservation);

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const twilioClient = new Twilio(
      Deno.env.get("TWILIO_ACCOUNT_SID"),
      Deno.env.get("TWILIO_AUTH_TOKEN")
    );

    const formattedDate = new Date(reservation.date).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const notifications = [];
    const GOOGLE_MAPS_URL = "https://maps.google.com/maps?q=8Q5GHG7V%2BJ5";
    const BASE_URL = "https://u-sauna-private.com";
    const CONFIRMATION_URL = `${BASE_URL}/reservation/confirm/${reservation.confirmationToken}`;

    console.log("Generated confirmation URL:", CONFIRMATION_URL);

    if (reservation.email) {
      const emailContent = `
        ${reservation.guestName}様

        サウナの仮予約を受け付けました。
        以下のリンクから20分以内に予約を確定してください。

        予約確定リンク：
        ${CONFIRMATION_URL}

        【予約内容】
        予約コード：${reservation.reservationCode}
        日時：${formattedDate} ${timeSlotLabels[reservation.timeSlot]}
        人数：${reservation.guestCount}名
        水風呂温度：${reservation.waterTemperature}℃

        【場所】
        ${GOOGLE_MAPS_URL}

        ※このメールは自動送信されています。
        `;

      notifications.push(
        resend.emails.send({
          from: "noreply@resend.dev",
          to: reservation.email,
          subject: "【サウナ】ご予約の確認",
          text: emailContent,
        })
      );
    }

    // Format phone number for Twilio
    let phoneNumber = reservation.phone;
    if (phoneNumber.startsWith("0")) {
      phoneNumber = "+81" + phoneNumber.slice(1);
    }
    console.log("Formatted phone number for Twilio:", phoneNumber);

    const smsContent = `
【サウナ】仮予約を受け付けました
以下のリンクから20分以内に予約を確定してください

${CONFIRMATION_URL}

予約コード：${reservation.reservationCode}
`;

    notifications.push(
      twilioClient.messages.create({
        body: smsContent,
        to: phoneNumber,
        from: Deno.env.get("TWILIO_PHONE_NUMBER"),
      })
    );

    await Promise.all(notifications);
    console.log("All notifications sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error sending notifications:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});