
// supabase/functions/send-expiration-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (_req) => {
  // CORS headers
  if (_req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log("Running send-expiration-notification edge function");
    
    // Create a Supabase client with the service role key
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Find all reservations that have expired (past their expires_at time)
    const { data: expiredReservations, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("status", "pending")
      .eq("is_confirmed", false) // 重要：is_confirmedがfalseの予約のみを対象に
      .lt("expires_at", new Date().toISOString());

    if (error) {
      console.error("Error fetching expired reservations:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Found ${expiredReservations?.length || 0} expired reservations`);

    if (!expiredReservations || expiredReservations.length === 0) {
      return new Response(JSON.stringify({ message: "No expired reservations found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Process each expired reservation
    const notifications = [];

    for (const reservation of expiredReservations) {
      console.log(`Processing expired reservation: ${reservation.id}`);
      
      // Send notification to the user
      try {
        const subject = "予約期限切れのお知らせ";
        const message = `
お客様の予約（予約コード: ${reservation.reservation_code}）の確認期限が切れました。
3時間以内に確認が行われなかったため、予約はキャンセルされました。

再度ご予約いただく場合は、弊社ウェブサイトからお手続きください。
        `;

        // Send email notification if email exists
        if (reservation.email) {
          console.log(`Sending expiration email to: ${reservation.email}`);
          await sendEmail(reservation.email, subject, message);
          notifications.push(`Email sent to ${reservation.email}`);
        }

        // Send SMS notification
        if (reservation.phone) {
          console.log(`Sending expiration SMS to: ${reservation.phone}`);
          await sendSMS(reservation.phone, message);
          notifications.push(`SMS sent to ${reservation.phone}`);
        }
      } catch (notificationError) {
        console.error(`Error sending notifications for reservation ${reservation.id}:`, notificationError);
      }
    }

    // Update the expired reservations to expired status
    const { error: updateError } = await supabase
      .from("reservations")
      .update({ status: "expired" })
      .eq("status", "pending")
      .eq("is_confirmed", false) // 重要：is_confirmedがfalseの予約のみを更新
      .lt("expires_at", new Date().toISOString());

    if (updateError) {
      console.error("Error updating expired reservations:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ 
      message: "Expired reservations processed successfully", 
      notifications 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
