import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { normalizeOptions, validateReservationInput } from "../_shared/reservation-validation.ts";
import { createPaymentLink, deletePaymentLink } from "../_shared/square.ts";
import { acquireSlotLock, TIME_SLOT_LABELS } from "../_shared/reservation-payment.ts";
import { formatJstDateLabel } from "../_shared/event-format.ts";
import { getClientIp, isRateLimited, recordAttempt } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 認証なし公開エンドポイントなので、SMS(仮予約通知)の乱用を防ぐレート制限を掛ける。
// create-event-reservation と同じ方針(全リクエストを succeeded=false で記録し、
// rate-limit ヘルパの sliding window で数える)。
const RL_ACTION = "reservation-create";
const RL_IP_MAX = 10;      // per IP / hour
const RL_PHONE_MAX = 5;    // per 電話番号 / hour
const RL_WINDOW_MIN = 60;

interface CreateReservationRequest {
  date: string;
  timeSlot: string;
  guestName: string;
  guestCount: number;
  email?: string;
  phone: string;
  waterTemperature: number;
  // 'onsite'(既定・従来フロー) / 'square_online'(事前決済: 支払い完了で確定)
  paymentMethod?: string;
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

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const randomHex = (bytes = 32) => {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('');
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

    const errors = validateReservationInput(body);

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: errors.join(' / ') }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const paymentMethod = body.paymentMethod ?? 'onsite';
    if (paymentMethod !== 'onsite' && paymentMethod !== 'square_online') {
      return new Response(
        JSON.stringify({ error: "支払い方法の指定が正しくありません" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    const isPrepaid = paymentMethod === 'square_online';

    console.log("Creating reservation for:", { date, timeSlot, guestName, guestCount, paymentMethod });

    const phoneStr = String(phone || '');

    // スロットリング: 作成頻度の制限なので全リクエストを succeeded=false で記録する
    // (rate-limit ヘルパは succeeded=false のみ数える)。番号は数字のみに正規化。
    const ip = getClientIp(req);
    const phoneKey = phoneStr.replace(/\D/g, '') || 'unknown';
    await recordAttempt(sql, RL_ACTION, [ip, phoneKey], false);
    if (await isRateLimited(sql, [
      { action: RL_ACTION, identifier: ip, max: RL_IP_MAX, windowMinutes: RL_WINDOW_MIN },
      { action: RL_ACTION, identifier: phoneKey, max: RL_PHONE_MAX, windowMinutes: RL_WINDOW_MIN },
    ])) {
      return new Response(
        JSON.stringify({ error: "リクエストが多すぎます。しばらく時間をおいて再度お試しください。" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    const result = await sql.begin(async (tx: typeof sql) => {
      // 枠単位の advisory lock で同一枠への並行作成・確定を直列化
      // (ロック順序は常に advisory → 行ロック)
      await acquireSlotLock(tx, date, timeSlot);

      // 貸切のブロック対象: 確定済み + 決済手続き中(期限内)のホールド。
      // 従来どおり plain pending(メール確認待ち)はブロックしない
      const existingReservations = await tx`
        select id
        from public.reservations
        where date = ${date}::date
          and time_slot = ${timeSlot}::public.time_slot
          and (status = 'confirmed'
               or (status = 'pending_payment' and expires_at > now()))
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
          const optionData = optionsData.find((option: OptionRow) => option.id === selectedOption.option_id);
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

      interface InsertedReservation {
        id: string;
        date: string;
        time_slot: string;
        guest_name: string;
        guest_count: number;
        email: string | null;
        phone: string;
        water_temperature: number;
        reservation_code: string;
        confirmation_token: string | null;
        access_token: string;
        total_price: number;
      }
      let newReservation: InsertedReservation | null = null;
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
              expires_at,
              payment_method
            ) values (
              ${date}::date,
              ${timeSlot}::public.time_slot,
              ${guestName.trim()},
              ${guestCount},
              ${email ? email.trim() : null},
              ${phoneStr.trim()},
              ${waterTemperature},
              ${isPrepaid ? 'pending_payment' : 'pending'},
              false,
              ${totalPrice},
              ${reservationCode},
              ${confirmationToken},
              ${accessToken},
              ${isPrepaid ? tx`now() + interval '20 minutes'` : tx`now() + interval '2 hours'`},
              ${paymentMethod}
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

      // 事前決済はメール確認リンクを使わないため、確認トークンを確実に無効化する。
      // トリガー set_reservation_code_and_expiration は BEFORE INSERT で
      // NULL のトークンを再生成するため、INSERT 後に同一トランザクション内で NULL 化する
      // (トリガーは UPDATE では発火しない: 本番定義で確認済み)
      if (isPrepaid) {
        await tx`
          update public.reservations
          set confirmation_token = null
          where id = ${newReservation.id}::uuid
        `;
        newReservation.confirmation_token = null;
      }

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
    console.log("Reservation created:", newReservation.reservation_code, isPrepaid ? "(prepaid)" : "(onsite)");

    if (isPrepaid) {
      // 決済リンク作成はトランザクション外(外部 API をロック中に呼ばない)。
      // 失敗したら予約を expired にして枠のホールドを即解放する
      const baseUrl = Deno.env.get('APP_BASE_URL') ?? "https://www.u-sauna-private.com";
      const redirectUrl =
        `${baseUrl}/reservation/${newReservation.reservation_code}?t=${newReservation.access_token}&from=checkout`;
      const slotLabel = TIME_SLOT_LABELS[newReservation.time_slot] ?? newReservation.time_slot;
      let link: { id: string; url: string; orderId: string } | null = null;
      try {
        link = await createPaymentLink({
          // 冪等キーはイベント側(link-)と衝突しないよう resv- プレフィックス
          idempotencyKey: `resv-link-${newReservation.reservation_code}`,
          itemName: `貸切サウナ ${formatJstDateLabel(newReservation.date)} ${slotLabel}（${newReservation.guest_count}名）`,
          quantity: 1,
          unitAmount: totalPrice,
          referenceId: newReservation.reservation_code,
          metadata: { kind: 'reservation', reservation_id: newReservation.id },
          redirectUrl,
        });
        await sql`
          update public.reservations
          set square_payment_link_id = ${link.id},
              square_order_id = ${link.orderId}
          where id = ${newReservation.id}::uuid
        `;
      } catch (error) {
        console.error("Payment link setup error:", error);
        await sql`
          update public.reservations
          set status = 'expired'
          where id = ${newReservation.id}::uuid
            and status = 'pending_payment'
        `;
        if (link) {
          try {
            await deletePaymentLink(link.id);
          } catch (deleteError) {
            console.error("deletePaymentLink error:", deleteError);
          }
        }
        return new Response(
          JSON.stringify({ error: "決済ページの作成に失敗しました。時間をおいて再度お試しください。" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      // 仮予約通知は送らない。確定通知は支払い完了(square-webhook)側で送る
      return new Response(
        JSON.stringify({
          success: true,
          checkout: true,
          checkoutUrl: link.url,
          reservationCode: newReservation.reservation_code,
          accessToken: newReservation.access_token,
          totalPrice,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

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
  } catch (error) {
    console.error("Function error:", error);
    const err = error instanceof Error ? error : new Error("予約の作成に失敗しました");
    return new Response(
      JSON.stringify({ error: err.message || "予約の作成に失敗しました" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: err.name === 'UnavailableError' ? 409 : 500
      }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
