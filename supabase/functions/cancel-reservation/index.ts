import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Cancel reservation function called");

    const { reservationCode, phoneLastFourDigits } = await req.json();

    if (!reservationCode || !phoneLastFourDigits) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "予約コードと電話番号が必要です" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (phoneLastFourDigits.length !== 4) {
      console.error("Invalid phone digits length");
      return new Response(
        JSON.stringify({ error: "電話番号は4桁で入力してください" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log(`Fetching reservation with code: ${reservationCode}`);

    // Fetch the reservation
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('reservation_code', reservationCode)
      .single();

    if (fetchError || !reservation) {
      console.error("Reservation not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "予約が見つかりませんでした" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found reservation for phone: ${reservation.phone}`);

    // Verify phone number last 4 digits
    const last4Digits = reservation.phone.slice(-4);
    if (last4Digits !== phoneLastFourDigits) {
      console.error("Phone verification failed");
      return new Response(
        JSON.stringify({ error: "電話番号の下4桁が一致しません" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already cancelled
    if (reservation.status === 'cancelled') {
      console.log("Reservation already cancelled");
      return new Response(
        JSON.stringify({ error: "この予約は既にキャンセル済みです" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Phone verification successful, cancelling reservation");

    // Update reservation to cancelled
    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({
        status: 'cancelled',
        is_confirmed: true // Prevent expiration processing
      })
      .eq('reservation_code', reservationCode);

    if (updateError) {
      console.error("Failed to cancel reservation:", updateError);
      return new Response(
        JSON.stringify({ error: "予約のキャンセルに失敗しました" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Reservation cancelled successfully");

    return new Response(
      JSON.stringify({ success: true, message: "予約をキャンセルしました" }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cancel-reservation function:', error);
    return new Response(
      JSON.stringify({ error: "予約のキャンセル処理中にエラーが発生しました" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
