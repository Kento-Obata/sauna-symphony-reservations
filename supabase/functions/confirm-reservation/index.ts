import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { acquireSlotLock } from "../_shared/reservation-payment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const { token } = await req.json();
    console.log("Received token:", token ? `${String(token).slice(0, 8)}...` : 'null');

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await sql.begin(async (tx: typeof sql) => {
      const reservations = await tx`
        select id::text, date::text, time_slot::text, guest_name, guest_count, email, phone, water_temperature, reservation_code, total_price, is_confirmed
        from public.reservations
        where confirmation_token = ${token}
        limit 1
      `;

      const reservation = reservations[0];
      if (!reservation) throw new Error("Invalid or expired token");

      if (reservation.is_confirmed) {
        return { reservation, alreadyConfirmed: true };
      }

      // 確定前に枠の競合を再確認する(従来はチェック無しで、複数の仮予約が
      // 全て確定できてしまう二重予約ギャップがあった)。
      // 事前決済のホールド(期限内 pending_payment)も先約としてブロックする
      await acquireSlotLock(tx, reservation.date, reservation.time_slot);
      const conflicts = await tx`
        select id from public.reservations
        where date = ${reservation.date}::date
          and time_slot = ${reservation.time_slot}::public.time_slot
          and id <> ${reservation.id}::uuid
          and (status = 'confirmed'
               or (status = 'pending_payment' and expires_at > now()))
        limit 1
      `;
      if (conflicts.length > 0) {
        const conflictError = new Error(
          "他のご予約が確定したため、この予約を確定できませんでした。恐れ入りますが、空き状況をご確認のうえ再度ご予約ください。",
        );
        conflictError.name = 'ConflictError';
        throw conflictError;
      }

      const updated = await tx`
        update public.reservations
        set is_confirmed = true,
            status = 'confirmed',
            confirmation_token = null,
            expires_at = null
        where id = ${reservation.id}::uuid
        returning reservation_code
      `;

      if (updated.length === 0) throw new Error("Failed to update reservation");
      return { reservation, alreadyConfirmed: false };
    });

    const { reservation, alreadyConfirmed } = result;

    if (!alreadyConfirmed) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && serviceKey) {
        fetch(`${supabaseUrl}/functions/v1/send-confirmation-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            date: reservation.date,
            timeSlot: reservation.time_slot,
            guestName: reservation.guest_name,
            guestCount: reservation.guest_count,
            email: reservation.email,
            phone: reservation.phone,
            waterTemperature: reservation.water_temperature,
            reservationCode: reservation.reservation_code,
            total_price: reservation.total_price,
          }),
        }).catch((notificationError) => console.error("Error sending notification:", notificationError));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reservation_code: reservation.reservation_code,
        alreadyConfirmed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in confirm-reservation function:", error);
    const status = error instanceof Error && error.name === 'ConflictError' ? 409 : 400;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "予約確認に失敗しました" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status },
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
});
