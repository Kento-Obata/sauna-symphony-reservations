// 予約作成の入力バリデーション（純ロジック）。
//
// create-reservation edge function のハンドラから呼ぶことで、
// 「本番で動くコード」と「テストで検証するコード」を同一にする。
// DB アクセスや副作用を含まないため Deno で単体テストできる。

export const VALID_TIME_SLOTS = new Set(["morning", "afternoon", "evening", "night"]);

export interface SelectedOptionInput {
  option_id: string;
  quantity: number;
}

/** selectedOptions を正規化。配列でなければ例外、要素は option_id 必須・quantity は正整数に丸める。 */
export const normalizeOptions = (selectedOptions: unknown): SelectedOptionInput[] => {
  if (!selectedOptions) return [];
  if (!Array.isArray(selectedOptions)) throw new Error("オプションの形式が不正です");
  return selectedOptions
    .filter((option) => option && typeof option.option_id === "string")
    .map((option) => ({
      option_id: option.option_id,
      quantity:
        Number.isInteger(option.quantity) && option.quantity > 0 ? option.quantity : 1,
    }));
};

export interface ReservationInput {
  date?: unknown;
  timeSlot?: unknown;
  guestName?: unknown;
  guestCount?: unknown;
  email?: unknown;
  phone?: unknown;
  waterTemperature?: unknown;
}

/**
 * 予約入力を検証し、日本語のエラーメッセージ配列を返す（空配列なら妥当）。
 * ここに単一定義を置くことで、通知・admin作成など他経路と検証がぶれないようにする。
 */
export const validateReservationInput = (body: ReservationInput): string[] => {
  const { date, timeSlot, guestName, guestCount, email, phone, waterTemperature } = body;
  const errors: string[] = [];

  if (!date || !timeSlot || !guestName || !guestCount || !phone) {
    errors.push("必須項目が入力されていません");
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push("日付の形式が正しくありません");
  }
  if (typeof timeSlot !== "string" || !VALID_TIME_SLOTS.has(timeSlot)) {
    errors.push("時間帯が不正です");
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
    (guestCount as number) > 6
  ) {
    errors.push("人数が不正です");
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

  if (email !== undefined && email !== null && email !== "") {
    if (
      typeof email !== "string" ||
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      errors.push("メールアドレスの形式が正しくありません");
    }
  }

  if (
    !Number.isInteger(waterTemperature) ||
    (waterTemperature as number) < 2 ||
    (waterTemperature as number) > 17
  ) {
    errors.push("水温が不正です");
  }

  return errors;
};
