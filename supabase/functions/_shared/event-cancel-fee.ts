// イベント予約のキャンセル料(お客様都合)。
//
// ポリシー(画面: src/utils/eventCancelFee.ts / 文面: event-notice.ts と揃えること):
//   開催日の2日前まで: 無料(全額返金)
//   開催日の前日:      料金の30%(70%を返金)
//   開催日の当日以降:  料金の100%(返金なし。自己キャンセル不可)
// キャンセル料の1円未満は切り捨て(お客様有利)。
// 外部 import を持たない純関数(テスト対象)。

export const EVENT_CANCEL_FEE_RATE_DAY_BEFORE = 30;

/** "YYYY-MM-DD" 同士の暦日差(a - b)。Date.UTC ベースなので TZ 非依存 */
const diffDays = (a: string, b: string): number => {
  const toUtc = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(a) - toUtc(b)) / 86_400_000);
};

export interface EventCancelFee {
  /** キャンセル料率(%) */
  rate: number;
  /** キャンセル料(円) */
  fee: number;
  /** 返金額(円) */
  refundAmount: number;
}

export const calcEventCancelFee = (
  eventDate: string,
  todayJst: string,
  totalPrice: number,
): EventCancelFee => {
  const days = diffDays(eventDate, todayJst);
  const rate = days >= 2 ? 0 : days === 1 ? EVENT_CANCEL_FEE_RATE_DAY_BEFORE : 100;
  const fee = Math.floor((totalPrice * rate) / 100);
  return { rate, fee, refundAmount: totalPrice - fee };
};
