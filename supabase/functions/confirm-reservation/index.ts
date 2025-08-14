import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  console.log("Request received:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Creating Supabase client...");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("Supabase URL exists:", !!supabaseUrl);
    console.log("Service role key exists:", !!supabaseServiceKey);
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    // Use service role key to bypass RLS for this operation
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json();
    console.log("Received token:", token);

    if (!token) {
      console.error("No token provided");
      throw new Error("Token is required");
    }

    // Find the reservation
    const { data: reservation, error: fetchError } = await supabaseClient
      .from("reservations")
      .select("*")
      .eq("confirmation_token", token)
      .single();

    console.log("Fetched reservation:", reservation);
    console.log("Fetch error:", fetchError);

    if (fetchError || !reservation) {
      console.error("Error finding reservation:", fetchError);
      throw new Error("Invalid or expired token");
    }

    // Update the reservation
    const { data: updatedReservation, error: updateError } = await supabaseClient
      .from("reservations")
      .update({
        is_confirmed: true,
        status: "confirmed",
        confirmation_token: null,
        expires_at: null,
      })
      .eq("id", reservation.id)
      .select();

    console.log("Updated reservation:", updatedReservation);
    console.log("Update error:", updateError);

    if (updateError || !updatedReservation || updatedReservation.length === 0) {
      console.error("Error updating reservation:", updateError);
      throw new Error("Failed to update reservation");
    }

    return new Response(
      JSON.stringify({
        success: true,
        reservation_code: updatedReservation[0].reservation_code,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in confirm-reservation function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 400,
      },
    );
  }
});