import { sendAppEmail, buildSimpleEmailHtml } from "./lovable-email.ts";

export const sendEmail = async (to: string, subject: string, message: string) => {
  const idempotencyKey = `legacy-${crypto.randomUUID()}`;
  return await sendAppEmail({
    to,
    subject,
    html: buildSimpleEmailHtml(subject, message),
    text: message,
    idempotencyKey,
    label: "legacy-notification",
  });
};
