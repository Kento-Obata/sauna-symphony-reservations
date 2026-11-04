import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { mentionsBot, stripBotMention } from "./line-mention.ts";

Deno.test("line-mention: ボットへのメンションだけを数え、@All やほかの人は含めない", () => {
  assertEquals(mentionsBot(undefined), false);
  assertEquals(mentionsBot([{ index: 0, length: 4, type: "all" }]), false);
  assertEquals(mentionsBot([{ index: 0, length: 4, type: "user", userId: "U1" }]), false);
  assertEquals(mentionsBot([{ index: 0, length: 8, type: "user", isSelf: true }]), true);
});

Deno.test("line-mention: ボットへのメンションを本文から外し、ほかの人へのメンションは残す", () => {
  const text = "@U sauna 明日の @稲垣 のシフトは？";
  const mentionees = [
    { index: 0, length: 8, type: "user", isSelf: true },
    { index: 12, length: 3, type: "user", userId: "U2" },
  ];
  assertEquals(stripBotMention(text, mentionees), "明日の @稲垣 のシフトは？");
  assertEquals(stripBotMention("今日の予約は？ @U sauna", [{ index: 8, length: 8, isSelf: true }]), "今日の予約は？");
});
