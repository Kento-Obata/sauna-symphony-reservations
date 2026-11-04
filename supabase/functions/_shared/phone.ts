// SMS(Twilio)の宛先にする電話番号。Twilio は E.164 形式(+81...)しか受け付けない。
// お客様の入力は 090-1234-5678 / ０９０… / +81 90-1234-5678 / +81 090-… などさまざまなので、どれも +819012345678 にそろえる。
// (以前は 0 で始まる番号だけを直していて、+81 付きで入力された番号には SMS が届いていなかった)

const toHalfWidthDigits = (s: string) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

export const toE164 = (phone: string): string => {
  const input = toHalfWidthDigits(phone).trim();
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) return `+81${digits.slice(1)}`;
  if (digits.startsWith("81") && digits.length >= 11) {
    const rest = digits.slice(2);
    // +81 のあとに国内の 0 を付けたまま入力されたもの(+81 090-…)
    return `+81${rest.startsWith("0") ? rest.slice(1) : rest}`;
  }
  // それ以外: + 付きは海外の番号としてそのまま、+ 無しは先頭の 0 が抜けた国内の番号とみなす
  return input.startsWith("+") ? `+${digits}` : `+81${digits}`;
};
