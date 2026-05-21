import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constant-time comparison to mitigate timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Cancel reservation function called");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: "リクエストが不正です" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { reservationCode, phoneLastFourDigits } = body as Record<string, unknown>;

    // Validate reservation code: 8 alphanumeric chars (matches generate_reservation_code)
    if (typeof reservationCode !== 'string' || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
      return new Response(
        JSON.stringify({ error: "予約コードの形式が正しくありません" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone last 4 digits: exactly 4 digits
    if (typeof phoneLastFourDigits !== 'string' || !/^\d{4}$/.test(phoneLastFourDigits)) {
      return new Response(
        JSON.stringify({ error: "電話番号は4桁の数字で入力してください" }),
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

    // Verify phone number last 4 digits with constant-time comparison
    const last4Digits = (reservation.phone || '').slice(-4);
    if (last4Digits.length !== 4 || !safeEqual(last4Digits, phoneLastFourDigits)) {
      console.error("Phone verification failed");
      return new Response(
        JSON.stringify({ error: "電話番号の下4桁が一致しません" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if reservation is today (same-day cancellation not allowed)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (reservation.date === todayStr) {
      console.log("Same-day cancellation not allowed");
      return new Response(
        JSON.stringify({ error: "当日のキャンセルはできません。直接お電話にてご連絡ください。" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
