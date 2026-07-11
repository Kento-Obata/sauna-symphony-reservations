// イベント予約の決済確定・キャンセルの共有ロジック。
//
// 確定処理は square-webhook と get-event-reservation(バックストップ)の両方から、
// キャンセル処理は cancel-event-reservation(自己)と admin-cancel-event-reservation
// (管理者)の両方から呼ばれるため、ここに単一実装を置く。
//
// 冪等性の設計:
//   - 確定: 行ロック(FOR UPDATE OF r)で Webhook 再送・並行実行を直列化し、
//     confirmed/refunded 済みは noop
//   - 返金: idempotency key を予約コードから固定生成(event-cancel-<code> /
//     late-refund-<code>)し、リトライしても二重返金しない
//   - メール: Resend の Idempotency-Key(event-reservation-confirmed-<code>)で重複排除

import { buildSimpleEmailHtml } from "./lovable-email.ts";
import { formatJstDateLabel, formatTimeRange } from "./event-format.ts";
import { deletePaymentLink, refundPayment } from "./square.ts";

// postgresjs のトランザクション/接続(型パッケージ非導入のため構造的に定義)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

export interface EventReservationNoticeRow {
  id: string;
  status: string;
  payment_status: string;
  guest_name: string;
  guest_count: number;
  email: string;
  reservation_code: string;
  access_token: string;
  total_price: number;
  date: string;
  start_time: string;
  end_time: string;
  event_title: string;
  event_venue: string | null;
  price_note: string | null;
}

export type ConfirmOutcome =
  | { outcome: "confirmed"; reservation: EventReservationNoticeRow }
  | {
    outcome: "needs_refund";
    reason: "expired" | "cancelled" | "capacity";
    reservation: EventReservationNoticeRow;
  }
  | { outcome: "noop" };

/**
 * Square の注文ID から予約を特定し、支払い完了として確定を試みる。
 * 枠を FOR UPDATE でロックして再集計するため、期限切れ後の入金でも
 * 席が残っていれば確定でき、残っていなければ needs_refund を返す。
 */
export const confirmEventPaymentByOrderId = async (
  sql: Sql,
  orderId: string,
  paymentId: string,
): Promise<ConfirmOutcome> => {
  return await sql.begin(async (tx: Sql) => {
    const rows = await tx`
      select r.id::text, r.status, r.payment_status, r.guest_name, r.guest_count, r.email,
             r.reservation_code, r.access_token, r.total_price,
             s.id::text as slot_id, s.capacity, s.date::text, s.start_time::text, s.end_time::text,
             e.title as event_title, e.venue as event_venue, e.price_note
      from public.event_reservations r
      join public.event_slots s on s.id = r.slot_id
      join public.events e on e.id = s.event_id
      where r.square_order_id = ${orderId}
      limit 1
      for update of s, r
    `;
    const row = rows[0] as (EventReservationNoticeRow & { slot_id: string; capacity: number }) | undefined;

    if (!row) {
      console.log("confirmEventPayment: unknown order", orderId);
      return { outcome: "noop" } as ConfirmOutcome;
    }
    if (row.status === "confirmed" || row.payment_status === "refunded") {
      return { outcome: "noop" } as ConfirmOutcome;
    }

    if (row.status === "cancelled" || row.status === "expired") {
      await tx`
        update public.event_reservations
        set square_payment_id = ${paymentId}
        where id = ${row.id}::uuid
      `;
      return {
        outcome: "needs_refund",
        reason: row.status as "cancelled" | "expired",
        reservation: row,
      } as ConfirmOutcome;
    }

    // pending_payment: 自分を除いた現在の占有数で再判定
    const sumRows = await tx`
      select coalesce(sum(guest_count), 0)::int as taken
      from public.event_reservations
      where slot_id = ${row.slot_id}::uuid
        and id <> ${row.id}::uuid
        and (status = 'confirmed'
             or (status = 'pending_payment' and expires_at > now()))
    `;
    const taken = sumRows[0]?.taken ?? 0;

    if (taken + row.guest_count <= row.capacity) {
      await tx`
        update public.event_reservations
        set status = 'confirmed',
            payment_status = 'paid',
            square_payment_id = ${paymentId},
            expires_at = null
        where id = ${row.id}::uuid
      `;
      return { outcome: "confirmed", reservation: row } as ConfirmOutcome;
    }

    // 期限切れ中に他の予約で埋まってしまったケース: 確定できないので返金対象
    await tx`
      update public.event_reservations
      set status = 'expired',
          square_payment_id = ${paymentId}
      where id = ${row.id}::uuid
    `;
    return { outcome: "needs_refund", reason: "capacity", reservation: row } as ConfirmOutcome;
  });
};

