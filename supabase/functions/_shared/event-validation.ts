// パブリックイベント予約の入力バリデーションと定員判定（純ロジック）。
//
// reservation-validation.ts と同じ方針: edge function のハンドラから呼ぶことで
// 「本番で動くコード」と「テストで検証するコード」を同一にする。
// DB アクセスや副作用を含まないため Deno で単体テストできる。

// /events/complete・/events/reservation/:code の静的ルートと衝突するため
// slug として使えない予約語。DB 側の CHECK 制約・管理画面の入力検証と三重防御。
export const RESERVED_SLUGS = new Set(["complete", "reservation"]);

export const isValidSlug = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) &&
  value.length >= 3 &&
  value.length <= 60 &&
  !RESERVED_SLUGS.has(value);

export const isValidUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export interface EventReservationInput {
  slotId?: unknown;
  guestName?: unknown;
  guestCount?: unknown;
  email?: unknown;
  phone?: unknown;
}

/**
 * イベント予約入力を検証し、日本語のエラーメッセージ配列を返す（空配列なら妥当）。
 * 貸切予約と異なり email は必須（キャンセルリンクの配送先のため）。
 * maxGuests はイベントごとの max_guests_per_reservation。
 */
export const validateEventReservationInput = (
  body: EventReservationInput,
  maxGuests: number,
): string[] => {
  const { slotId, guestName, guestCount, email, phone } = body;
  const errors: string[] = [];

  if (!slotId || !guestName || !guestCount || !email || !phone) {
    errors.push("必須項目が入力されていません");
  }
  if (!isValidUuid(slotId)) {
    errors.push("枠の指定が正しくありません");
  }
  if (
    typeof guestName !== "string" ||
    guestName.trim().length === 0 ||
    guestName.length > 100
  ) {
    errors.push("お名前は1〜100文字で入力してください");
  }
  if (
    !Number.isInteger(guestCount) ||
    (guestCount as number) < 1 ||
    (guestCount as number) > maxGuests
  ) {
    errors.push(`人数は1〜${maxGuests}名で指定してください`);
  }

  const phoneStr = String(phone || "");
  const phoneDigits = phoneStr.replace(/[^\d]/g, "");
  if (
    !/^[\d\-+()\s]{10,20}$/.test(phoneStr) ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 15
  ) {
    errors.push("電話番号の形式が正しくありません");
  }

  if (
    typeof email !== "string" ||
    email.length === 0 ||
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.push("メールアドレスの形式が正しくありません");
  }

  return errors;
};

/** 残席数。定員超過状態（taken > capacity）でも負値は返さない。 */
export const calcRemaining = (capacity: number, taken: number): number =>
  Math.max(capacity - taken, 0);

/** guestCount 名の予約を受け付けられるか。ぴったり満席になる予約は受け付ける。 */
export const canAcceptReservation = (
  capacity: number,
  taken: number,
  guestCount: number,
): boolean => taken + guestCount <= capacity;

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * [A-Z0-9]{8} の予約コードを生成。
 * 既存の generate_reservation_code() DB 関数はマイグレーション管理外のため依存しない。
 * 一意性は event_reservations.reservation_code の UNIQUE 制約 + 呼び出し側のリトライで担保。
 */
export const generateEventReservationCode = (): string => {
  const buffer = new Uint8Array(8);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join("");
};
