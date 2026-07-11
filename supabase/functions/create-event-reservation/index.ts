// パブリックイベント予約の作成（即時確定）。
//
// 既存 create-reservation（貸切）との違い:
//   - 共有予約: 枠の定員から confirmed の人数合計を引いた残席の範囲で受け付ける
//   - 定員の直列化: SELECT ... FOR UPDATE OF s で枠行をロックし、同一枠への
//     同時予約をトランザクションで直列化する（既存のロック無しチェックは踏襲しない）
//   - 即時確定: pending / メール確認ステップなし。確定メールを送って完了
//   - email 必須（キャンセルリンクの配送先）

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import {
  calcRemaining,
  canAcceptReservation,
  generateEventReservationCode,
  validateEventReservationInput,
} from "../_shared/event-validation.ts";
import { formatJstDateLabel, formatTimeRange } from "../_shared/event-format.ts";
import { getJstTodayYmd } from "../_shared/date-jst.ts";
import { getClientIp, isRateLimited, recordAttempt } from "../_shared/rate-limit.ts";
import { buildSimpleEmailHtml, sendAppEmail } from "../_shared/lovable-email.ts";
import { sendLineGroupMessage } from "../_shared/line.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION = "event-create";
const IP_MAX = 10;     // 作成リクエスト per IP
const EMAIL_MAX = 5;   // 作成リクエスト per email
const WINDOW_MIN = 60;

// イベントごとの上限（max_guests_per_reservation）はトランザクション内で検証する。
// ここでは形式チェックとしてスキーマ上の絶対上限のみ適用する。
const ABSOLUTE_MAX_GUESTS = 20;

interface CreateEventReservationRequest {
  slotId?: unknown;
  guestName?: unknown;
  guestCount?: unknown;
  email?: unknown;
  phone?: unknown;
}

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

const errorWithStatus = (message: string, name: string) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

