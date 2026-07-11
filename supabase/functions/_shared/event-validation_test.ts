import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  calcRemaining,
  canAcceptReservation,
  generateEventReservationCode,
  isValidSlug,
  isValidUuid,
  validateEventReservationInput,
} from "./event-validation.ts";

const validBody = () => ({
  slotId: "a3bb189e-8bf9-3888-9912-ace4e6543002",
  guestName: "山田太郎",
  guestCount: 2,
  email: "guest@example.com",
  phone: "090-1234-5678",
});

Deno.test("妥当な入力ならエラー無し", () => {
  assertEquals(validateEventReservationInput(validBody(), 4), []);
});

Deno.test("email 欠落・不正は不可（貸切予約と異なり必須）", () => {
  assert(
    validateEventReservationInput({ ...validBody(), email: "" }, 4).includes(
      "メールアドレスの形式が正しくありません",
    ),
  );
  assert(
    validateEventReservationInput({ ...validBody(), email: undefined }, 4).includes(
      "メールアドレスの形式が正しくありません",
    ),
  );
  assert(
    validateEventReservationInput({ ...validBody(), email: "not-an-email" }, 4).includes(
      "メールアドレスの形式が正しくありません",
    ),
  );
});

Deno.test("guestCount が maxGuests 超過・0・非整数は不可", () => {
  assert(
    validateEventReservationInput({ ...validBody(), guestCount: 5 }, 4).includes(
      "人数は1〜4名で指定してください",
    ),
  );
  assertEquals(validateEventReservationInput({ ...validBody(), guestCount: 4 }, 4), []);
  assert(validateEventReservationInput({ ...validBody(), guestCount: 0 }, 4).length > 0);
  assert(validateEventReservationInput({ ...validBody(), guestCount: 1.5 }, 4).length > 0);
});

Deno.test("slotId が UUID でなければ不可", () => {
  assert(
    validateEventReservationInput({ ...validBody(), slotId: "abc" }, 4).includes(
      "枠の指定が正しくありません",
    ),
  );
});

Deno.test("電話番号の形式チェックは貸切予約と同一基準", () => {
  assert(
    validateEventReservationInput({ ...validBody(), phone: "123" }, 4).includes(
      "電話番号の形式が正しくありません",
    ),
  );
  assertEquals(validateEventReservationInput({ ...validBody(), phone: "09012345678" }, 4), []);
});

Deno.test("isValidSlug: 形式・長さ・予約語", () => {
  assert(isValidSlug("summer-festival-2026"));
  assert(isValidSlug("abc"));
  assert(!isValidSlug("ab"));            // 3文字未満
  assert(!isValidSlug("a".repeat(61)));  // 60文字超
  assert(!isValidSlug("Summer"));        // 大文字
  assert(!isValidSlug("-abc"));          // 先頭ハイフン
  assert(!isValidSlug("abc-"));          // 末尾ハイフン
  assert(!isValidSlug("a--b"));          // 連続ハイフン
  assert(!isValidSlug("イベント"));
  // ルート予約語（/events/complete・/events/reservation と衝突）
  assert(!isValidSlug("complete"));
  assert(!isValidSlug("reservation"));
});

Deno.test("isValidUuid", () => {
  assert(isValidUuid("a3bb189e-8bf9-3888-9912-ace4e6543002"));
  assert(!isValidUuid("a3bb189e8bf938889912ace4e6543002"));
  assert(!isValidUuid(null));
  assert(!isValidUuid(123));
});

Deno.test("容量境界: ぴったり満席は可、超過は不可", () => {
  assert(canAcceptReservation(10, 8, 2));   // 8 + 2 = 10 ちょうど → 可
  assert(!canAcceptReservation(10, 8, 3));  // 8 + 3 = 11 → 不可
  assert(canAcceptReservation(1, 0, 1));
  assert(!canAcceptReservation(0, 0, 1));   // 定員0の枠は常に不可
});

Deno.test("calcRemaining: 定員超過状態でも負値を返さない", () => {
  assertEquals(calcRemaining(10, 3), 7);
  assertEquals(calcRemaining(10, 10), 0);
  assertEquals(calcRemaining(10, 12), 0); // 管理者が定員を予約済み人数未満に下げた場合
});

Deno.test("予約コードは [A-Z0-9]{8}", () => {
  for (let i = 0; i < 100; i++) {
    assertMatch(generateEventReservationCode(), /^[A-Z0-9]{8}$/);
  }
});
