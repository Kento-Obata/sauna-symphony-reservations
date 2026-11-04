// 道具の入力を JSON Schema(使う範囲だけ)で検証し、既定値を補った値を返す。
// AI が渡しがちな揺れ(数値の文字列・null の任意項目)は受け入れ、誤りは日本語で返して AI に直させる。

import type { JsonSchema } from "./types.ts";

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; errors: string[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidDate = (s: string): boolean => {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const label = (path: string) => path || "入力";

function check(schema: JsonSchema, value: unknown, path: string, errors: string[]): unknown {
  if (schema.enum && !schema.enum.includes(value as string | number)) {
    errors.push(`${label(path)}: ${schema.enum.join(" / ")} のどれかで指定してください`);
    return value;
  }

  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        errors.push(`${label(path)}: オブジェクトで指定してください`);
        return value;
      }
      const record = value as Record<string, unknown>;
      const props = schema.properties ?? {};
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!(key in props)) errors.push(`${path ? `${path}.` : ""}${key}: 使えない項目です`);
        }
      }
      const out: Record<string, unknown> = {};
      for (const [key, sub] of Object.entries(props)) {
        const childPath = path ? `${path}.${key}` : key;
        let v = record[key];
        if ((v === undefined || v === null) && sub.default !== undefined) v = structuredClone(sub.default);
        if (v === undefined || v === null) {
          if (schema.required?.includes(key)) errors.push(`${childPath}: 必須です`);
          continue;
        }
        out[key] = check(sub, v, childPath, errors);
      }
      return out;
    }

    case "array": {
      if (!Array.isArray(value)) {
        errors.push(`${label(path)}: 配列で指定してください`);
        return value;
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push(`${label(path)}: ${schema.minItems}件以上で指定してください`);
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push(`${label(path)}: ${schema.maxItems}件までです`);
      }
      return schema.items
        ? value.map((item, i) => check(schema.items!, item, `${label(path)}[${i}]`, errors))
        : value;
    }

    case "integer":
    case "number": {
      let n = value;
      if (typeof n === "string" && n.trim() !== "" && !Number.isNaN(Number(n))) n = Number(n);
      if (typeof n !== "number" || !Number.isFinite(n) || (schema.type === "integer" && !Number.isInteger(n))) {
        errors.push(`${label(path)}: ${schema.type === "integer" ? "整数" : "数値"}で指定してください`);
        return value;
      }
      if (schema.minimum !== undefined && n < schema.minimum) errors.push(`${label(path)}: ${schema.minimum}以上で指定してください`);
      if (schema.maximum !== undefined && n > schema.maximum) errors.push(`${label(path)}: ${schema.maximum}以下で指定してください`);
      return n;
    }

    case "boolean": {
      if (value === "true") return true;
      if (value === "false") return false;
      if (typeof value !== "boolean") errors.push(`${label(path)}: true か false で指定してください`);
      return value;
    }

    case "string": {
      if (typeof value !== "string") {
        errors.push(`${label(path)}: 文字列で指定してください`);
        return value;
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${label(path)}: ${schema.minLength}文字以上で指定してください`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${label(path)}: ${schema.maxLength}文字までです`);
      }
      if (schema.format === "date" && !isValidDate(value)) errors.push(`${label(path)}: 日付は YYYY-MM-DD で指定してください`);
      if (schema.format === "uuid" && !UUID_RE.test(value)) errors.push(`${label(path)}: ID の形式が正しくありません`);
      if (schema.format === "time" && !TIME_RE.test(value)) errors.push(`${label(path)}: 時刻は HH:MM で指定してください`);
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${label(path)}: 形式が正しくありません`);
      return value;
    }

    default:
      return value;
  }
}

export const validateInput = (schema: JsonSchema, input: unknown): ValidationResult => {
  const errors: string[] = [];
  const value = check(schema, input ?? {}, "", errors) as Record<string, unknown>;
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
};
