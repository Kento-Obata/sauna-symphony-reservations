import { sendLovableEmail } from "npm:@lovable.dev/email-js@0.0.4";

const SENDER_DOMAIN = "notify.u-sync.jp";
const FROM_ADDRESS = "体験型サウナU <noreply@notify.u-sync.jp>";

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
  const apiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!apiKey) {
    throw new Error("Missing LOVABLE_API_KEY");
  }

  return await sendLovableEmail(
    {
      to,
      from: FROM_ADDRESS,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      idempotency_key: idempotencyKey,
      label,
      message_id: crypto.randomUUID(),
    },
    { apiKey, idempotencyKey }
  );
};