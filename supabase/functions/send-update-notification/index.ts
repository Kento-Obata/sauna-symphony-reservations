import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendSMS } from "../_shared/twilio.ts";
import { sendEmail } from "../_shared/email.ts";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservationCode, ...updateData } = await req.json();

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Fetch reservation details to check status
    const { data: reservation, error: fetchError } = await supabaseClient
      .from("reservations")
      .select("*")
      .eq("reservation_code", reservationCode)
      .single();

    if (fetchError || !reservation) {
      throw new Error("予約が見つかりませんでした");
    }

    // Skip notifications if the reservation is cancelled
    if (reservation.status === "cancelled") {
      return new Response(
        JSON.stringify({ message: "予約がキャンセルされているため、通知はスキップされました" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Send SMS notification
    if (reservation.phone) {
      await sendSMS(reservation.phone, `予約が更新されました: ${reservationCode}`);
    }

    // Send email notification
    if (reservation.email) {
      await sendEmail(reservation.email, "予約更新通知", `予約が更新されました: ${reservationCode}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
};

serve(handler);
