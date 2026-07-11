// Square Webhook 受信（payment.updated）。事前決済予約の確定の「正」となるパス。
//
// - 署名検証: x-square-hmacsha256-signature = base64(HMAC-SHA256(通知URL + 生ボディ))。
//   生ボディは JSON.parse 前に確保する。通知URLは Square に登録した URL と完全一致が必要
//   （既定は SUPABASE_URL から組み立て。異なる場合は SQUARE_WEBHOOK_NOTIFICATION_URL で上書き）。
// - 冪等性: Square は最大11回/24h 再送する。確定処理は行ロック + 状態チェックで冪等、
//   メールは Resend の Idempotency-Key、返金は固定 idempotency key で重複排除。
// - 返金 API 失敗時は 500 を返して Square の再送に乗せる（payment_status が paid のままなので
//   再送時に再び返金分岐へ入る）。再送し尽くしても失敗が続く場合は LINE 警告が繰り返し届く
//   ので、Square ダッシュボードから手動返金する運用。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { refundPayment, verifySquareWebhookSignature } from "../_shared/square.ts";
import {
  buildEventConfirmationEmail,
  buildLatePaymentRefundEmail,
  confirmEventPaymentByOrderId,
} from "../_shared/event-payment.ts";
import {
  buildReservationLateRefundNotice,
  confirmReservationPaymentByOrderId,
  notifyReservationConfirmed,
} from "../_shared/reservation-payment.ts";
import { formatJstDateLabel, formatTimeRange } from "../_shared/event-format.ts";
import { sendAppEmail } from "../_shared/lovable-email.ts";
import { sendLineGroupMessage } from "../_shared/line.ts";
import { sendSMS } from "../_shared/twilio.ts";

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
    headers: { "Content-Type": "application/json" },
    status,
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  // 署名検証（生ボディで）
  const rawBody = new Uint8Array(await req.arrayBuffer());
  const signatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
  const notificationUrl = Deno.env.get("SQUARE_WEBHOOK_NOTIFICATION_URL") ??
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/square-webhook`;

  if (
    !signatureKey ||
    !(await verifySquareWebhookSignature({
      signatureHeader: req.headers.get("x-square-hmacsha256-signature"),
      notificationUrl,
      rawBody,
      signatureKey,
    }))
  ) {
    console.error("Webhook signature verification failed");
    return json({ error: "invalid signature" }, 401);
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  if (event.type !== "payment.updated") {
    return json({ received: true }, 200);
  }

  const payment = (event as {
    data?: { object?: { payment?: { id?: string; order_id?: string; status?: string } } };
  }).data?.object?.payment;
  if (payment?.status !== "COMPLETED" || !payment.order_id || !payment.id) {
    return json({ received: true }, 200);
  }

  const sql = getDb();
  try {
    const result = await confirmEventPaymentByOrderId(sql, payment.order_id, payment.id);

    // イベント側で照合できなかった注文は貸切予約(reservations)として処理を試みる。
    // square_order_id はアカウント全体で一意なため、両テーブルに同時一致することはない
    if (result.outcome === "noop") {
      const resvResult = await confirmReservationPaymentByOrderId(sql, payment.order_id, payment.id);

      if (resvResult.outcome === "confirmed") {
        const r = resvResult.reservation;
        console.log("Reservation payment confirmed:", r.reservation_code);
        // 既存の確定通知(email任意 + 顧客SMS + オーナーSMS + LINE)に委譲
        try {
          await notifyReservationConfirmed(r);
        } catch (error) {
          console.error("Reservation confirmation notification error:", error);
        }
        return json({ received: true }, 200);
      }

      if (resvResult.outcome === "needs_refund") {
        const r = resvResult.reservation;
        console.log("Late/invalid reservation payment, refunding:", r.reservation_code, resvResult.reason);

        // 返金失敗はこの catch に入らず 500 → Square が再送(冪等キーで安全)
        await refundPayment({
          paymentId: payment.id,
          amount: r.total_price,
          idempotencyKey: `resv-late-refund-${r.reservation_code}`,
          reason: "支払い期限切れ・キャンセル済み予約への入金のため自動返金",
        });
        await sql`
          update public.reservations
          set payment_status = 'refunded'
          where id = ${r.id}::uuid
        `;

        const notice = buildReservationLateRefundNotice(r);
        try {
          await sendSMS(formatPhoneNumber(r.phone), notice.sms);
        } catch (error) {
          console.error("Late refund SMS error:", error);
        }
        if (r.email) {
          try {
            await sendAppEmail({
              to: r.email,
              subject: notice.subject,
              html: notice.html,
              text: notice.text,
              idempotencyKey: `resv-late-refund-${r.reservation_code}`,
              label: "reservation-late-refund",
            });
          } catch (error) {
            console.error("Late refund email error:", error);
          }
        }
        try {
          await sendLineGroupMessage(
            `【要確認・自動返金】貸切予約\n${r.guest_name} 様（${r.reservation_code}）の入金を自動返金しました（理由: ${resvResult.reason}）。Square ダッシュボードで返金完了をご確認ください。`,
          );
        } catch (error) {
          console.error("LINE notification error:", error);
        }
        return json({ received: true, refunded: true }, 200);
      }

      return json({ received: true }, 200);
    }

    if (result.outcome === "confirmed") {
      const r = result.reservation;
      console.log("Payment confirmed:", r.reservation_code);

      const baseUrl = Deno.env.get('APP_BASE_URL') ?? "https://www.u-sauna-private.com";
      const detailUrl = `${baseUrl}/events/reservation/${r.reservation_code}?t=${r.access_token}`;
      try {
        const mail = buildEventConfirmationEmail({ reservation: r, detailUrl, paid: true });
        await sendAppEmail({
          to: r.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          idempotencyKey: `event-reservation-confirmed-${r.reservation_code}`,
          label: "event-reservation-confirmed",
        });
      } catch (error) {
        console.error("Confirmation email error:", error);
      }
      try {
        await sendLineGroupMessage(
          `【イベント予約】${r.event_title}\n${formatJstDateLabel(r.date)} ${formatTimeRange(r.start_time, r.end_time)}\n${r.guest_name} 様 ${r.guest_count}名（${r.reservation_code}・事前決済）`,
        );
      } catch (error) {
        console.error("LINE notification error:", error);
      }
      return json({ received: true }, 200);
    }

    if (result.outcome === "needs_refund") {
      const r = result.reservation;
      console.log("Late/invalid payment, refunding:", r.reservation_code, result.reason);

      // 返金に失敗したらこの catch には入れず 500 になり、Square が再送してくれる
      await refundPayment({
        paymentId: payment.id,
        amount: r.total_price,
        idempotencyKey: `late-refund-${r.reservation_code}`,
        reason: "支払い期限切れ・キャンセル済み予約への入金のため自動返金",
      });
      await sql`
        update public.event_reservations
        set payment_status = 'refunded'
        where id = ${r.id}::uuid
      `;

      try {
        const mail = buildLatePaymentRefundEmail({ reservation: r });
        await sendAppEmail({
          to: r.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          idempotencyKey: `event-late-refund-${r.reservation_code}`,
          label: "event-late-refund",
        });
      } catch (error) {
        console.error("Late refund email error:", error);
      }
      try {
        await sendLineGroupMessage(
          `【要確認・自動返金】${r.event_title}\n${r.guest_name} 様（${r.reservation_code}）の入金を自動返金しました（理由: ${result.reason}）。Square ダッシュボードで返金完了をご確認ください。`,
        );
      } catch (error) {
        console.error("LINE notification error:", error);
      }
      return json({ received: true, refunded: true }, 200);
    }

    return json({ received: true }, 200);
  } catch (error) {
    console.error("Webhook processing error:", error);
    // 500 で Square の再送に乗せる（確定・返金とも冪等なので安全）
    return json({ error: "processing failed" }, 500);
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
