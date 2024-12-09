import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
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

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const twilioClient = new Twilio(
      Deno.env.get("TWILIO_ACCOUNT_SID"),
      Deno.env.get("TWILIO_AUTH_TOKEN")
    );

    const { reservation } = await req.json();
    const notifications = [];

    if (reservation.email) {
      const emailData = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "U <noreply@u-sauna-private.com>",
          to: reservation.email,
          subject: "【U】ご予約の有効期限が切れました",
          html: `
            <p>${reservation.guest_name} 様</p>
            <p>ご予約の有効期限が切れました。<br>もう一度予約をお願いいたします。</p>
          `,
        }),
      });
      notifications.push(await emailData.json());
    }

    if (reservation.phone) {
      const message = await twilioClient.messages.create({
        body: `【U】ご予約の有効期限が切れました。もう一度予約をお願いいたします。`,
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
    console.error("Error in send-expiration-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});