// イベント slug のフロント側検証。
// DB 側 CHECK 制約・edge function 側 _shared/event-validation.ts と同一ルール。

/** /events/complete・/events/reservation/:code の静的ルートと衝突する予約語 */
export const EVENT_RESERVED_SLUGS = new Set(["complete", "reservation"]);

export const isValidEventSlug = (value: string): boolean =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) &&
  value.length >= 3 &&
  value.length <= 60 &&
  !EVENT_RESERVED_SLUGS.has(value);

export const eventSlugErrorMessage =
  "slug は半角小文字英数字とハイフンのみ・3〜60文字で入力してください（complete / reservation は使用不可）";
