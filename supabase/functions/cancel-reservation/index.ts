import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

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

    if (typeof reservationCode !== 'string' || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
      return new Response(
        JSON.stringify({ error: "予約コードの形式が正しくありません" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof phoneLastFourDigits !== 'string' || !/^\d{4}$/.test(phoneLastFourDigits)) {
      return new Response(
        JSON.stringify({ error: "電話番号は4桁の数字で入力してください" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rows = await sql`
      select id::text, date::text, phone, status
      from public.reservations
      where reservation_code = ${reservationCode}
      limit 1
    `;
    const reservation = rows[0];

    if (!reservation) {
      return new Response(
        JSON.stringify({ error: "予約が見つかりませんでした" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneDigits = (reservation.phone || '').replace(/\D/g, '');
    const last4Digits = phoneDigits.slice(-4);
    if (last4Digits.length !== 4 || !safeEqual(last4Digits, phoneLastFourDigits)) {
      return new Response(
        JSON.stringify({ error: "電話番号の下4桁が一致しません" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (reservation.date === todayStr) {
      return new Response(
        JSON.stringify({ error: "当日のキャンセルはできません。直接お電話にてご連絡ください。" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (reservation.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: "この予約は既にキャンセル済みです" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await sql`
      update public.reservations
      set status = 'cancelled',
          is_confirmed = true
      where id = ${reservation.id}::uuid
    `;

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
  } finally {
    await sql.end({ timeout: 1 });
  }
});
