import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/@resend/node@0.16.0";
import { Twilio } from "https://esm.sh/twilio@4.19.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const twilioClient = new Twilio(
      Deno.env.get("TWILIO_ACCOUNT_SID"),
      Deno.env.get("TWILIO_AUTH_TOKEN")
    );

    const { reservation } = await req.json();

    const notifications = [];
    const GOOGLE_MAPS_URL = "https://maps.google.com/maps?q=8Q5GHG7V%2BJ5";
    const BASE_URL = "https://www.u-sauna-private.com";
    const RESERVATION_URL = `${BASE_URL}/reservation/${reservation.reservation_code}`;

    if (reservation.email) {
      const emailData = await resend.emails.send({
        from: "U <noreply@u-sauna-private.com>",
        to: reservation.email,
        subject: "【U】ご予約内容の変更",
        html: `
          <p>${reservation.guest_name} 様</p>
          <p>ご予約内容が変更されました。<br>以下のリンクから変更内容をご確認ください。</p>
          <p><a href="${RESERVATION_URL}">予約内容を確認する</a></p>
          <hr>
          <h3>ご予約内容</h3>
          <p>
            日時: ${reservation.date} ${
          reservation.time_slot === "morning"
            ? "10:00-13:00"
            : reservation.time_slot === "afternoon"
            ? "14:00-17:00"
            : "18:00-21:00"
        }<br>
            人数: ${reservation.guest_count}名<br>
            水風呂温度: ${reservation.water_temperature}℃
          </p>
          <p>
            場所: <a href="${GOOGLE_MAPS_URL}">Googleマップで見る</a>
          </p>
          <hr>
          <p>ご不明な点がございましたら、このメールにご返信ください。</p>
        `,
      });
      notifications.push(emailData);
    }

    if (reservation.phone) {
      const message = await twilioClient.messages.create({
        body: `【U】ご予約内容が変更されました。以下のリンクから変更内容をご確認ください。\n${RESERVATION_URL}`,
        from: Deno.env.get("TWILIO_PHONE_NUMBER"),
        to: reservation.phone,
      });
      notifications.push(message);
    }

    return new Response(JSON.stringify({ notifications }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});