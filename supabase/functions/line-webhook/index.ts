import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
  night: "20:00-22:30",
};
const VALID_SLOTS = new Set(["morning", "afternoon", "evening", "night"]);

function getSupabaseSecretKey(): string {
  const resolveKey = (candidate?: string): string => {
    if (!candidate) return "";
    if (candidate.startsWith("sb_secret_") || candidate.startsWith("eyJ")) return candidate;
    return Deno.env.get(candidate) ?? "";
  };

  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysJson) {
    try {
      const keys = JSON.parse(secretKeysJson) as Record<string, string>;
      const secretKey = resolveKey(keys.default) || Object.values(keys).map(resolveKey).find(Boolean);
      if (secretKey) return secretKey;
    } catch (error) {
      console.error("SUPABASE_SECRET_KEYS parse failed:", error);
    }
  }

  return resolveKey("SUPABASE_SECRET_KEY") || resolveKey("SUPABASE_SERVICE_ROLE_KEY");
}

function describeSupabaseKey(key: string): string {
  if (!key) return "missing";
  if (key.startsWith("sb_secret_")) return "sb_secret";
  if (key.startsWith("eyJ")) return "jwt_legacy";
  return "unknown_format";
}

function createSupabaseAdminClient(url: string, key: string) {
  const shouldStripAuthHeader = key.startsWith("sb_secret_");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init = {}) => {
        if (!shouldStripAuthHeader) return fetch(input, init);
        const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
        const auth = headers.get("authorization") ?? "";
        if (auth === `Bearer ${key}`) headers.delete("authorization");
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const HELP_TEXT = [
  "📖 使い方",
  "",
  "▼ 照会",
  "・今日 / 明日 / 2026-06-15",
  "・照会 ABCD1234  (予約コード)",
  "",
  "▼ 操作",
  "・キャンセル ABCD1234",
  "・追加 2026-06-15 morning 2 山田太郎 09012345678",
  "  時間帯: morning / afternoon / evening / night",
  "",
  "・ID  自分のLINE userIdを表示",
  "・ヘルプ  このメッセージ",
].join("\n");

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function lineReply(token: string, replyToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  });
  if (!res.ok) console.error("LINE reply failed:", res.status, await res.text());
}

function formatReservationLine(r: any): string {
  const slot = TIME_SLOT_LABELS[r.time_slot] ?? r.time_slot;
  const status =
    r.status === "confirmed" ? "✅" : r.status === "pending" ? "⏳" : r.status === "cancelled" ? "❌" : "・";
  return `${status} ${slot} ${r.guest_name}様(${r.guest_count}名) [${r.reservation_code ?? "----"}]`;
}