export interface CancelTargetRow {
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
 * キャンセルの共通コア。日付等の可否判定は呼び出し側で済ませてから呼ぶこと。
 * 支払い済み(square_online)の場合は返金成功後にのみ cancelled へ更新する
 * (返金失敗時は例外を投げ、予約は confirmed のまま残る = リトライ可能)。
 */
export const cancelEventReservationRow = async (
  sql: Sql,
  row: CancelTargetRow,
  reason: string,
): Promise<{ refunded: boolean }> => {
  if (row.status === "pending_payment") {
    if (row.square_payment_link_id) {
      // リンク削除で裏の注文もキャンセルされ、以後の支払いを防ぐ。
      // 失敗しても予約キャンセルは進める(遅延入金は webhook の自動返金網が受ける)
      try {
        await deletePaymentLink(row.square_payment_link_id);
      } catch (error) {
        console.error("deletePaymentLink error:", error);
      }
    }
    await sql`
      update public.event_reservations
      set status = 'cancelled', cancelled_at = now()
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
      idempotencyKey: `event-cancel-${row.reservation_code}`,
      reason,
    });
    await sql`
      update public.event_reservations
      set status = 'cancelled', cancelled_at = now(), payment_status = 'refunded'
      where id = ${row.id}::uuid
    `;
    return { refunded: true };
  }

  await sql`
    update public.event_reservations
    set status = 'cancelled', cancelled_at = now()
    where id = ${row.id}::uuid
  `;
  return { refunded: false };
};

// ============ メール文面 ============

export const buildEventConfirmationEmail = (params: {
  reservation: EventReservationNoticeRow;
  detailUrl: string;
  paid: boolean;
}) => {
  const { reservation: r, detailUrl, paid } = params;
  const dateLabel = formatJstDateLabel(r.date);
  const timeLabel = formatTimeRange(r.start_time, r.end_time);
  const priceLine = r.total_price > 0
    ? (paid
      ? `料金: ${r.total_price.toLocaleString()}円（事前決済済み）`
      : `料金: ${r.total_price.toLocaleString()}円（${r.price_note || "当日現地払い"}）`)
    : `料金: ${r.price_note || "無料"}`;

  const text = `${r.guest_name} 様

「${r.event_title}」のご予約が確定しました。

予約コード: ${r.reservation_code}
日時: ${dateLabel} ${timeLabel}${r.event_venue ? `\n会場: ${r.event_venue}` : ""}
人数: ${r.guest_count}名
${priceLine}

ご予約内容の確認・キャンセルは下記リンクからお手続きいただけます。
${detailUrl}

※当日のキャンセルはリンクからは行えません。直接お電話にてご連絡ください。${paid ? "\n※キャンセルの場合、お支払いいただいた料金は全額返金いたします。" : ""}

当日お会いできることを楽しみにしております。`;

  return {
    subject: `【${r.event_title}】ご予約確定のお知らせ`,
    text,
    html: buildSimpleEmailHtml("ご予約が確定しました", text),
  };
};

export const buildEventCancellationEmail = (params: {
  guestName: string;
  guestCount: number;
  eventTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  reservationCode: string;
  refunded: boolean;
}) => {
  const dateLabel = formatJstDateLabel(params.date);
  const timeLabel = formatTimeRange(params.startTime, params.endTime);
  const text = `${params.guestName} 様

「${params.eventTitle}」のご予約をキャンセルしました。

予約コード: ${params.reservationCode}
日時: ${dateLabel} ${timeLabel}
人数: ${params.guestCount}名${params.refunded ? "\n\nお支払いいただいた料金は全額返金いたします。カード会社により反映まで数日かかる場合があります。" : ""}

またのご利用をお待ちしております。`;

  return {
    subject: `【${params.eventTitle}】ご予約キャンセルのお知らせ`,
    text,
    html: buildSimpleEmailHtml("ご予約をキャンセルしました", text),
  };
};

export const buildLatePaymentRefundEmail = (params: {
  reservation: EventReservationNoticeRow;
}) => {
  const r = params.reservation;
  const dateLabel = formatJstDateLabel(r.date);
  const timeLabel = formatTimeRange(r.start_time, r.end_time);
  const text = `${r.guest_name} 様

「${r.event_title}」（${dateLabel} ${timeLabel}）のご予約について、
お支払いの確認が期限を過ぎていたため、ご予約を確定できませんでした。

お支払いいただいた料金は全額返金いたします。
カード会社により反映まで数日かかる場合があります。

ご迷惑をおかけし申し訳ございません。空き状況をご確認のうえ、あらためてご予約ください。`;

  return {
    subject: `【${r.event_title}】ご予約を確定できませんでした（全額返金いたします）`,
    text,
    html: buildSimpleEmailHtml("ご予約を確定できませんでした", text),
  };
};
