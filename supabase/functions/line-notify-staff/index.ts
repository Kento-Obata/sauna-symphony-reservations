import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
  night: "20:00-22:30",
};

const EVENT_LABELS: Record<string, string> = {
  created: "🆕 仮予約が入りました",
  confirmed: "✅ 予約が確定しました",
  cancelled: "❌ 予約がキャンセルされました",
  updated: "✏️ 予約が変更されました",
};

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

interface NotifyBody {
  event: "created" | "confirmed" | "cancelled" | "updated";
  reservation: {
    date: string;
    time_slot: string;
    guest_name: string;
    guest_count: number;
    phone?: string | null;
    email?: string | null;
    reservation_code?: string | null;
    total_price?: number | null;
    water_temperature?: number | null;
  };
  note?: string;
}

function formatMessage(body: NotifyBody): string {
  const r = body.reservation;
  const header = EVENT_LABELS[body.event] ?? "予約情報の更新";
  const slotLabel = TIME_SLOT_LABELS[r.time_slot] ?? r.time_slot;
  const lines = [
    header,
    "",
    `📅 ${r.date} (${slotLabel})`,
    `👤 ${r.guest_name} 様 / ${r.guest_count}名`,
  ];
  if (r.phone) lines.push(`📞 ${r.phone}`);
  if (r.reservation_code) lines.push(`🎫 予約コード: ${r.reservation_code}`);
  if (typeof r.total_price === "number") lines.push(`💰 ¥${r.total_price.toLocaleString()}`);
  if (body.note) lines.push("", body.note);
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    if (!token) {
      console.warn("LINE_CHANNEL_ACCESS_TOKEN not set, skipping notify");
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as NotifyBody;
    if (!body?.event || !body?.reservation) {
      return new Response(JSON.stringify({ error: "invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseSecretKey = getSupabaseSecretKey();
    if (!supabaseUrl || !supabaseSecretKey) {
      throw new Error("Supabase admin credentials are not available");
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: recipients, error } = await supabase
      .from("line_allowed_users")
      .select("line_user_id")
      .eq("is_active", true)
      .eq("receive_notifications", true);

    if (error) throw error;
    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = formatMessage(body);

    // LINE multicast: up to 500 recipients per request
    const ids = recipients.map((r) => r.line_user_id);
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 500) chunks.push(ids.slice(i, i + 500));

    let sent = 0;
    for (const chunk of chunks) {
      const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: chunk,
          messages: [{ type: "text", text }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("LINE multicast failed:", res.status, errText);
      } else {
        sent += chunk.length;
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("line-notify-staff error:", e);
    return new Response(JSON.stringify({ error: e.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
