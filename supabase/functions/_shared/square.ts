// Square API クライアント(fetch 直叩き・SDK 不使用)。
//
// 必要な環境変数:
//   - SQUARE_ACCESS_TOKEN          : アクセストークン(本番/サンドボックスで別物)
//   - SQUARE_LOCATION_ID           : ロケーションID(GET /v2/locations で取得)
//   - SQUARE_API_BASE              : 任意。既定は本番。サンドボックスは
//                                    https://connect.squareupsandbox.com を設定
//   - SQUARE_WEBHOOK_SIGNATURE_KEY : Webhook 購読の署名キー(square-webhook のみ)
//
// 金額は JPY のゼロ小数(amount: 1000 = ¥1,000)。100倍しないこと。

const SQUARE_VERSION = "2026-05-20";

export interface SquareConfig {
  accessToken: string;
  locationId: string;
  apiBase: string;
}

export const getSquareConfig = (): SquareConfig => {
  const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
  const locationId = Deno.env.get("SQUARE_LOCATION_ID");
  if (!accessToken || !locationId) {
    throw new Error("Missing SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID");
  }
  return {
    accessToken,
    locationId,
    apiBase: Deno.env.get("SQUARE_API_BASE") ?? "https://connect.squareup.com",
  };
};

const squareFetch = async (
  config: SquareConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const response = await fetch(`${config.apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Square API error (${method} ${path} -> ${response.status}): ${text}`);
    error.name = response.status === 404 ? "SquareNotFoundError" : "SquareApiError";
    throw error;
  }
  return await response.json();
};

export interface PaymentLinkParams {
  idempotencyKey: string;
  locationId: string;
  itemName: string;
  quantity: number;
  unitAmount: number; // 円(ゼロ小数)
  referenceId: string; // 予約コード(40文字以内)
  metadata: Record<string, string>;
  redirectUrl: string;
}

/** Payment Links API のリクエストボディを組み立てる(純関数・テスト対象)。 */
export const buildPaymentLinkBody = (params: PaymentLinkParams): Record<string, unknown> => ({
  idempotency_key: params.idempotencyKey,
  order: {
    location_id: params.locationId,
    reference_id: params.referenceId,
    metadata: params.metadata,
    line_items: [
      {
        name: params.itemName,
        quantity: String(params.quantity),
        base_price_money: { amount: params.unitAmount, currency: "JPY" },
      },
    ],
  },
  checkout_options: {
    redirect_url: params.redirectUrl,
    ask_for_shipping_address: false,
  },
});

export interface CreatedPaymentLink {
  id: string;
  url: string;
  orderId: string;
}

export const createPaymentLink = async (
  params: Omit<PaymentLinkParams, "locationId">,
): Promise<CreatedPaymentLink> => {
  const config = getSquareConfig();
  const data = await squareFetch(config, "POST", "/v2/online-checkout/payment-links",
    buildPaymentLinkBody({ ...params, locationId: config.locationId }));
  const link = data.payment_link as { id?: string; url?: string; order_id?: string } | undefined;
  if (!link?.id || !link.url || !link.order_id) {
    throw new Error("Square payment link response missing fields");
  }
  return { id: link.id, url: link.url, orderId: link.order_id };
};

/** リンク削除(裏の注文もキャンセルされ、以後の支払いを防ぐ)。404 は削除済みとして成功扱い。 */
export const deletePaymentLink = async (paymentLinkId: string): Promise<void> => {
  const config = getSquareConfig();
  try {
    await squareFetch(config, "DELETE", `/v2/online-checkout/payment-links/${paymentLinkId}`);
  } catch (error) {
    if (error instanceof Error && error.name === "SquareNotFoundError") return;
    throw error;
  }
};

export interface SquareOrder {
  state: string;
  tenders: Array<{ id?: string; payment_id?: string }>;
}

export const retrieveOrder = async (orderId: string): Promise<SquareOrder> => {
  const config = getSquareConfig();
  const data = await squareFetch(config, "GET", `/v2/orders/${orderId}`);
  const order = data.order as { state?: string; tenders?: SquareOrder["tenders"] } | undefined;
  return { state: order?.state ?? "UNKNOWN", tenders: order?.tenders ?? [] };
};

export const refundPayment = async (params: {
  paymentId: string;
  amount: number; // 円(ゼロ小数)
  idempotencyKey: string;
  reason?: string;
}): Promise<{ refundId: string; status: string }> => {
  const config = getSquareConfig();
  const data = await squareFetch(config, "POST", "/v2/refunds", {
    idempotency_key: params.idempotencyKey,
    payment_id: params.paymentId,
    amount_money: { amount: params.amount, currency: "JPY" },
    reason: params.reason,
  });
  const refund = data.refund as { id?: string; status?: string } | undefined;
  if (!refund?.id) throw new Error("Square refund response missing fields");
  return { refundId: refund.id, status: refund.status ?? "PENDING" };
};

const base64ToBytes = (value: string): Uint8Array | null => {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
};

/**
 * Webhook 署名の検証(純関数・テスト対象)。
 * signature = base64(HMAC-SHA256(key=署名キー, message=通知URL + 生ボディ))
 * 生ボディは JSON.parse 前のバイト列を渡すこと(再シリアライズすると一致しない)。
 * crypto.subtle.verify は定数時間比較。
 */
export const verifySquareWebhookSignature = async (params: {
  signatureHeader: string | null;
  notificationUrl: string;
  rawBody: Uint8Array;
  signatureKey: string;
}): Promise<boolean> => {
  const { signatureHeader, notificationUrl, rawBody, signatureKey } = params;
  if (!signatureHeader || !signatureKey) return false;
  const signature = base64ToBytes(signatureHeader);
  if (!signature) return false;

  const urlBytes = new TextEncoder().encode(notificationUrl);
  const message = new Uint8Array(urlBytes.length + rawBody.length);
  message.set(urlBytes, 0);
  message.set(rawBody, urlBytes.length);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return await crypto.subtle.verify(
    "HMAC",
    key,
    signature as BufferSource,
    message as BufferSource,
  );
};
