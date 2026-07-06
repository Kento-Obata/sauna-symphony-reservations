// メール送信は Resend API を直接叩く（Lovable 依存を排除）。
//
// 必要な環境変数:
//   - RESEND_API_KEY : Resend の API キー（本番・staging それぞれに設定）
//   - EMAIL_FROM     : 差出人（任意。未設定なら下記デフォルト）。Resend で検証済みの
//                      ドメイン(u-sync.jp)のアドレスであること。
//
// 呼び出し側 (sendAppEmail / buildSimpleEmailHtml) のインターフェースは従来どおりなので、
// send-pending / send-confirmation / send-reservation-reminders / _shared/email.ts は無改修。

const FROM_ADDRESS = Deno.env.get("EMAIL_FROM") ?? "体験型サウナU <noreply@u-sync.jp>";

interface SendAppEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  label: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const buildSimpleEmailHtml = (heading: string, body: string) => {
  const paragraphs = body
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .map((line) =>
      line
        ? `<p style="margin:0 0 12px;line-height:1.7;">${escapeHtml(line)}</p>`
        : `<div style="height:8px;"></div>`
    )
    .join("");

  return `<!doctype html><html lang="ja"><body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#2d3427;"><div style="max-width:560px;margin:0 auto;padding:32px 24px;"><h1 style="font-size:22px;line-height:1.35;margin:0 0 24px;color:#2d3a26;">${escapeHtml(heading)}</h1>${paragraphs}</div></body></html>`;
};

export const sendAppEmail = async ({
  to,
  subject,
  html,
  text,
  idempotencyKey,
  label,
}: SendAppEmailParams) => {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  // Resend の tag は [A-Za-z0-9_-] のみ許容されるためサニタイズ。
  const safeLabel = (label || "app").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 256);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // 同一 idempotencyKey の再送は Resend 側で重複排除される。
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text,
      tags: [{ name: "label", value: safeLabel }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }

  return await response.json();
};
