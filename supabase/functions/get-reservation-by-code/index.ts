import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const getDb = () => {
  const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Get reservation by code function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const body = await req.json().catch(() => ({}));
    const { reservationCode, accessToken, phoneLastFourDigits } = body || {};

    if (typeof reservationCode !== "string" || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
      return new Response(
        JSON.stringify({ error: "予約コードが必要です" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const rows = await sql`
      select id::text, date::text, time_slot::text, guest_name, guest_count, email, phone, water_temperature,
             created_at, reservation_code, status, is_confirmed, confirmation_token, expires_at, total_price,
             admin_memo, admin_memo_updated_at, admin_memo_updated_by::text, access_token
      from public.reservations
      where reservation_code = ${reservationCode}
      limit 1
    `;
    const reservation = rows[0];

    const authRequired = () =>
      new Response(
        JSON.stringify({ error: "認証が必要です", requiresAuth: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );

    if (!reservation) return authRequired();

    let authorized = false;

    if (accessToken && typeof accessToken === "string" && reservation.access_token) {
      if (safeEqual(accessToken, reservation.access_token)) authorized = true;
    }

    if (!authorized && phoneLastFourDigits && typeof phoneLastFourDigits === "string") {
      const digits = phoneLastFourDigits.replace(/\D/g, "");
      const phoneDigits = (reservation.phone || "").replace(/\D/g, "");
      const last4 = phoneDigits.slice(-4);
      if (digits.length === 4 && last4.length === 4 && safeEqual(digits, last4)) authorized = true;
    }

    if (!authorized) {
      console.log("Auth failed for reservation:", reservation.id);
      return authRequired();
    }

    const { access_token: _omit, ...safeReservation } = reservation as Record<string, unknown>;

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
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