const buildConfirmationEmail = (params: {
  guestName: string;
  guestCount: number;
  eventTitle: string;
  venue: string | null;
  dateLabel: string;
  timeLabel: string;
  totalPrice: number;
  priceNote: string | null;
  reservationCode: string;
  detailUrl: string;
}) => {
  const priceLine = params.totalPrice > 0
    ? `料金: ${params.totalPrice.toLocaleString()}円（${params.priceNote || "当日現地払い"}）`
    : `料金: ${params.priceNote || "無料"}`;

  const text = `${params.guestName} 様

「${params.eventTitle}」のご予約が確定しました。

予約コード: ${params.reservationCode}
日時: ${params.dateLabel} ${params.timeLabel}${params.venue ? `\n会場: ${params.venue}` : ""}
人数: ${params.guestCount}名
${priceLine}

ご予約内容の確認・キャンセルは下記リンクからお手続きいただけます。
${params.detailUrl}

※当日のキャンセルはリンクからは行えません。直接お電話にてご連絡ください。

当日お会いできることを楽しみにしております。`;

  return {
    subject: `【${params.eventTitle}】ご予約確定のお知らせ`,
    text,
    html: buildSimpleEmailHtml("ご予約が確定しました", text),
  };
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Create event reservation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const body: CreateEventReservationRequest = await req.json().catch(() => ({}));

    const errors = validateEventReservationInput(body, ABSOLUTE_MAX_GUESTS);
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: errors.join(' / ') }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const slotId = body.slotId as string;
    const guestName = (body.guestName as string).trim();
    const guestCount = body.guestCount as number;
    const email = (body.email as string).trim();
    const phone = String(body.phone).trim();

    // スロットリング: 照合失敗の検知ではなく作成頻度の制限なので、全リクエストを
    // succeeded=false で記録する（rate-limit ヘルパは succeeded=false のみ数えるため）。
    const ip = getClientIp(req);
    const emailKey = email.toLowerCase();
    await recordAttempt(sql, ACTION, [ip, emailKey], false);
    if (await isRateLimited(sql, [
      { action: ACTION, identifier: ip, max: IP_MAX, windowMinutes: WINDOW_MIN },
      { action: ACTION, identifier: emailKey, max: EMAIL_MAX, windowMinutes: WINDOW_MIN },
    ])) {
      return new Response(
        JSON.stringify({ error: "リクエストが多すぎます。しばらく時間をおいて再度お試しください。" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    const result = await sql.begin(async (tx: typeof sql) => {
      // 枠行をロックして同一枠への同時予約を直列化する。
      // イベント情報は表示・検証用に同時取得（events 行はロックしない）。
      const slotRows = await tx`
        select s.id::text, s.date::text, s.start_time::text, s.end_time::text,
               s.capacity, s.is_active,
               e.title as event_title, e.slug as event_slug, e.venue as event_venue,
               e.status as event_status, e.price_per_person, e.price_note,
               e.max_guests_per_reservation
        from public.event_slots s
        join public.events e on e.id = s.event_id
        where s.id = ${slotId}::uuid
        for update of s
      `;
      const slot = slotRows[0];

      if (!slot || slot.event_status !== 'published' || !slot.is_active) {
        throw errorWithStatus("この枠は現在予約を受け付けていません", 'NotFoundError');
      }
      if (slot.date < getJstTodayYmd()) {
        throw errorWithStatus("過去の日程はご予約いただけません", 'ValidationError');
      }
      if (guestCount > slot.max_guests_per_reservation) {
        throw errorWithStatus(
          `1回のご予約は${slot.max_guests_per_reservation}名までです`,
          'ValidationError',
        );
      }

      const sumRows = await tx`
        select coalesce(sum(guest_count), 0)::int as taken
        from public.event_reservations
        where slot_id = ${slotId}::uuid
          and status = 'confirmed'
      `;
      const taken = sumRows[0]?.taken ?? 0;

      if (!canAcceptReservation(slot.capacity, taken, guestCount)) {
        const remaining = calcRemaining(slot.capacity, taken);
        throw errorWithStatus(
          remaining > 0
            ? `残席が不足しています（残り${remaining}名）`
            : "満席のためご予約いただけません",
          'CapacityError',
        );
      }

      const totalPrice = slot.price_per_person * guestCount;
      const accessToken = randomHex(32);

      let newReservation:
        | { id: string; reservation_code: string; access_token: string }
        | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const reservationCode = generateEventReservationCode();
        try {
          const inserted = await tx`
            insert into public.event_reservations (
              slot_id,
              guest_name,
              guest_count,
              email,
              phone,
              status,
              reservation_code,
              access_token,
              total_price,
              payment_status,
              payment_method
            ) values (
              ${slotId}::uuid,
              ${guestName},
              ${guestCount},
              ${email},
              ${phone},
              'confirmed',
              ${reservationCode},
              ${accessToken},
              ${totalPrice},
              'unpaid',
              'onsite'
            )
            returning id::text, reservation_code, access_token
          `;
          newReservation = inserted[0];
          break;
        } catch (error) {
          if (error instanceof Error && error.message.includes('event_reservations_reservation_code_key') && attempt < 9) continue;
          throw error;
        }
      }

      if (!newReservation) throw new Error("予約コードが生成されませんでした");

      return { newReservation, slot, totalPrice };
    });

    const { newReservation, slot, totalPrice } = result;
    console.log("Event reservation created:", newReservation.reservation_code);

    const baseUrl = Deno.env.get('APP_BASE_URL') ?? "https://www.u-sauna-private.com";
    const detailUrl = `${baseUrl}/events/reservation/${newReservation.reservation_code}?t=${newReservation.access_token}`;
    const dateLabel = formatJstDateLabel(slot.date);
    const timeLabel = formatTimeRange(slot.start_time, slot.end_time);

    // メール送信の失敗で予約を失敗扱いにしない。complete 画面に予約コードと
    // 詳細 URL を必ず表示するため、メール不達でも顧客側で救済できる。
    try {
      const mail = buildConfirmationEmail({
        guestName,
        guestCount,
        eventTitle: slot.event_title,
        venue: slot.event_venue,
        dateLabel,
        timeLabel,
        totalPrice,
        priceNote: slot.price_note,
        reservationCode: newReservation.reservation_code,
        detailUrl,
      });
      await sendAppEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        idempotencyKey: `event-reservation-confirmed-${newReservation.reservation_code}`,
        label: "event-reservation-confirmed",
      });
    } catch (error) {
      console.error("Confirmation email error:", error);
    }

    try {
      await sendLineGroupMessage(
        `【イベント予約】${slot.event_title}\n${dateLabel} ${timeLabel}\n${guestName} 様 ${guestCount}名（${newReservation.reservation_code}）`,
      );
    } catch (error) {
      console.error("LINE notification error:", error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reservationCode: newReservation.reservation_code,
        accessToken: newReservation.access_token,
        totalPrice,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Function error:", error);
    const err = error instanceof Error ? error : new Error("unknown");
    const status =
      err.name === 'CapacityError' ? 409 :
      err.name === 'NotFoundError' ? 404 :
      err.name === 'ValidationError' ? 400 : 500;
    return new Response(
      JSON.stringify({
        error: status === 500 ? "予約の作成に失敗しました" : err.message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status }
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
