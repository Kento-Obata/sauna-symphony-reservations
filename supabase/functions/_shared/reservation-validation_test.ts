import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  normalizeOptions,
  validateReservationInput,
} from "./reservation-validation.ts";

const validBody = () => ({
  date: "2026-08-03",
  timeSlot: "afternoon",
  guestName: "山田太郎",
  guestCount: 2,
  email: "guest@example.com",
  phone: "090-1234-5678",
  waterTemperature: 10,
});

Deno.test("妥当な入力ならエラー無し", () => {
  assertEquals(validateReservationInput(validBody()), []);
});

Deno.test("email 省略・空文字は許容", () => {
  assertEquals(validateReservationInput({ ...validBody(), email: undefined }), []);
  assertEquals(validateReservationInput({ ...validBody(), email: "" }), []);
});

Deno.test("必須欠落: 必須メッセージを含む", () => {
  const errs = validateReservationInput({ ...validBody(), guestName: "" });
  assert(errs.includes("必須項目が入力されていません"));
});

Deno.test("日付形式が不正", () => {
  assert(
    validateReservationInput({ ...validBody(), date: "2026/08/03" }).includes(
      "日付の形式が正しくありません",
    ),
  );
});

Deno.test("時間帯が不正な列挙値", () => {
  assert(
    validateReservationInput({ ...validBody(), timeSlot: "midnight" }).includes(
      "時間帯が不正です",
    ),
  );
});

Deno.test("時間帯 4種（morning/afternoon/evening/night）は妥当", () => {
  for (const slot of ["morning", "afternoon", "evening", "night"]) {
    assertEquals(validateReservationInput({ ...validBody(), timeSlot: slot }), []);
  }
});

Deno.test("お名前が101文字以上は不正", () => {
  const long = "あ".repeat(101);
  assert(
    validateReservationInput({ ...validBody(), guestName: long }).includes(
      "お名前は1〜100文字で入力してください",
    ),
  );
});

Deno.test("人数は1〜6のみ妥当", () => {
  for (const n of [1, 2, 6]) {
    assertEquals(validateReservationInput({ ...validBody(), guestCount: n }), []);
  }
  for (const n of [0, 7, 2.5]) {
    assert(
      validateReservationInput({ ...validBody(), guestCount: n }).includes("人数が不正です"),
    );
  }
});

Deno.test("電話番号: 桁不足/長すぎは不正", () => {
  assert(
    validateReservationInput({ ...validBody(), phone: "12345" }).includes(
      "電話番号の形式が正しくありません",
    ),
  );
});

Deno.test("メール形式が不正", () => {
  assert(
    validateReservationInput({ ...validBody(), email: "not-an-email" }).includes(
      "メールアドレスの形式が正しくありません",
    ),
  );
});

Deno.test("水温は2〜17のみ妥当", () => {
  for (const t of [2, 10, 17]) {
    assertEquals(validateReservationInput({ ...validBody(), waterTemperature: t }), []);
  }
  for (const t of [1, 18]) {
    assert(
      validateReservationInput({ ...validBody(), waterTemperature: t }).includes(
        "水温が不正です",
      ),
    );
  }
});

Deno.test("normalizeOptions: undefined は空配列、非配列は例外", () => {
  assertEquals(normalizeOptions(undefined), []);
  assertThrows(() => normalizeOptions({ foo: 1 } as unknown), Error, "オプションの形式が不正です");
});

Deno.test("normalizeOptions: option_id 必須・quantity は正整数に丸める", () => {
  const out = normalizeOptions([
    { option_id: "a", quantity: 3 },
    { option_id: "b", quantity: 0 }, // 0以下は1に
    { option_id: "c" }, // quantity 無しは1に
    { quantity: 5 }, // option_id 無しは除外
  ] as unknown);
  assertEquals(out, [
    { option_id: "a", quantity: 3 },
    { option_id: "b", quantity: 1 },
    { option_id: "c", quantity: 1 },
  ]);
});
