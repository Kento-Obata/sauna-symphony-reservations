// 貸切予約(reservations テーブル)の Square 事前決済の共有ロジック。
// event-payment.ts(イベント用)の貸切版。主な違い:
//   - 枠行が存在しないため、排他は date+time_slot の advisory lock で直列化する
//   - 貸切なので再チェックは「他に confirmed が居ないか」のみ(先に支払った者が勝つ)
//   - 通知はメール任意・SMS 必須(既存 send-confirmation-notification に委譲)
//
// 冪等キーはイベント側と衝突しないよう必ず resv- プレフィックスを付ける
// (予約コードは両者とも [A-Z0-9]{8} で、Square の冪等キーはアカウント全体で共有のため)。

import { buildSimpleEmailHtml } from "./lovable-email.ts";
import { formatJstDateLabel } from "./event-format.ts";
import { deletePaymentLink, refundPayment } from "./square.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any; // postgresjs のトランザクション/接続(型パッケージ非導入のため)

export const TIME_SLOT_LABELS: Record<string, string> = {
  morning: "午前",
  afternoon: "午後",
  evening: "夕方",
  night: "夜",
};

/**
 * 枠(date + time_slot)単位の advisory lock。
 * create-reservation / confirm-reservation / Webhook確定 の各トランザクション先頭で
 * 取得することで、同一枠への並行操作を直列化する。
 * ロック順序は常に「advisory lock → 行ロック」で統一すること(デッドロック防止)。
 */
export const acquireSlotLock = async (tx: Sql, date: string, timeSlot: string): Promise<void> => {
  await tx`
    select pg_advisory_xact_lock(
      hashtextextended('resv-slot|' || ${date} || '|' || ${timeSlot}, 0)
    )
  `;
};

export interface ReservationNoticeRow {
  id: string;
  status: string;
  payment_status: string;
  guest_name: string;
  guest_count: number;
  email: string | null;
  phone: string;
  water_temperature: number;
  reservation_code: string;
  access_token: string | null;
  total_price: number;
  date: string;
  time_slot: string;
}

export type ReservationConfirmOutcome =
  | { outcome: "confirmed"; reservation: ReservationNoticeRow }
  | {
    outcome: "needs_refund";
    reason: "expired" | "cancelled" | "slot_taken";
    reservation: ReservationNoticeRow;
  }
  | { outcome: "noop" };

/**
 * Square の注文IDから貸切予約を特定し、支払い完了として確定を試みる。
 * 期限切れでも枠が空いていれば救済確定する(イベントと同じ)。
 * 枠が confirmed で埋まっていた場合は expired 化して needs_refund を返す。
 */
export const confirmReservationPaymentByOrderId = async (
  sql: Sql,
  orderId: string,
  paymentId: string,
): Promise<ReservationConfirmOutcome> => {
  return await sql.begin(async (tx: Sql) => {
    // 1) ロック無しで行の所在と枠を知る
    const pre = await tx`
      select id::text, date::text, time_slot::text
      from public.reservations
      where square_order_id = ${orderId}
      limit 1
    `;
    if (!pre[0]) {
      console.log("confirmReservationPayment: unknown order", orderId);
      return { outcome: "noop" } as ReservationConfirmOutcome;
    }

    // 2) 枠の advisory lock → 3) 行ロック付きで最新状態を再取得
    await acquireSlotLock(tx, pre[0].date, pre[0].time_slot);
    const rows = await tx`
      select id::text, status, payment_status, guest_name, guest_count, email, phone,
             water_temperature, reservation_code, access_token,
             total_price::int as total_price,
             date::text, time_slot::text
      from public.reservations
      where id = ${pre[0].id}::uuid
      for update
    `;
    const row = rows[0] as ReservationNoticeRow | undefined;
    if (!row) return { outcome: "noop" } as ReservationConfirmOutcome;

    if (row.status === "confirmed" || row.payment_status === "refunded") {
      return { outcome: "noop" } as ReservationConfirmOutcome;
    }

    if (row.status === "cancelled" || row.status === "expired") {
      await tx`
        update public.reservations
        set square_payment_id = ${paymentId}
        where id = ${row.id}::uuid
      `;
      return {
        outcome: "needs_refund",
        reason: row.status as "cancelled" | "expired",
        reservation: row,
      } as ReservationConfirmOutcome;
    }

    // pending_payment: 貸切なので「他に confirmed が居ないか」だけ再確認。
    // 他の pending_payment はブロックしない(先に支払った者が勝つ)
    const conflict = await tx`
      select id from public.reservations
      where date = ${row.date}::date
        and time_slot = ${row.time_slot}::public.time_slot
        and status = 'confirmed'
        and id <> ${row.id}::uuid
      limit 1
    `;
    if (conflict.length > 0) {
      await tx`
        update public.reservations
        set status = 'expired', square_payment_id = ${paymentId}
        where id = ${row.id}::uuid
      `;
      return {
        outcome: "needs_refund",
        reason: "slot_taken",
        reservation: row,
      } as ReservationConfirmOutcome;
    }

    // 確定。is_confirmed=true により cleanup_expired_reservations の DELETE 対象からも外れる
    await tx`
      update public.reservations
      set status = 'confirmed',
          is_confirmed = true,
          payment_status = 'paid',
          square_payment_id = ${paymentId},
          expires_at = null
      where id = ${row.id}::uuid
    `;
    return { outcome: "confirmed", reservation: row } as ReservationConfirmOutcome;
  });
};

