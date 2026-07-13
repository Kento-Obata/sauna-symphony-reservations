import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

// pg_cron から呼ばれる前提。LINE webhook ではないので署名検証ではなく
// CRON_SHARED_SECRET による Bearer 認証を行う。
const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

const TIME_SLOT_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
};

const RULE_DEFAULT_4SLOT_FROM = "2026-06-06";

const WEEKDAY_TIMES: Record<string, [string, string]> = {
  morning: ["10:00", "12:30"],
  afternoon: ["13:30", "16:00"],
  evening: ["17:00", "19:30"],
  night: ["20:00", "22:30"],
};

const WEEKEND_4SLOT_TIMES: Record<string, [string, string]> = {
  morning: ["10:00", "12:30"],
  afternoon: ["13:00", "15:30"],
  evening: ["16:00", "18:30"],
  night: ["19:00", "21:30"],
};

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

const getDb = () => {
  const databaseUrl = Deno.env.get("POSTGRES_URL");
  if (!databaseUrl) throw new Error("Missing POSTGRES_URL");
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function formatJstDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateParts(dateStr: string): { y: number; m: number; d: number; weekday: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

function withWeekday(dateStr: string): string {
  const { weekday } = dateParts(dateStr);
  return `${dateStr} (${WEEKDAY_JA[weekday]})`;
}

function isWeekend(dateStr: string): boolean {
  const { weekday } = dateParts(dateStr);
  return weekday === 0 || weekday === 6;
}

function defaultSlotTime(date: string, slot: string): [string, string] | null {
  const useWeekend = date >= RULE_DEFAULT_4SLOT_FROM && isWeekend(date);
  const map = useWeekend ? WEEKEND_4SLOT_TIMES : WEEKDAY_TIMES;
  return map[slot] ?? null;
}

function formatSlotTime(
  date: string,
  slot: string,
  startOverride: string | null,
  endOverride: string | null,
): string {
  if (startOverride && endOverride) return `${startOverride}-${endOverride}`;
  const def = defaultSlotTime(date, slot);
  return def ? `${def[0]}-${def[1]}` : slot;
}

type Reservation = {
  date: string;
  time_slot: string;
  guest_name: string;
  guest_count: number;
  phone: string | null;
  water_temperature: number | null;
  total_price: number | null;
  reservation_code: string;
  start_time: string | null;
  end_time: string | null;
};

function formatReservationLine(r: Reservation): string {
  const time = formatSlotTime(r.date, r.time_slot, r.start_time, r.end_time);
  return [
    `🕐 ${time}｜${r.guest_name} 様 ${r.guest_count}名`,
    `  📞 ${r.phone ?? "-"}`,
    `  💧 ${r.water_temperature ?? "-"}℃ ¥${(r.total_price ?? 0).toLocaleString()}`,
    `  🔖 R-${r.reservation_code}`,
  ].join("\n");
}

function buildMessage(date: string, rows: Reservation[]): string {
  const heading = `☀ おはようございます\n\n📅 ${withWeekday(date)}`;
  if (rows.length === 0) {
    return `${heading}\n\n本日の予約はありません。`;
  }
  const header = `${heading} の予約 ${rows.length}件`;
  return [header, "", ...rows.map(formatReservationLine)].join("\n\n");
}

async function pushToUser(userId: string, accessToken: string, text: string): Promise<{ ok: boolean; status: number; body?: string }> {
  const safe = text.length > 4900 ? text.slice(0, 4900) + "\n…(略)" : text;
  const res = await fetch(LINE_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: safe }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, body };
  }
  return { ok: true, status: res.status };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("method not allowed", { status: 405 });
  }

  const accessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  const cronSecret = Deno.env.get("CRON_SHARED_SECRET");
  if (!accessToken || !cronSecret) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN or CRON_SHARED_SECRET");
    return new Response("server misconfigured", { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) {
    return new Response("unauthorized", { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < authHeader.length; i++) {
    diff |= authHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return new Response("unauthorized", { status: 401 });
  }

  const groupId = Deno.env.get("STAFF_PUSH_GROUP_ID");
  if (!groupId) {
    console.error("STAFF_PUSH_GROUP_ID not set");
    return new Response(
      JSON.stringify({ error: "STAFF_PUSH_GROUP_ID not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const sql = getDb();
  try {
    const today = formatJstDate(jstNow());

    // status は管理画面カレンダー（AdminCalendar / useAdminReservations）と同一基準。
    // != 'cancelled' だと expired（決済期限切れの失効予約）まで通知してしまう。
    const rows = await sql<Reservation[]>`
      select r.date::text, r.time_slot::text, r.guest_name, r.guest_count, r.phone,
             r.water_temperature, r.total_price, r.reservation_code,
             to_char(d.start_time, 'HH24:MI') as start_time,
             to_char(d.end_time, 'HH24:MI') as end_time
      from public.reservations r
      left join public.daily_time_slots d
        on d.date = r.date and d.time_slot = r.time_slot and d.is_active = true
      where r.date = ${today}
        and r.status in ('confirmed', 'pending', 'pending_payment')
    `;
    rows.sort((a, b) => (TIME_SLOT_ORDER[a.time_slot] ?? 99) - (TIME_SLOT_ORDER[b.time_slot] ?? 99));

    const message = buildMessage(today, rows);
    const result = await pushToUser(groupId, accessToken, message);

    if (!result.ok) {
      console.error("Group push failed", { groupId, status: result.status, body: result.body });
    }

    return new Response(
      JSON.stringify({
        date: today,
        reservations: rows.length,
        target: groupId,
        ok: result.ok,
        status: result.status,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("daily push error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
