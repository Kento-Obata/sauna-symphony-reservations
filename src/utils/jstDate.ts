// フロント側の「JST の今日」を返す唯一の関数。
//
// `new Date().toISOString().split('T')[0]` は UTC 基準のため、JST 00:00〜09:00 の間は
// 前日を返してしまう(当日キャンセル判定などが 1 日ズレる)。日付比較には必ずこれを使う。
// サーバ側の supabase/functions/_shared/date-jst.ts:getJstTodayYmd と同じ計算。
export const getJstTodayYmd = (now: Date = new Date()): string =>
  // eslint-disable-next-line no-restricted-syntax -- ここが JST 変換の正規の実装
  new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
