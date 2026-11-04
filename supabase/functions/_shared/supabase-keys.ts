// Edge Function から Supabase の API(Auth・Storage)を公開キーで呼ぶときのキー。
//
// 本番では自動注入の SUPABASE_ANON_KEY も SUPABASE_PUBLISHABLE_KEYS も API ゲートウェイに「無効なキー」として
// 拒否される(2026-11-05 確認)。サイトに埋め込んでいる公開キー(src/integrations/supabase/client.ts と同じ。
// ブラウザに配っている公開情報)は通るので、本番ではそれを使う。ほかの環境は自動注入のキー。
// 環境変数 PUBLIC_API_KEY があれば最優先(キーを差し替えたとき用)。

const SITE_PUBLIC_KEYS: Record<string, string> = {
  knjbxqiyngztylnzxzln: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJ4cWl5bmd6dHlsbnp4emxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2MjU2NjUsImV4cCI6MjA0OTIwMTY2NX0.7peEOLQF8D39ScsSeFY9Wqb0qD0cWQZ_T37BU1CwG4Y",
};

const projectRef = () => new URL(Deno.env.get("SUPABASE_URL") ?? "http://localhost").hostname.split(".")[0];

const fromPublishableKeys = (): string | null => {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")?.trim();
  if (!raw) return null;
  if (raw.startsWith("sb_publishable_")) return raw;
  try {
    const parsed = JSON.parse(raw);
    const values = typeof parsed === "string" ? [parsed] : Array.isArray(parsed) ? parsed : Object.values(parsed ?? {});
    return values.find((v): v is string => typeof v === "string" && v.length > 0) ?? null;
  } catch {
    return null;
  }
};

export const publicApiKey = (): string => {
  const key = Deno.env.get("PUBLIC_API_KEY") ?? SITE_PUBLIC_KEYS[projectRef()] ?? fromPublishableKeys() ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!key) throw new Error("Missing Supabase public API key");
  return key;
};
