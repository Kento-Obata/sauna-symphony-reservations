// 【E2E検証専用・ステージングのみ】Square サンドボックスのテスト決済ヘルパー。
//
// サンドボックスでは決済ページの UI を経由せず、テスト用ノンス(cnon:card-nonce-ok)で
// Payments API を直接叩いて注文を支払い済みにできる。これで payment.updated Webhook の
// 発火まで含めた E2E をコマンドラインから再現する。
//
// 安全装置: SQUARE_API_BASE がサンドボックスでない環境では一切動作しない。
// 検証完了後はこの関数をプロジェクトから削除すること(本番にはデプロイしない)。

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSquareConfig } from "../_shared/square.ts";

const handler = async (req: Request): Promise<Response> => {
  const config = getSquareConfig();
  if (!config.apiBase.includes("squareupsandbox")) {
    return new Response(JSON.stringify({ error: "sandbox only" }), { status: 403 });
  }

  const { orderId, amount } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string" || typeof amount !== "number") {
    return new Response(JSON.stringify({ error: "orderId and amount required" }), { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
    "Square-Version": "2026-05-20",
    "Content-Type": "application/json",
  };

  // Payment Link の注文は購入者がチェックアウトを開くまで DRAFT のため、
  // ホスト型チェックアウトの内部動作と同様に OPEN へ遷移させてから支払う
  const orderRes = await fetch(`${config.apiBase}/v2/orders/${orderId}`, { headers });
  const orderData = await orderRes.json();
  const version = orderData?.order?.version;
  if (orderData?.order?.state === "DRAFT") {
    const updateRes = await fetch(`${config.apiBase}/v2/orders/${orderId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ order: { location_id: config.locationId, state: "OPEN", version } }),
    });
    if (!updateRes.ok) {
      const body = await updateRes.text();
      return new Response(
        JSON.stringify({ error: `order open failed: ${body}` }),
        { headers: { "Content-Type": "application/json" }, status: 500 },
      );
    }
  }

  const response = await fetch(`${config.apiBase}/v2/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      source_id: "cnon:card-nonce-ok",
      order_id: orderId,
      amount_money: { amount, currency: "JPY" },
      location_id: config.locationId,
    }),
  });
  const data = await response.json();
  return new Response(JSON.stringify({ status: response.status, data }), {
    headers: { "Content-Type": "application/json" },
    status: response.ok ? 200 : 500,
  });
};

serve(handler);
