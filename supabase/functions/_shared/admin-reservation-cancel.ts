// 管理者による貸切予約のキャンセル(返金・お客様への通知まで)。
// 管理画面(admin-cancel-reservation)と AI エージェントの道具で共通。権限の確認は呼び出し側で行う。
//
// 管理者キャンセルに日付制限は設けない(当日対応・過去分の整理を想定)。
// 冪等キーは自己キャンセルと同じ resv-cancel-<code> → 二重返金しない。

import { sendAppEmail } from "./lovable-email.ts";
import { sendLineGroupMessage } from "./line.ts";
import { buildReservationCancellationNotice, cancelReservationRow } from "./reservation-payment.ts";
import { sendSMS } from "./twilio.ts";

// deno-lint-ignore no-explicit-any
type Sql = any; // postgresjs の接続(型パッケージ非導入のため)

// Twilio は E.164 形式(+81...)のみ受け付ける
export const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? "+81" + digits.slice(1) : digits;
};

export interface AdminCancelTarget {
  id: string;
  status: string;
  guest_name: string;
  guest_count: number;
  email: string | null;
  phone: string;
  payment_method: string | null;
  payment_status: string;
  square_payment_id: string | null;
  square_payment_link_id: string | null;
  total_price: number;
  reservation_code: string;
  date: string;
  time_slot: string;
}

export const loadAdminCancelTarget = async (
  sql: Sql,
  where: { id: string } | { code: string },
): Promise<AdminCancelTarget | null> => {
  const rows = await sql`
    select id::text, status, guest_name, guest_count, email, phone,
           payment_method, payment_status, square_payment_id, square_payment_link_id,
           total_price, reservation_code, date::text, time_slot::text
    from public.reservations
    where ${"id" in where ? sql`id = ${where.id}::uuid` : sql`reservation_code = ${where.code}`}
    limit 1
  `;
  return (rows[0] as AdminCancelTarget | undefined) ?? null;
};

export type AdminCancelResult =
  | { ok: true; refunded: boolean }
  | { ok: false; status: 400 | 500; error: string };

export const adminCancelReservation = async (
  sql: Sql,
  reservation: AdminCancelTarget,
  options: { notifyCustomer?: boolean } = {},
): Promise<AdminCancelResult> => {
  if (reservation.status === "cancelled") {
    return { ok: false, status: 400, error: "この予約は既にキャンセル済みです" };
  }
  if (reservation.status === "expired") {
    return { ok: false, status: 400, error: "この予約は期限切れのため操作不要です" };
  }

  let refunded = false;
  try {
    ({ refunded } = await cancelReservationRow(
      sql,
      reservation,
      "店舗都合・管理者操作によるキャンセル",
    ));
  } catch (error) {
    console.error("Refund error:", error);
    return { ok: false, status: 500, error: "返金処理に失敗しました。Square ダッシュボードをご確認ください。" };
  }

  // 顧客通知(SMS 必須・email あれば併送)。失敗してもキャンセルは成立
  if (options.notifyCustomer ?? true) {
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

  return { ok: true, refunded };
};
