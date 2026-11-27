// イベント予約のお持ち物案内。
//
// 貸切プランでは水着・サウナハット・ポンチョを無料で用意しているため、
// イベント開催日も無料と誤解されやすい(イベント当日は有料レンタル・現地払い。足巻きタオルは無料)。
// 確定メール(予約直後)と前日リマインドの両方で同じ文面を出す。
// 料金は public.event_option_items(全イベント共通・管理画面の当日会計と同じ元データ)から
// 読み、取得できない場合は金額なしの案内にフォールバックする。

// postgresjs の接続(型パッケージ非導入のため構造的に定義)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

export interface EventOptionItem {
  name: string;
  price: number;
}

export const fetchActiveEventOptionItems = async (sql: Sql): Promise<EventOptionItem[]> => {
  try {
    const rows = await sql`
      select name, price::int as price
      from public.event_option_items
      where active
      order by sort_order, name
    `;
    return rows.map((row: { name: string; price: number | string }) => ({
      name: String(row.name),
      price: Number(row.price),
    }));
  } catch (error) {
    console.error("event_option_items fetch error:", error);
    return [];
  }
};

/**
 * キャンセルポリシーの本文(純関数・テスト対象)。
 * イベントは全件事前決済。2日前まで全額返金・前日は30%・当日以降は返金なし。
 * キャンセル料の計算は event-cancel-fee.ts。
 * 自己キャンセルの可否判定(cancel-event-reservation: 開催日 > JST今日)と揃えること。
 * 画面側(src/utils/eventNotice.ts)と同じ文面。
 */
export const buildEventCancelPolicyNotice = (): string =>
  [
    "【キャンセルポリシー】",
    "・開催日の2日前まで：無料（全額返金）",
    "・開催日の前日：料金の30%",
    "・開催日の当日：料金の100%",
    "・無断キャンセル：料金の100%",
    "前日までのキャンセルは、下記リンクからお手続きいただけます（キャンセル料を差し引いた金額を返金いたします）。",
    "当日のキャンセルは返金いたしかねます。ご来店が難しくなった場合は、お電話にてご連絡ください。",
  ].join("\n");

/** お持ち物案内の本文(純関数・テスト対象)。items が空なら金額一覧を省く。 */
export const buildEventBringItemsNotice = (items: EventOptionItem[] = []): string => {
  const lines = [
    "【お持ち物・レンタルについて】",
    "イベント開催日は、通常の貸切プランと異なり、水着・サウナハット・ポンチョは有料レンタル（現地払い）となります。",
    "足巻きタオルは無料でご用意しております。水着はご持参いただくか、当日レンタルをご利用ください。",
  ];
  if (items.length > 0) {
    lines.push("", "当日ご利用いただけるオプション（現地払い）:");
    for (const item of items) {
      lines.push(`・${item.name} ${item.price.toLocaleString("ja-JP")}円`);
    }
  }
  return lines.join("\n");
};