function parseDateKeyword(token: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (token === "今日" || token.toLowerCase() === "today") {
    return today.toISOString().split("T")[0];
  }
  if (token === "明日" || token.toLowerCase() === "tomorrow") {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
  return null;
}

async function handleCommand(
  text: string,
  supabase: any,
  user: { line_user_id: string; can_write: boolean; display_name: string }
): Promise<string> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return HELP_TEXT;
  if (trimmed.length > 500) return "メッセージが長すぎます。";

  const lower = trimmed.toLowerCase();
  if (lower === "help" || trimmed === "ヘルプ" || trimmed === "?" || trimmed === "？") {
    return HELP_TEXT;
  }
  if (lower === "id") {
    return `あなたのLINE userId:\n${user.line_user_id}`;
  }

  // Date keyword → list reservations of that day
  const dateOnly = parseDateKeyword(trimmed);
  if (dateOnly) {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("date", dateOnly)
      .neq("status", "cancelled")
      .order("time_slot");
    if (error) return `エラー: ${error.message}`;
    if (!data || data.length === 0) return `📅 ${dateOnly}\n予約はありません。`;
    return [`📅 ${dateOnly} の予約 (${data.length}件)`, "", ...data.map(formatReservationLine)].join("\n");
  }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];

  // 照会 [code]
  if (cmd === "照会" || cmd.toLowerCase() === "show") {
    const code = parts[1];
    if (!code || !/^[A-Z0-9]{8}$/.test(code)) return "予約コードは英数字8桁で指定してください。例: 照会 ABCD1234";
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("reservation_code", code)
      .maybeSingle();
    if (error) return `エラー: ${error.message}`;
    if (!data) return "予約が見つかりませんでした。";
    const slot = TIME_SLOT_LABELS[data.time_slot] ?? data.time_slot;
    const lines = [
      `🎫 ${data.reservation_code}`,
      `📅 ${data.date} (${slot})`,
      `👤 ${data.guest_name} 様 / ${data.guest_count}名`,
      `📞 ${data.phone}`,
      data.email ? `✉️ ${data.email}` : "",
      `💰 ¥${(data.total_price ?? 0).toLocaleString()}`,
      `🌡️ ${data.water_temperature}°C`,
      `状態: ${data.status}`,
    ].filter(Boolean);
    return lines.join("\n");
  }

  // キャンセル [code]
  if (cmd === "キャンセル" || cmd.toLowerCase() === "cancel") {
    if (!user.can_write) return "キャンセル権限がありません。";
    const code = parts[1];
    if (!code || !/^[A-Z0-9]{8}$/.test(code)) return "予約コードは英数字8桁で指定してください。例: キャンセル ABCD1234";
    const { data: existing, error: fetchErr } = await supabase
      .from("reservations")
      .select("*")
      .eq("reservation_code", code)
      .maybeSingle();
    if (fetchErr) return `エラー: ${fetchErr.message}`;
    if (!existing) return "予約が見つかりませんでした。";
    if (existing.status === "cancelled") return "この予約はすでにキャンセル済みです。";

    const { error: updErr } = await supabase
      .from("reservations")
      .update({ status: "cancelled", is_confirmed: true })
      .eq("reservation_code", code);
    if (updErr) return `キャンセルに失敗しました: ${updErr.message}`;

    // notify other staff
    await supabase.functions.invoke("line-notify-staff", {
      body: {
        event: "cancelled",
        reservation: existing,
        note: `LINE Botより (${user.display_name})`,
      },
    }).catch(() => {});

    return `❌ キャンセル完了: ${code}\n${existing.date} ${TIME_SLOT_LABELS[existing.time_slot] ?? ""}\n${existing.guest_name} 様`;
  }

  // 追加 YYYY-MM-DD slot guests name phone
  if (cmd === "追加" || cmd.toLowerCase() === "add") {
    if (!user.can_write) return "予約追加の権限がありません。";
    if (parts.length < 6) {
      return "形式: 追加 YYYY-MM-DD [morning|afternoon|evening|night] 人数 氏名 電話\n例: 追加 2026-06-15 morning 2 山田太郎 09012345678";
    }
    const [, date, slot, countStr, name, phone, ...rest] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "日付は YYYY-MM-DD の形式で指定してください。";
    if (!VALID_SLOTS.has(slot)) return "時間帯は morning / afternoon / evening / night のいずれかを指定してください。";
    const guestCount = parseInt(countStr, 10);
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 20) return "人数は1〜20の整数で指定してください。";
    if (!name || name.length > 100) return "氏名は1〜100文字で指定してください。";
    const phoneDigits = phone.replace(/[^\d]/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) return "電話番号の形式が正しくありません。";
    if (rest.length > 0) {
      return "引数が多すぎます。氏名にスペースを含めないでください。";
    }

    // Check availability
    const { data: existing } = await supabase
      .from("reservations")
      .select("id")
      .eq("date", date)
      .eq("time_slot", slot)
      .neq("status", "cancelled");
    if (existing && existing.length > 0) return "この時間帯はすでに予約が入っています。";

    // Price
    let basePrice = guestCount * 3000;
    const { data: ps } = await supabase
      .from("price_settings")
      .select("price_per_person")
      .eq("guest_count", guestCount)
      .maybeSingle();
    if (ps?.price_per_person) basePrice = ps.price_per_person * guestCount;

    const { data: inserted, error: insErr } = await supabase
      .from("reservations")
      .insert({
        date,
        time_slot: slot,
        guest_name: name,
        guest_count: guestCount,
        phone,
        email: null,
        water_temperature: 15,
        status: "confirmed",
        is_confirmed: true,
        total_price: basePrice,
      })
      .select()
      .single();
    if (insErr) return `予約追加に失敗しました: ${insErr.message}`;

    await supabase.functions.invoke("line-notify-staff", {
      body: {
        event: "created",
        reservation: inserted,
        note: `LINE Botより (${user.display_name})`,
      },
    }).catch(() => {});

    return `✅ 予約追加完了\n🎫 ${inserted.reservation_code}\n📅 ${date} (${TIME_SLOT_LABELS[slot]})\n👤 ${name} 様 / ${guestCount}名\n💰 ¥${basePrice.toLocaleString()}`;
  }

  return `不明なコマンドです。\n\n${HELP_TEXT}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const secret = Deno.env.get("LINE_CHANNEL_SECRET");
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!secret || !token) {
    console.error("LINE secrets not configured");
    return new Response("LINE not configured", { status: 500, headers: corsHeaders });
  }

  const signature = req.headers.get("x-line-signature") ?? "";
  const rawBody = await req.text();

  if (!signature || !(await verifySignature(secret, rawBody, signature))) {
    console.warn("Invalid LINE signature");
    return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseSecretKey = getSupabaseSecretKey();
  console.log("Supabase admin key status:", {
    has_url: !!supabaseUrl,
    key_type: describeSupabaseKey(supabaseSecretKey),
    has_secret_keys_json: !!Deno.env.get("SUPABASE_SECRET_KEYS"),
    has_secret_key: !!Deno.env.get("SUPABASE_SECRET_KEY"),
    has_legacy_service_role_key: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  });
  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("Supabase admin credentials are not available");
    return new Response("Supabase not configured", { status: 500, headers: corsHeaders });
  }

  const supabase = createSupabaseAdminClient(supabaseUrl, supabaseSecretKey);

  const events = Array.isArray(payload.events) ? payload.events : [];

  for (const ev of events) {
    try {
      if (ev.type !== "message" || ev.message?.type !== "text") continue;
      const replyToken = ev.replyToken;
      const userId = ev.source?.userId;
      const text: string = ev.message.text ?? "";

      if (!replyToken) continue;

      if (!userId) {
        await lineReply(token, replyToken, "userIdが取得できませんでした。1:1チャットでご利用ください。");
        continue;
      }

      // Lookup user
      const { data: user, error: lookupErr } = await supabase
        .from("line_allowed_users")
        .select("line_user_id, display_name, is_active, can_write")
        .eq("line_user_id", userId)
        .maybeSingle();

      console.log("LINE webhook lookup:", {
        incoming_userId: userId,
        incoming_length: userId.length,
        text,
        found: !!user,
        is_active: user?.is_active,
        lookup_error: lookupErr?.message,
      });

      if (!user || !user.is_active) {
        // Allow `ID` command for self-discovery even when not registered
        if (text.trim().toLowerCase() === "id") {
          await lineReply(token, replyToken, `あなたのLINE userId:\n${userId}\n\n管理者にこのIDを登録してもらってください。`);
        } else {
          await lineReply(
            token,
            replyToken,
            `このBotの使用権限がありません。\n受信ID: ${userId}\n登録状況: ${user ? "無効化されています" : "未登録"}\n「ID」と送信して表示されるuserIdを管理者に伝えてください。`
          );
        }
        continue;
      }

      const reply = await handleCommand(text, supabase, {
        line_user_id: user.line_user_id,
        can_write: user.can_write,
        display_name: user.display_name,
      });
      await lineReply(token, replyToken, reply);
    } catch (e) {
      console.error("event handler error:", e);
    }
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