/**
 * 確定通知。既存 send-confirmation-notification(email任意 + 顧客SMS +
 * オーナーSMS + LINE)に委譲する。body 形は confirm-reservation と同一。
 */
export const notifyReservationConfirmed = async (r: ReservationNoticeRow): Promise<void> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('Missing SUPABASE_URL / SERVICE_ROLE_KEY');
  const response = await fetch(`${supabaseUrl}/functions/v1/send-confirmation-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      date: r.date,
      timeSlot: r.time_slot,
      guestName: r.guest_name,
      guestCount: r.guest_count,
      email: r.email,
      phone: r.phone,
      waterTemperature: r.water_temperature,
      reservationCode: r.reservation_code,
      total_price: r.total_price,
    }),
  });
  if (!response.ok) {
    throw new Error(`send-confirmation-notification failed: ${response.status}`);
  }
};

export interface ReservationCancelTarget {
  id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  square_payment_id: string | null;
  square_payment_link_id: string | null;
  total_price: number;
  reservation_code: string;
}

/**
 * 貸切キャンセルの共通コア。可否判定(当日ブロック等)は呼び出し側で済ませてから呼ぶ。
 * 支払い済み(square_online)は返金成功後にのみ cancelled へ更新する
 * (返金失敗時は例外を投げ、予約は confirmed のまま = リトライ可能)。
 * いずれも is_confirmed=true / expires_at=null を設定し、
 * cleanup_expired_reservations の DELETE から保護する(既存 cancel-reservation と同挙動)。
 */
export const cancelReservationRow = async (
  sql: Sql,
  row: ReservationCancelTarget,
  reason: string,
): Promise<{ refunded: boolean }> => {
  if (row.status === "pending_payment") {
    if (row.square_payment_link_id) {
      try {
        await deletePaymentLink(row.square_payment_link_id);
      } catch (error) {
        console.error("deletePaymentLink error:", error);
      }
    }
    await sql`
      update public.reservations
      set status = 'cancelled', is_confirmed = true, expires_at = null
      where id = ${row.id}::uuid
    `;
    return { refunded: false };
  }

  const needsRefund = row.payment_status === "paid" &&
    row.payment_method === "square_online" &&
    !!row.square_payment_id;

  if (needsRefund) {
    await refundPayment({
      paymentId: row.square_payment_id!,
      amount: row.total_price,
      idempotencyKey: `resv-cancel-${row.reservation_code}`,
      reason,
    });
    await sql`
      update public.reservations
      set status = 'cancelled', is_confirmed = true, expires_at = null,
          payment_status = 'refunded'
      where id = ${row.id}::uuid
    `;
    return { refunded: true };
  }

  await sql`
    update public.reservations
    set status = 'cancelled', is_confirmed = true, expires_at = null
    where id = ${row.id}::uuid
  `;
  return { refunded: false };
};

/** 期限後入金の自動返金通知(SMS 本文 + email 文面)。 */
export const buildReservationLateRefundNotice = (r: ReservationNoticeRow) => {
  const dateLabel = formatJstDateLabel(r.date);
  const slotLabel = TIME_SLOT_LABELS[r.time_slot] ?? r.time_slot;
  const sms =
    `【サウナU】${dateLabel} ${slotLabel}のご予約(${r.reservation_code})は、お支払いの確認が期限を過ぎていたため確定できませんでした。お支払いいただいた料金は全額返金いたします(反映まで数日かかる場合があります)。お手数ですが再度ご予約ください。`;

  const emailText = `${r.guest_name} 様

${dateLabel} ${slotLabel}のご予約(予約コード: ${r.reservation_code})について、
お支払いの確認が期限を過ぎていたため、ご予約を確定できませんでした。

お支払いいただいた料金は全額返金いたします。
カード会社により反映まで数日かかる場合があります。

ご迷惑をおかけし申し訳ございません。空き状況をご確認のうえ、あらためてご予約ください。`;

  return {
    sms,
    subject: "【サウナU】ご予約を確定できませんでした(全額返金いたします)",
    text: emailText,
    html: buildSimpleEmailHtml("ご予約を確定できませんでした", emailText),
  };
};

/** キャンセル通知(SMS 本文 + email 文面)。管理者キャンセル・返金キャンセルで使用。 */
export const buildReservationCancellationNotice = (params: {
  guestName: string;
  date: string;
  timeSlot: string;
  reservationCode: string;
  refunded: boolean;
}) => {
  const dateLabel = formatJstDateLabel(params.date);
  const slotLabel = TIME_SLOT_LABELS[params.timeSlot] ?? params.timeSlot;
  const refundLine = params.refunded
    ? "お支払いいただいた料金は全額返金いたします(反映まで数日かかる場合があります)。"
    : "";
  const sms =
    `【サウナU】${dateLabel} ${slotLabel}のご予約(${params.reservationCode})をキャンセルしました。${refundLine}またのご利用をお待ちしております。`;

  const emailText = `${params.guestName} 様

${dateLabel} ${slotLabel}のご予約(予約コード: ${params.reservationCode})をキャンセルしました。
${refundLine ? `\n${refundLine}\n` : ""}
またのご利用をお待ちしております。`;

  return {
    sms,
    subject: "【サウナU】ご予約キャンセルのお知らせ",
    text: emailText,
    html: buildSimpleEmailHtml("ご予約をキャンセルしました", emailText),
  };
};
