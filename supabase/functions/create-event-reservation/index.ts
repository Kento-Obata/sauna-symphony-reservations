// パブリックイベント予約の作成。
//
// 既存 create-reservation（貸切）との違い:
//   - 共有予約: 枠の定員から占有人数（confirmed + 期限内 pending_payment）を引いた
//     残席の範囲で受け付ける
//   - 定員の直列化: SELECT ... FOR UPDATE OF s で枠行をロックし、同一枠への
//     同時予約をトランザクションで直列化する（既存のロック無しチェックは踏襲しない）
//   - email 必須（キャンセルリンクの配送先）
//
// 支払いフローはイベントの payment_type で分岐:
//   - onsite（または合計0円）: 即時確定。確定メール + LINE 通知
//   - prepaid: status='pending_payment' で20分席を確保し、Square の決済リンクを
//     作成して checkoutUrl を返す。確定・通知は square-webhook 側で行う

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
import { sendAppEmail } from "../_shared/lovable-email.ts";
import { sendLineGroupMessage } from "../_shared/line.ts";
import { createPaymentLink, deletePaymentLink } from "../_shared/square.ts";
import {
  buildEventConfirmationEmail,
  EventReservationNoticeRow,
} from "../_shared/event-payment.ts";

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
               e.max_guests_per_reservation, e.payment_type
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

      // 占有人数 = confirmed + 期限内の pending_payment（支払い手続き中も席を確保）
      const sumRows = await tx`
        select coalesce(sum(guest_count), 0)::int as taken
        from public.event_reservations
        where slot_id = ${slotId}::uuid
          and (status = 'confirmed'
               or (status = 'pending_payment' and expires_at > now()))
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
      // 0円の prepaid イベントは Square がリンクを作れないため即時確定にフォールバック。
      // prepaid は expires_at（20分）まで席を確保し、期限内の支払い完了で確定する。
      const isPrepaid = slot.payment_type === 'prepaid' && totalPrice > 0;
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
              payment_method,
              expires_at
            ) values (
              ${slotId}::uuid,
              ${guestName},
              ${guestCount},
              ${email},
              ${phone},
              ${isPrepaid ? 'pending_payment' : 'confirmed'},
              ${reservationCode},
              ${accessToken},
              ${totalPrice},
              'unpaid',
              ${isPrepaid ? 'square_online' : 'onsite'},
              ${isPrepaid ? tx`now() + interval '20 minutes'` : null}
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

      return { newReservation, slot, totalPrice, isPrepaid };
    });

    const { newReservation, slot, totalPrice, isPrepaid } = result;
    console.log("Event reservation created:", newReservation.reservation_code, isPrepaid ? "(prepaid)" : "(onsite)");

    const baseUrl = Deno.env.get('APP_BASE_URL') ?? "https://www.u-sauna-private.com";
    const dateLabel = formatJstDateLabel(slot.date);
    const timeLabel = formatTimeRange(slot.start_time, slot.end_time);

    if (isPrepaid) {
      // 決済リンク作成はトランザクション外（外部 API 呼び出しをロック中に行わない）。
      // 失敗したら予約を expired にして席を即解放する。
      const redirectUrl =
        `${baseUrl}/events/reservation/${newReservation.reservation_code}?t=${newReservation.access_token}&from=checkout`;
      let link: { id: string; url: string; orderId: string } | null = null;
      try {
        link = await createPaymentLink({
          idempotencyKey: `link-${newReservation.reservation_code}`,
          itemName: `${slot.event_title} ${dateLabel} ${timeLabel}（${guestCount}名）`,
          quantity: 1,
          unitAmount: totalPrice,
          referenceId: newReservation.reservation_code,
          metadata: { reservation_id: newReservation.id },
          redirectUrl,
        });
        await sql`
          update public.event_reservations
          set square_payment_link_id = ${link.id},
              square_order_id = ${link.orderId}
          where id = ${newReservation.id}::uuid
        `;
      } catch (error) {
        console.error("Payment link setup error:", error);
        await sql`
          update public.event_reservations
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

      // 確定メール・LINE 通知は支払い完了（square-webhook）側で送る
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

    // ---- onsite（即時確定）: 従来どおり確定メール + LINE 通知 ----
    const detailUrl = `${baseUrl}/events/reservation/${newReservation.reservation_code}?t=${newReservation.access_token}`;

    // メール送信の失敗で予約を失敗扱いにしない。complete 画面に予約コードと
    // 詳細 URL を必ず表示するため、メール不達でも顧客側で救済できる。
    try {
      const noticeRow: EventReservationNoticeRow = {
        id: newReservation.id,
        status: 'confirmed',
        payment_status: 'unpaid',
        guest_name: guestName,
        guest_count: guestCount,
        email,
        reservation_code: newReservation.reservation_code,
        access_token: newReservation.access_token,
        total_price: totalPrice,
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        event_title: slot.event_title,
        event_venue: slot.event_venue,
        price_note: slot.price_note,
      };
      const mail = buildEventConfirmationEmail({ reservation: noticeRow, detailUrl, paid: false });
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
