import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { formatYmdWithWeekday, getJstTodayYmd } from "../_shared/date-jst.ts";
import { formatReservationTime } from "../_shared/reservation-time.ts";
import { pushLineMessage } from "../_shared/line.ts";
import { listShifts } from "../_shared/shift-service.ts";
import { formatDailyShiftBlock } from "../_shared/shift-bot.ts";

// pg_cron から毎朝 08:00 JST (cron: 0 23 * * * UTC) に呼ばれる前提。
// LINE webhook ではないので署名検証ではなく CRON_SHARED_SECRET による Bearer 認証を行う。
//
// 動作確認用: `?dry_run=1` (または body {"dry_run":true}) を付けると LINE へ送らず
// メッセージ本文を JSON で返す。dry_run 時のみ `date=YYYY-MM-DD` で対象日を差し替え可。

const TIME_SLOT_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
};

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get("POSTGRES_URL") ?? Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) throw new Error("Missing POSTGRES_URL / SUPABASE_DB_URL");
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

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

// 予約行に保存された実時刻（作成時に DB トリガーが確定）をそのまま表示する。
// time_slot や日付から時刻を計算してはいけない（過去に計算ロジックの重複でズレた）。
const formatSlotTime = (r: Reservation): string => formatReservationTime(r) || r.time_slot;

function formatReservationLine(r: Reservation): string {
  return [
    `🕐 ${formatSlotTime(r)}｜${r.guest_name} 様 ${r.guest_count}名`,
    `  📞 ${r.phone ?? "-"}`,
    `  💧 ${r.water_temperature ?? "-"}℃ ¥${(r.total_price ?? 0).toLocaleString()}`,
    `  🔖 R-${r.reservation_code}`,
  ].join("\n");
}

function buildMessage(date: string, shiftBlock: string, rows: Reservation[]): string {
  const heading = `☀ おはようございます\n\n📅 ${formatYmdWithWeekday(date)}`;
  const reservationBlock = rows.length === 0
    ? "本日の予約はありません。"
    : [`🛁 本日の予約 ${rows.length}件`, ...rows.map(formatReservationLine)].join("\n\n");
  return [heading, shiftBlock, reservationBlock].join("\n\n");
}

const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

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

  const url = new URL(req.url);
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  if (req.method === "POST") {
    body = await req.json().catch(() => ({}));
  }
  const dryRun = url.searchParams.get("dry_run") === "1" || body?.dry_run === true;
  const dateOverride = url.searchParams.get("date") ?? body?.date;

  const sql = getDb();
  try {
    const today = dryRun && isYmd(dateOverride) ? dateOverride : getJstTodayYmd();

    // status は管理画面カレンダー（AdminCalendar / useAdminReservations）と同一基準。
    // != 'cancelled' だと expired（決済期限切れの失効予約）まで通知してしまう。
    const rows = await sql<Reservation[]>`
      select r.date::text, r.time_slot::text, r.guest_name, r.guest_count, r.phone,
             r.water_temperature, r.total_price, r.reservation_code,
             r.start_time::text, r.end_time::text
      from public.reservations r
      where r.date = ${today}
        and r.status in ('confirmed', 'pending', 'pending_payment')
    `;
    rows.sort((a: Reservation, b: Reservation) => (TIME_SLOT_ORDER[a.time_slot] ?? 99) - (TIME_SLOT_ORDER[b.time_slot] ?? 99));

    const shifts = await listShifts(sql, today, today);
    const message = buildMessage(today, formatDailyShiftBlock(shifts), rows);

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, date: today, shifts: shifts.length, reservations: rows.length, message }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await pushLineMessage(groupId, message, accessToken);
    if (!result.ok) {
      console.error("Group push failed", { groupId, status: result.status, body: result.body });
    }

    return new Response(
      JSON.stringify({
        date: today,
        shifts: shifts.length,
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
