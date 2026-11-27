/**
 * イベント開催日のお持ち物案内(画面用)。
 * 貸切プランでは水着・サウナハット・ポンチョを無料で用意しているため、イベントでも無料と誤解されやすい。
 * 確定メール・前日リマインド(supabase/functions/_shared/event-notice.ts)と同じ趣旨の文面。
 * 料金はサーバー側のメールにのみ載せ、画面側では金額を持たない(値上げ等で食い違わないように)。
 */
export const EVENT_BRING_ITEMS_TITLE = "お持ち物・レンタルについて";

export const EVENT_BRING_ITEMS_LINES = [
  "イベント開催日は、通常の貸切プランと異なり、水着・サウナハット・ポンチョは有料レンタル（現地払い）となります",
  "足巻きタオルは無料でご用意しています　水着はご持参いただくか、当日レンタルをご利用ください",
] as const;

/** 一覧表示向けの短い一行 */
export const EVENT_BRING_ITEMS_SHORT = "水着はご持参ください（水着・サウナハット・ポンチョのレンタルは有料　足巻きタオルは無料）";

/**
 * イベントのキャンセルポリシー(画面用)。
 * イベントは全件事前決済のため、2日前まで全額返金・前日は30%・当日以降は返金なし。
 * 計算は src/utils/eventCancelFee.ts(サーバー側 event-cancel-fee.ts)と揃えること。
 * 確定メール・前日リマインド(supabase/functions/_shared/event-notice.ts)と同じ文面。
 */
export const EVENT_CANCEL_POLICY_TITLE = "キャンセルポリシー";

export const EVENT_CANCEL_POLICY_ROWS = [
  ["開催日の2日前まで", "無料（全額返金）"],
  ["開催日の前日", "料金の30%"],
  ["開催日の当日", "料金の100%"],
  ["無断キャンセル", "料金の100%"],
] as const;

/** 一覧表示向けの短い一行 */
export const EVENT_CANCEL_POLICY_SHORT = "2日前まで無料　前日は料金の30%　当日・無断キャンセルは料金の100%";
