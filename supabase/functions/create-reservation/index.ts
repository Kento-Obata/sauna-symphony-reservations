import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateReservationRequest {
  date: string;
  timeSlot: string;
  guestName: string;
  guestCount: number;
  email?: string;
  phone: string;
  waterTemperature: number;
  selectedOptions?: Array<{
    option_id: string;
    quantity: number;
  }>;
}

type OptionRow = {
  id: string;
  price_per_person: number;
  pricing_type: 'per_person' | 'flat' | 'per_guest';
  flat_price: number | null;
};

const validTimeSlots = new Set(['morning', 'afternoon', 'evening', 'night']);

const getDb = () => {
  const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const randomHex = (bytes = 32) => {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const normalizeOptions = (selectedOptions: CreateReservationRequest['selectedOptions']) => {
  if (!selectedOptions) return [];
  if (!Array.isArray(selectedOptions)) throw new Error('オプションの形式が不正です');
  return selectedOptions
    .filter((option) => option && typeof option.option_id === 'string')
    .map((option) => ({
      option_id: option.option_id,
      quantity: Number.isInteger(option.quantity) && option.quantity > 0 ? option.quantity : 1,
    }));
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Create reservation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const body: CreateReservationRequest = await req.json();
    const { date, timeSlot, guestName, guestCount, email, phone, waterTemperature } = body;
    const selectedOptions = normalizeOptions(body.selectedOptions);

    const errors: string[] = [];
    if (!date || !timeSlot || !guestName || !guestCount || !phone) errors.push("必須項目が入力されていません");
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("日付の形式が正しくありません");
    if (typeof timeSlot !== 'string' || !validTimeSlots.has(timeSlot)) errors.push("時間帯が不正です");
    if (typeof guestName !== 'string' || guestName.trim().length === 0 || guestName.length > 100) errors.push("お名前は1〜100文字で入力してください");
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 6) errors.push("人数が不正です");

    const phoneStr = String(phone || '');
    const phoneDigits = phoneStr.replace(/[^\d]/g, '');
    if (!/^[\d\-+()\s]{10,20}$/.test(phoneStr) || phoneDigits.length < 10 || phoneDigits.length > 15) {
      errors.push("電話番号の形式が正しくありません");
    }
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("メールアドレスの形式が正しくありません");
      }
    }
    if (!Number.isInteger(waterTemperature) || waterTemperature < 2 || waterTemperature > 17) {
      errors.push("水温が不正です");
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: errors.join(' / ') }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Creating reservation for:", { date, timeSlot, guestName, guestCount });

    const result = await sql.begin(async (tx) => {
      const existingReservations = await tx`
        select id
        from public.reservations
        where date = ${date}::date
          and time_slot = ${timeSlot}::public.time_slot
          and status = 'confirmed'
        limit 1
      `;

      if (existingReservations.length > 0) {
        const unavailableError = new Error("この時間帯はすでに予約が入っています");
        unavailableError.name = 'UnavailableError';
        throw unavailableError;
      }

      const priceRows = await tx`
        select price_per_person
        from public.price_settings
        where guest_count = ${guestCount}
        limit 1
      `;
      const basePrice = (priceRows[0]?.price_per_person ?? 3000) * guestCount;

      let optionsTotalPrice = 0;
      const reservationOptionsData: Array<{ option_id: string; quantity: number; total_price: number }> = [];

      if (selectedOptions.length > 0) {
        const optionIds = selectedOptions.map((option) => option.option_id);
        const optionsData = await tx<OptionRow[]>`
          select id::text, price_per_person, pricing_type::text, flat_price
          from public.options
          where id in ${tx(optionIds)}
            and is_active = true
        `;

        for (const selectedOption of selectedOptions) {
          const optionData = optionsData.find((option) => option.id === selectedOption.option_id);
          if (!optionData) continue;

          const effectiveQuantity = optionData.pricing_type === 'per_guest'
            ? guestCount
            : selectedOption.quantity;
          const optionPrice = optionData.pricing_type === 'flat'
            ? optionData.flat_price || 0
            : optionData.price_per_person * effectiveQuantity;

          optionsTotalPrice += optionPrice;
          reservationOptionsData.push({
            option_id: selectedOption.option_id,
            quantity: effectiveQuantity,
            total_price: optionPrice,
          });
        }
      }

      const totalPrice = basePrice + optionsTotalPrice;
      const confirmationToken = randomHex(32);
      const accessToken = randomHex(32);

      let newReservation: any | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const codeRows = await tx`select public.generate_reservation_code() as code`;
        const reservationCode = codeRows[0]?.code;
        try {
          const inserted = await tx`
            insert into public.reservations (
              date,
              time_slot,
              guest_name,
              guest_count,
              email,
              phone,
              water_temperature,
              status,
              is_confirmed,
              total_price,
              reservation_code,
              confirmation_token,
              access_token,
              expires_at
            ) values (
              ${date}::date,
              ${timeSlot}::public.time_slot,
              ${guestName.trim()},
              ${guestCount},
              ${email ? email.trim() : null},
              ${phoneStr.trim()},
              ${waterTemperature},
              'pending',
              false,
              ${totalPrice},
              ${reservationCode},
              ${confirmationToken},
              ${accessToken},
              now() + interval '2 hours'
            )
            returning id::text, date::text, time_slot::text, guest_name, guest_count, email, phone, water_temperature, reservation_code, confirmation_token, access_token, total_price
          `;
          newReservation = inserted[0];
          break;
        } catch (error) {
          if (error instanceof Error && error.message.includes('reservations_reservation_code_key') && attempt < 9) continue;
          throw error;
        }
      }

      if (!newReservation) throw new Error("予約コードまたは確認トークンが生成されませんでした");

      if (reservationOptionsData.length > 0) {
        for (const option of reservationOptionsData) {
          await tx`
            insert into public.reservation_options (reservation_id, option_id, quantity, total_price)
            values (${newReservation.id}::uuid, ${option.option_id}::uuid, ${option.quantity}, ${option.total_price})
            on conflict (reservation_id, option_id) do update
            set quantity = excluded.quantity,
                total_price = excluded.total_price
          `;
        }
      }

      return { newReservation, totalPrice };
    });

    const { newReservation, totalPrice } = result;
    console.log("Reservation created:", newReservation.reservation_code);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceKey) {
      fetch(`${supabaseUrl}/functions/v1/send-pending-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          date: newReservation.date,
          timeSlot: newReservation.time_slot,
          guestName: newReservation.guest_name,
          guestCount: newReservation.guest_count,
          email: newReservation.email,
          phone: newReservation.phone,
          waterTemperature: newReservation.water_temperature,
          reservationCode: newReservation.reservation_code,
          confirmationToken: newReservation.confirmation_token,
          reservationDate: newReservation.date,
          total_price: totalPrice,
          options: selectedOptions,
        }),
      }).catch((err) => console.error("Notification error:", err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        reservationCode: newReservation.reservation_code,
        confirmationToken: newReservation.confirmation_token,
        accessToken: newReservation.access_token,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "予約の作成に失敗しました" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error?.name === 'UnavailableError' ? 409 : 500
      }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
