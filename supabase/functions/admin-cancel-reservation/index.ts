// 管理者による貸切予約キャンセル。
//
// 管理画面から支払い済み(Square 事前決済)予約をキャンセルする際は、
// 直接の DB UPDATE では返金がスキップされるため必ずこの関数を経由する。
// (未払い予約の直接 UPDATE は従来どおり許容 — フロント側でルーティングする)
//
// 認証: verify_jwt=true + 関数内で profiles.role='admin' を検証(_shared/admin-auth.ts)。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { isValidUuid } from "../_shared/event-validation.ts";
import { sendAppEmail } from "../_shared/lovable-email.ts";
import { sendSMS } from "../_shared/twilio.ts";
import { sendLineGroupMessage } from "../_shared/line.ts";
import {
  buildReservationCancellationNotice,
  cancelReservationRow,
} from "../_shared/reservation-payment.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? '+81' + digits.slice(1) : digits;
};

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const handler = async (req: Request): Promise<Response> => {
  console.log("Admin cancel reservation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const auth = await requireAdmin(req, sql);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const body = await req.json().catch(() => ({}));
    const { reservationId } = body || {};
    if (!isValidUuid(reservationId)) {
      return json({ error: "予約の指定が正しくありません" }, 400);
    }

    const rows = await sql`
      select id::text, status, guest_name, guest_count, email, phone,
             payment_method, payment_status, square_payment_id, square_payment_link_id,
             total_price, reservation_code, date::text, time_slot::text
      from public.reservations
      where id = ${reservationId}::uuid
      limit 1
    `;
    const reservation = rows[0];

    if (!reservation) {
      return json({ error: "予約が見つかりませんでした" }, 404);
    }
    if (reservation.status === 'cancelled') {
      return json({ error: "この予約は既にキャンセル済みです" }, 400);
    }
    if (reservation.status === 'expired') {
      return json({ error: "この予約は期限切れのため操作不要です" }, 400);
    }

    // 管理者キャンセルに日付制限は設けない(当日対応・過去分の整理を想定)。
    // 冪等キーは自己キャンセルと同じ resv-cancel-<code> → 二重返金しない
    let refunded = false;
    try {
      ({ refunded } = await cancelReservationRow(
        sql,
        reservation,
        "店舗都合・管理者操作によるキャンセル",
      ));
    } catch (error) {
      console.error("Refund error:", error);
      return json({ error: "返金処理に失敗しました。Square ダッシュボードをご確認ください。" }, 500);
    }

    // 顧客通知(SMS 必須・email あれば併送)。失敗してもキャンセルは成立
    const notice = buildReservationCancellationNotice({
      guestName: reservation.guest_name,
      date: reservation.date,
      timeSlot: reservation.time_slot,
      reservationCode: reservation.reservation_code,
      refunded,
    });
    try {
      await sendSMS(formatPhoneNumber(reservation.phone), notice.sms);
    } catch (error) {
      console.error("Cancellation SMS error:", error);
    }
    if (reservation.email) {
      try {
        await sendAppEmail({
          to: reservation.email,
          subject: notice.subject,
          html: notice.html,
          text: notice.text,
          idempotencyKey: `resv-cancelled-${reservation.reservation_code}`,
          label: "reservation-cancelled",
        });
      } catch (error) {
        console.error("Cancellation email error:", error);
      }
    }
    if (refunded) {
      try {
        await sendLineGroupMessage(
          `【返金キャンセル】貸切予約(管理者操作)\n${reservation.guest_name} 様（${reservation.reservation_code}・${reservation.date}）のキャンセルに伴い、¥${Number(reservation.total_price).toLocaleString()} を自動返金しました。`,
        );
      } catch (error) {
        console.error("LINE notification error:", error);
      }
    }

    return json({ success: true, refunded }, 200);
  } catch (error) {
    console.error('Error in admin-cancel-reservation function:', error);
    return json({ error: "キャンセル処理中にエラーが発生しました" }, 500);
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
