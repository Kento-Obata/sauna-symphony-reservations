import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { buildPaymentLinkBody, verifySquareWebhookSignature } from "./square.ts";

// テスト側で独立に HMAC-SHA256 → base64 を計算(実装と同じ経路を使わない)
const computeSignature = async (key: string, message: Uint8Array): Promise<string> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, message as BufferSource),
  );
  return btoa(String.fromCharCode(...mac));
};

const KEY = "test-signature-key";
const URL = "https://example.supabase.co/functions/v1/square-webhook";
const BODY = new TextEncoder().encode('{"type":"payment.updated","data":{}}');

const signedMessage = () => {
  const urlBytes = new TextEncoder().encode(URL);
  const message = new Uint8Array(urlBytes.length + BODY.length);
  message.set(urlBytes, 0);
  message.set(BODY, urlBytes.length);
  return message;
};

Deno.test("署名検証: 正しい署名は true", async () => {
  const signature = await computeSignature(KEY, signedMessage());
  assert(
    await verifySquareWebhookSignature({
      signatureHeader: signature,
      notificationUrl: URL,
      rawBody: BODY,
      signatureKey: KEY,
    }),
  );
});

Deno.test("署名検証: ボディ改ざんは false", async () => {
  const signature = await computeSignature(KEY, signedMessage());
  assert(
    !(await verifySquareWebhookSignature({
      signatureHeader: signature,
      notificationUrl: URL,
      rawBody: new TextEncoder().encode('{"type":"payment.updated","data":{"x":1}}'),
      signatureKey: KEY,
    })),
  );
});

Deno.test("署名検証: URL 不一致は false(署名は通知URLも含む)", async () => {
  const signature = await computeSignature(KEY, signedMessage());
  assert(
    !(await verifySquareWebhookSignature({
      signatureHeader: signature,
      notificationUrl: "https://example.supabase.co/functions/v1/square-webhook/",
      rawBody: BODY,
      signatureKey: KEY,
    })),
  );
});

Deno.test("署名検証: キー不一致・ヘッダ欠落・不正base64 は false", async () => {
  const signature = await computeSignature(KEY, signedMessage());
  assert(
    !(await verifySquareWebhookSignature({
      signatureHeader: signature,
      notificationUrl: URL,
      rawBody: BODY,
      signatureKey: "wrong-key",
    })),
  );
  assert(
    !(await verifySquareWebhookSignature({
      signatureHeader: null,
      notificationUrl: URL,
      rawBody: BODY,
      signatureKey: KEY,
    })),
  );
  assert(
    !(await verifySquareWebhookSignature({
      signatureHeader: "!!!not-base64!!!",
      notificationUrl: URL,
      rawBody: BODY,
      signatureKey: KEY,
    })),
  );
});

Deno.test("buildPaymentLinkBody: JPYゼロ小数・quantity文字列・reference_id・redirect設定", () => {
  const body = buildPaymentLinkBody({
    idempotencyKey: "link-ABCD1234",
    locationId: "LOC123",
    itemName: "アウフグースナイト 2026年8月8日(土) 18:00〜20:00",
    quantity: 2,
    unitAmount: 3500,
    referenceId: "ABCD1234",
    metadata: { reservation_id: "uuid-here" },
    redirectUrl: "https://example.com/events/reservation/ABCD1234?t=tok&from=checkout",
  });

  const order = body.order as Record<string, unknown>;
  const lineItems = order.line_items as Array<Record<string, unknown>>;
  assertEquals(order.location_id, "LOC123");
  assertEquals(order.reference_id, "ABCD1234");
  assertEquals(lineItems.length, 1);
  assertEquals(lineItems[0].quantity, "2"); // 文字列であること
  assertEquals(lineItems[0].base_price_money, { amount: 3500, currency: "JPY" }); // ¥3,500(×100しない)

  const checkoutOptions = body.checkout_options as Record<string, unknown>;
  assertEquals(checkoutOptions.ask_for_shipping_address, false);
  assertEquals(
    checkoutOptions.redirect_url,
    "https://example.com/events/reservation/ABCD1234?t=tok&from=checkout",
  );
});
