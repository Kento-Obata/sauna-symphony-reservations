/**
 * イベント予約のキャンセル料(画面表示用)。
 * サーバー側 supabase/functions/_shared/event-cancel-fee.ts と同じ計算。
 * 実際の返金額はサーバー側で決まるので、ここは案内表示にのみ使う。
 *   開催日の2日前まで: 無料 / 前日: 30% / 当日以降: 100%(1円未満切り捨て)
 */
import { addJstDays } from "@/utils/jstDate";

export const EVENT_CANCEL_FEE_RATE_DAY_BEFORE = 30;

export interface EventCancelFee {
  rate: number;
  fee: number;
  refundAmount: number;
}

export const calcEventCancelFee = (
  eventDate: string,
  todayJst: string,
  totalPrice: number,
): EventCancelFee => {
  const rate = eventDate >= addJstDays(todayJst, 2)
    ? 0
    : eventDate === addJstDays(todayJst, 1)
      ? EVENT_CANCEL_FEE_RATE_DAY_BEFORE
      : 100;
  const fee = Math.floor((totalPrice * rate) / 100);
  return { rate, fee, refundAmount: totalPrice - fee };
};
