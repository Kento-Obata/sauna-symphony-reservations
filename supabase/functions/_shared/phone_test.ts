import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { toE164 } from "./phone.ts";

Deno.test("phone: 国内の書き方を E.164 にそろえる", () => {
  assertEquals(toE164("090-1234-5678"), "+819012345678");
  assertEquals(toE164("09012345678"), "+819012345678");
  assertEquals(toE164("０９０－１２３４－５６７８"), "+819012345678");
  assertEquals(toE164("03-1234-5678"), "+81312345678");
});

Deno.test("phone: +81 付き・81 付き・+81 のあとに 0 を付けた入力も E.164 にする", () => {
  assertEquals(toE164("+81 90-1234-5678"), "+819012345678");
  assertEquals(toE164("819012345678"), "+819012345678");
  assertEquals(toE164("+81 090-1234-5678"), "+819012345678");
  assertEquals(toE164("+81(0)90-1234-5678"), "+819012345678");
});

Deno.test("phone: 海外の番号はそのまま、先頭の 0 が抜けた国内の番号は補う", () => {
  assertEquals(toE164("+1 415-555-0100"), "+14155550100");
  assertEquals(toE164("9012345678"), "+819012345678");
});
