import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const handler = async (req: Request): Promise<Response> => {
  console.log("Get reservation by code function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const body = await req.json().catch(() => ({}));
    const { reservationCode, accessToken, phoneLastFourDigits } = body || {};

    if (!reservationCode || typeof reservationCode !== "string") {
      return new Response(
        JSON.stringify({ error: "予約コードが必要です" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("reservation_code", reservationCode)
      .maybeSingle();

    if (error) {
      console.error("Error fetching reservation:", error);
      throw error;
    }

    // Generic auth-required response — does not reveal whether the reservation exists
    const authRequired = () =>
      new Response(
        JSON.stringify({ error: "認証が必要です", requiresAuth: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );

    if (!reservation) {
      return authRequired();
    }

    // Verify access via signed token (preferred) or phone last 4 digits
    let authorized = false;

    if (accessToken && typeof accessToken === "string" && reservation.access_token) {
      if (safeEqual(accessToken, reservation.access_token)) {
        authorized = true;
      }
    }

    if (!authorized && phoneLastFourDigits && typeof phoneLastFourDigits === "string") {
      const digits = phoneLastFourDigits.replace(/\D/g, "");
      const phoneDigits = (reservation.phone || "").replace(/\D/g, "");
      const last4 = phoneDigits.slice(-4);
      if (digits.length === 4 && last4.length === 4 && safeEqual(digits, last4)) {
        authorized = true;
      }
    }

    if (!authorized) {
      console.log("Auth failed for reservation:", reservation.id);
      return authRequired();
    }

    // Strip access_token from response — it's a credential, not data
    const { access_token: _omit, ...safeReservation } = reservation as any;

    return new Response(
      JSON.stringify({ reservation: safeReservation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "予約情報の取得に失敗しました" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
};

serve(handler);
