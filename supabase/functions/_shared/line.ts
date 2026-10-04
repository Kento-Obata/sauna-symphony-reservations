// LINE Messaging API の薄いラッパ。
//
//  - push  : 任意のタイミングでユーザー/グループへ送信（有料プランの通数にカウント）
//  - reply : webhook イベントの replyToken への返信（通数カウント無し・1回限り・短い有効期限）
//  - 署名検証: webhook 受信時に X-Line-Signature を channel secret (HMAC-SHA256) で検証
//
// 環境変数: LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET / STAFF_PUSH_GROUP_ID

const LINE_API_BASE = "https://api.line.me/v2/bot/message";
// LINE のテキストメッセージ上限は 5000 字。余裕を持って切り詰める。
const LINE_TEXT_LIMIT = 4900;

export type LineSendResult = { ok: boolean; status: number; body?: string };

export const truncateForLine = (text: string): string =>
  text.length > LINE_TEXT_LIMIT ? text.slice(0, LINE_TEXT_LIMIT) + "\n…(略)" : text;

const requireAccessToken = (token?: string): string => {
  const t = token ?? Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!t) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");
  return t;
};

const postMessages = async (
  path: "push" | "reply",
  payload: Record<string, unknown>,
  accessToken?: string,
): Promise<LineSendResult> => {
  const res = await fetch(`${LINE_API_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireAccessToken(accessToken)}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, body };
  }
  return { ok: true, status: res.status };
};

/** ユーザー ID / グループ ID 宛の push。失敗しても throw せず結果を返す。 */
export const pushLineMessage = (to: string, text: string, accessToken?: string): Promise<LineSendResult> =>
  postMessages("push", { to, messages: [{ type: "text", text: truncateForLine(text) }] }, accessToken);

/** webhook の replyToken への返信。失敗はログのみ（webhook 応答は常に 200 を返したいため）。 */
export const replyLineMessage = async (
  replyToken: string,
  text: string,
  accessToken?: string,
): Promise<LineSendResult> => {
  const r = await postMessages(
    "reply",
    { replyToken, messages: [{ type: "text", text: truncateForLine(text) }] },
    accessToken,
  );
  if (!r.ok) console.error("LINE reply failed", r.status, r.body);
  return r;
};

/** X-Line-Signature の検証 (HMAC-SHA256 → base64、定数時間比較)。 */
export const verifyLineSignature = async (
  rawBody: string,
  signature: string,
  channelSecret: string,
): Promise<boolean> => {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
};

/**
 * スタッフグループ (STAFF_PUSH_GROUP_ID) への push。
 * 予約確定/キャンセル等の既存呼び出し元との互換のため、失敗時は throw する。
 */
export const sendLineGroupMessage = async (message: string): Promise<LineSendResult> => {
  const channelAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  const groupId = Deno.env.get("STAFF_PUSH_GROUP_ID");

  if (!channelAccessToken || !groupId) {
    throw new Error("Missing LINE credentials (LINE_CHANNEL_ACCESS_TOKEN or STAFF_PUSH_GROUP_ID)");
  }

  const result = await pushLineMessage(groupId, message, channelAccessToken);
  if (!result.ok) {
    throw new Error(`LINE API error (${result.status}): ${result.body}`);
  }
  return result;
};
