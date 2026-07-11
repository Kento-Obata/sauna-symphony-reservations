// イベント予約の照会（確定メール内リンクの access_token で認証）。
// 予約詳細ページ /events/reservation/:code?t=... から呼ばれる。
// access_token はレスポンスから除去する（get-reservation-by-code と同方針）。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { getClientIp, isRateLimited, recordAttempt } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION = "event-lookup";
const CODE_MAX = 5;   // failed attempts per reservation code
const IP_MAX = 20;    // failed attempts per IP
const WINDOW_MIN = 15;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Get event reservation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const body = await req.json().catch(() => ({}));
    const { reservationCode, accessToken } = body || {};

    if (typeof reservationCode !== 'string' || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
      return new Response(
        JSON.stringify({ error: "予約コードが必要です" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const ip = getClientIp(req);
    if (await isRateLimited(sql, [
      { action: ACTION, identifier: reservationCode, max: CODE_MAX, windowMinutes: WINDOW_MIN },
      { action: ACTION, identifier: ip, max: IP_MAX, windowMinutes: WINDOW_MIN },
    ])) {
      return new Response(
        JSON.stringify({ error: "試行回数が多すぎます。しばらく時間をおいて再度お試しください。" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    const rows = await sql`
      select r.id::text, r.guest_name, r.guest_count, r.email, r.phone, r.status,
             r.reservation_code, r.total_price, r.payment_status, r.created_at,
             r.cancelled_at, r.access_token,
             s.date::text, s.start_time::text, s.end_time::text,
             e.title as event_title, e.slug as event_slug, e.venue as event_venue,
             e.price_note
      from public.event_reservations r
      join public.event_slots s on s.id = r.slot_id
      join public.events e on e.id = s.event_id
      where r.reservation_code = ${reservationCode}
      limit 1
    `;
    const reservation = rows[0];

    const authRequired = () =>
      new Response(
        JSON.stringify({ error: "認証が必要です。メール内のリンクからアクセスしてください。" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );

    if (!reservation) {
      await recordAttempt(sql, ACTION, [ip], false);
      return authRequired();
    }

    if (
      typeof accessToken !== 'string' ||
      !safeEqual(accessToken, reservation.access_token)
    ) {
      await recordAttempt(sql, ACTION, [reservationCode, ip], false);
      return authRequired();
    }

    const { access_token: _omit, ...safeReservation } = reservation as Record<string, unknown>;

    return new Response(
      JSON.stringify({ reservation: safeReservation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "予約情報の取得に失敗しました" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
