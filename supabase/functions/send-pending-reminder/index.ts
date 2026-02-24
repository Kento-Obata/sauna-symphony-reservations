import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Running send-pending-reminder edge function");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find pending reservations that are approaching expiration (within 30 minutes)
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    const { data: pendingReservations, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("status", "pending")
      .eq("is_confirmed", false)
      .gt("expires_at", now.toISOString())
      .lt("expires_at", thirtyMinutesFromNow.toISOString());

    if (error) {
      console.error("Error fetching pending reservations:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingReservations?.length || 0} pending reservations approaching expiration`);

    if (!pendingReservations || pendingReservations.length === 0) {
      return new Response(JSON.stringify({ message: "No pending reminders to send" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifications = [];

    for (const reservation of pendingReservations) {
      try {
        const BASE_URL = "https://www.u-sauna-private.com";
        const CONFIRMATION_URL = `${BASE_URL}/reservation/confirm/${reservation.confirmation_token}`;

        const expiresAt = new Date(reservation.expires_at);
        const remainingMinutes = Math.round((expiresAt.getTime() - now.getTime()) / 60000);

        const message = `【Sauna U リマインド】仮予約（${reservation.reservation_code}）の確認期限が残り約${remainingMinutes}分です。\nまだ本予約が完了しておりません。下記リンクより予約確定をお願いいたします。\n${CONFIRMATION_URL}`;

        if (reservation.phone) {
          const formattedPhone = reservation.phone.replace(/\D/g, '');
          const internationalPhone = formattedPhone.startsWith('0')
            ? '+81' + formattedPhone.slice(1)
            : formattedPhone;

          await sendSMS(internationalPhone, message);
          notifications.push(`SMS reminder sent to ${reservation.phone}`);
          console.log(`Reminder SMS sent for reservation ${reservation.reservation_code}`);
        }
      } catch (notificationError) {
        console.error(`Error sending reminder for reservation ${reservation.id}:`, notificationError);
      }
    }

    return new Response(
      JSON.stringify({ message: "Reminders processed", notifications }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
