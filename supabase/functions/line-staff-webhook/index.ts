import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { addJstDays, formatYmdWithWeekday, getJstTodayYmd } from "../_shared/date-jst.ts";
import { formatReservationTime } from "../_shared/reservation-time.ts";
import { pushLineMessage, replyLineMessage, verifyLineSignature } from "../_shared/line.ts";
import { parseShiftCommand, SHIFT_HELP_TEXT } from "../_shared/shift-bot.ts";
import { executeShiftCommand, resolveLineStaff } from "../_shared/shift-service.ts";

// スタッフ用 LINE bot の webhook。
//  - 予約照会（日付 / 予約コード / 電話番号）
//  - シフト確認・追加・変更・削除（_shared/shift-bot.ts, shift-service.ts）
// 仕様: docs/line-shift-bot.md
//
// LINE Developers コンソールの Webhook URL にこの関数を設定し、
// LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN / STAFF_PUSH_GROUP_ID / POSTGRES_URL を secrets に登録する。

// LINE webhook はブラウザから叩かない想定だが、health check 用に最小限の CORS を許容
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-line-signature, content-type",
};

const TIME_SLOT_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
};

const HELP_TEXT = [
  "📖 コマンド一覧",
  "",
  "▼ 予約",
  "・今日 / 明日 / 明後日 → その日の予約",
  "・MM/DD 例: 5/25 → 指定日の予約",
  "・R-XXXXXXXX     → 予約コードで詳細",
  "・電話番号(10〜11桁) → 顧客サマリと履歴",
  "",
  "▼ シフト",
  "・シフト / シフト 明日 / シフト 今週",
  "・マイシフト",
  "・シフト追加 10/3 14:30-22:00 休憩60",
  "・シフト変更 10/3 15:00-22:00",
  "・シフト削除 10/3",
  "・シフト ヘルプ  → シフト操作の詳細",
  "",
  "▼ その他",
  "・使い方 → 詳しい使い方ガイド",
  "・ID     → 自分の LINE userId 表示",
  "・ヘルプ → このメッセージ",
].join("\n");

const GUIDE_TEXT = [
  "🛁 スタッフ用 予約・シフト LINE bot ガイド",
  "",
  "コマンドはこのトークルームに送信するだけでOK。",
  "",
  "━━━━━━━━━━━━━━",
  "【1】予約一覧を確認",
  "━━━━━━━━━━━━━━",
  "・「今日」「明日」「明後日」",
  "・「5/25」「2026-05-25」 → 指定日",
  "※ キャンセル・失効は表示されません",
  "",
  "━━━━━━━━━━━━━━",
  "【2】予約コードで詳細",
  "━━━━━━━━━━━━━━",
  "・「R-A1B2C3D4」または「A1B2C3D4」",
  "→ 名前/人数/電話/水温/メモ等",
  "",
  "━━━━━━━━━━━━━━",
  "【3】顧客情報を確認",
  "━━━━━━━━━━━━━━",
  "・「09012345678」(電話番号)",
  "→ 過去の利用回数・初回/直近・履歴10件",
  "",
  "━━━━━━━━━━━━━━",
  "【4】シフト",
  "━━━━━━━━━━━━━━",
  "・「シフト」 → 今日のシフト",
  "・「シフト 明日」「シフト 10/3」「シフト 今週」",
  "・「マイシフト」 → 自分の今後2週間",
  "・「シフト追加 10/3 14:30-22:00 休憩60」",
  "・「シフト変更 10/3 15:00-22:00」",
  "・「シフト削除 10/3」",
  "※ 管理者は名前を付けて他の人のシフトも操作可",
  "※ 追加・変更・削除はグループにも通知されます",
  "",
  "━━━━━━━━━━━━━━",
  "🌅 自動配信",
  "━━━━━━━━━━━━━━",
  "毎朝8時に本日のシフトと予約が",
  "自動でこのトークに届きます。",
  "",
  "🔒 登録済みスタッフのみ操作可能です。",
].join("\n");

const getDb = () => {
  // 本番は POSTGRES_URL（プーラ）を使用。未設定環境（staging 等）では
  // Supabase が自動提供する SUPABASE_DB_URL にフォールバックする（本番は挙動不変）。
  const databaseUrl = Deno.env.get("POSTGRES_URL") ?? Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) throw new Error("Missing POSTGRES_URL / SUPABASE_DB_URL");
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

// 入力文字列を YYYY-MM-DD に正規化。解釈不能なら null
function parseDateCommand(text: string, today: string): string | null {
  const t = text.trim();
  if (t === "今日" || t === "きょう" || t.toLowerCase() === "today") return today;
  if (t === "明日" || t === "あした" || t.toLowerCase() === "tomorrow") return addJstDays(today, 1);
  if (t === "明後日" || t === "あさって") return addJstDays(today, 2);

  // YYYY-MM-DD / YYYY/MM/DD
  const full = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (full) {
    const [, y, m, d] = full;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // MM/DD or MM-DD → 当年で解釈。30日以上過去なら翌年扱い
  const md = t.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (md) {
    const [, m, d] = md;
    const year = Number(today.slice(0, 4));
    const candidate = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const diffDays = (Date.parse(`${candidate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
    if (diffDays < -30) {
      return `${year + 1}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return candidate;
  }
  return null;
}

function parseReservationCode(text: string): string | null {
  const t = text.trim().toUpperCase();
  // R-XXXXXXXX 形式、または素の 8 桁英数字
  const m = t.match(/^R-([A-Z0-9]{8})$/) || t.match(/^([A-Z0-9]{8})$/);
  return m ? m[1] : null;
}

// 「09012345678」「090-1234-5678」「090 1234 5678」「顧客 09012345678」などを許容
function parsePhoneCommand(text: string): string | null {
  const stripped = text.trim().replace(/^(顧客|客|customer)\s*/i, "");
  const digits = stripped.replace(/[-\s()]/g, "");
  if (/^0\d{9,10}$/.test(digits)) return digits;
  return null;
}

type Reservation = {
  date: string;
  time_slot: string;
  guest_name: string;
  guest_count: number;
  phone: string | null;
  email: string | null;
  water_temperature: number | null;
  status: string;
  total_price: number | null;
  reservation_code: string;
  admin_memo: string | null;
  start_time: string | null;
  end_time: string | null;
};

// 予約行に保存された実時刻（作成時に DB トリガーが確定）をそのまま表示する。
// time_slot や日付から時刻を計算してはいけない（過去に計算ロジックの重複でズレた）。
const formatSlotTime = (r: Reservation): string => formatReservationTime(r) || r.time_slot;

function formatReservationLine(r: Reservation): string {
  const cancelled = r.status === "cancelled" ? " ❌キャンセル" : "";
  return [
    `🕐 ${formatSlotTime(r)}｜${r.guest_name} 様 ${r.guest_count}名${cancelled}`,
    `  📞 ${r.phone ?? "-"}`,
    `  💧 ${r.water_temperature ?? "-"}℃ ¥${(r.total_price ?? 0).toLocaleString()}`,
    `  🔖 R-${r.reservation_code}`,
  ].join("\n");
}

function formatReservationDetail(r: Reservation): string {
  const lines = [
    `🔖 R-${r.reservation_code}`,
    `📅 ${formatYmdWithWeekday(r.date)} ${formatSlotTime(r)}`,
    `👤 ${r.guest_name} 様 / ${r.guest_count}名`,
    `📞 ${r.phone ?? "-"}`,
    `✉ ${r.email ?? "-"}`,
    `💧 水温 ${r.water_temperature ?? "-"}℃`,
    `💴 ¥${(r.total_price ?? 0).toLocaleString()}`,
    `📌 ${r.status}`,
  ];
  if (r.admin_memo) {
    lines.push("", `📝 ${r.admin_memo}`);
  }
  return lines.join("\n");
}

type CustomerSummary = {
  latest_name: string | null;
  latest_email: string | null;
  total_confirmed: number;
  past_visits: number;
  upcoming: number;
  total_cancelled: number;
  first_visit: string | null;
  last_visit: string | null;
};

function formatCustomerSummary(phone: string, s: CustomerSummary, history: Reservation[]): string {
  const lines = [
    `👤 ${s.latest_name ?? "(名前不明)"} 様`,
    `📞 ${phone}`,
    `✉ ${s.latest_email ?? "-"}`,
    "",
    "📊 利用統計",
    `  ・確定予約: ${s.total_confirmed}件 (来店済 ${s.past_visits} / 今後 ${s.upcoming})`,
    `  ・キャンセル: ${s.total_cancelled}件`,
    `  ・初回: ${s.first_visit ?? "-"}`,
    `  ・直近: ${s.last_visit ?? "-"}`,
  ];

  if (history.length > 0) {
    lines.push("", `🕘 直近 ${history.length}件`);
    for (const r of history) {
      const mark = r.status === "cancelled" ? "❌" : "✓";
      lines.push(`・${r.date} ${formatSlotTime(r)} | ${r.guest_count}名 ${mark} R-${r.reservation_code}`);
    }
  }
  return lines.join("\n");
}

// テキストが認識可能なコマンドかどうかを判定する。
// グループでの雑談や個人 DM の雑な打鍵に毎回返信しないよう、
// 認識できないメッセージは呼び出し側で silent にする。
function isRecognizedReservationCommand(text: string, today: string): boolean {
  const t = text.trim();
  if (t === "ヘルプ" || t.toLowerCase() === "help") return true;
  if (t === "使い方" || t === "ガイド" || t.toLowerCase() === "usage" || t.toLowerCase() === "guide") return true;
  if (parseReservationCode(t)) return true;
  if (parseDateCommand(t, today)) return true;
  if (parsePhoneCommand(t)) return true;
  return false;
}

async function handleReservationCommand(
  sql: ReturnType<typeof getDb>,
  text: string,
  today: string,
): Promise<string | null> {
  const trimmed = text.trim();

  if (trimmed === "ヘルプ" || trimmed.toLowerCase() === "help") {
    return HELP_TEXT;
  }

  if (trimmed === "使い方" || trimmed === "ガイド" || trimmed.toLowerCase() === "usage" || trimmed.toLowerCase() === "guide") {
    return GUIDE_TEXT;
  }

  const code = parseReservationCode(trimmed);
  if (code) {
    const rows = await sql<Reservation[]>`
      select r.date::text, r.time_slot::text, r.guest_name, r.guest_count, r.phone, r.email,
             r.water_temperature, r.status, r.total_price, r.reservation_code, r.admin_memo,
             r.start_time::text, r.end_time::text
      from public.reservations r
      where r.reservation_code = ${code}
      limit 1
    `;
    if (rows.length === 0) {
      return `予約が見つかりません: R-${code}`;
    }
    return formatReservationDetail(rows[0]);
  }

  const date = parseDateCommand(trimmed, today);
  if (date) {
    // status は日次 push / 管理画面カレンダーと同一基準（expired の失効予約を含めない）
    const rows = await sql<Reservation[]>`
      select r.date::text, r.time_slot::text, r.guest_name, r.guest_count, r.phone, r.email,
             r.water_temperature, r.status, r.total_price, r.reservation_code, r.admin_memo,
             r.start_time::text, r.end_time::text
      from public.reservations r
      where r.date = ${date}
        and r.status in ('confirmed', 'pending', 'pending_payment')
    `;
    rows.sort((a: Reservation, b: Reservation) => (TIME_SLOT_ORDER[a.time_slot] ?? 99) - (TIME_SLOT_ORDER[b.time_slot] ?? 99));

    if (rows.length === 0) {
      return `📅 ${formatYmdWithWeekday(date)}\n\n予約はありません`;
    }
    const header = `📅 ${formatYmdWithWeekday(date)} の予約 ${rows.length}件`;
    return [header, "", ...rows.map(formatReservationLine)].join("\n\n");
  }

  const phone = parsePhoneCommand(trimmed);
  if (phone) {
    const [summary] = await sql<CustomerSummary[]>`
      select
        max(guest_name) filter (where status != 'cancelled') as latest_name,
        max(email)       filter (where status != 'cancelled') as latest_email,
        count(*)         filter (where status != 'cancelled')::int as total_confirmed,
        count(*)         filter (where status != 'cancelled' and date <  current_date)::int as past_visits,
        count(*)         filter (where status != 'cancelled' and date >= current_date)::int as upcoming,
        count(*)         filter (where status =  'cancelled')::int as total_cancelled,
        min(date) filter (where status != 'cancelled')::text as first_visit,
        max(date) filter (where status != 'cancelled')::text as last_visit
      from public.reservations
      where phone = ${phone}
    `;
    if (!summary || summary.total_confirmed + summary.total_cancelled === 0) {
      return `該当する予約履歴が見つかりません: ${phone}`;
    }
    const history = await sql<Reservation[]>`
      select r.date::text, r.time_slot::text, r.guest_name, r.guest_count, r.phone, r.email,
             r.water_temperature, r.status, r.total_price, r.reservation_code, r.admin_memo,
             r.start_time::text, r.end_time::text
      from public.reservations r
      where r.phone = ${phone}
      order by r.date desc, r.time_slot desc
      limit 10
    `;
    return formatCustomerSummary(phone, summary, history);
  }

  // isRecognizedReservationCommand で事前にフィルタしているので、ここには来ない想定
  return null;
}

// deno-lint-ignore no-explicit-any
type LineEvent = any;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
  const accessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!channelSecret || !accessToken) {
    console.error("Missing LINE_CHANNEL_SECRET or LINE_CHANNEL_ACCESS_TOKEN");
    return new Response("server misconfigured", { status: 500 });
  }
  const pushGroupId = Deno.env.get("STAFF_PUSH_GROUP_ID") ?? null;

  const signature = req.headers.get("x-line-signature") ?? "";
  const rawBody = await req.text();

  if (!(await verifyLineSignature(rawBody, signature, channelSecret))) {
    console.warn("Invalid LINE signature");
    return new Response("invalid signature", { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];
  const sql = getDb();

  try {
    for (const ev of events) {
      if (ev?.type !== "message" || ev?.message?.type !== "text") continue;
      const replyToken: string | undefined = ev.replyToken;
      const userId: string | undefined = ev.source?.userId;
      const text: string = ev.message.text ?? "";
      if (!replyToken || !userId) continue;

      const today = getJstTodayYmd();

      // ID コマンドは未登録ユーザーでも応答（初期登録のため）
      const idCmd = text.trim().toLowerCase();
      if (idCmd === "id" || idCmd === "ｉｄ") {
        await replyLineMessage(
          replyToken,
          `あなたの LINE userId:\n${userId}\n\nスタッフ管理者にこの ID を伝えて staff_line_users に登録してもらってください。`,
          accessToken,
        );
        continue;
      }

      // groupid: グループ内で叩いた場合に groupId を返す。daily push の宛先設定に使う
      if (idCmd === "groupid" || text.trim() === "グループID") {
        const sourceType = ev.source?.type;
        const groupId = ev.source?.groupId;
        if (sourceType === "group" && groupId) {
          await replyLineMessage(
            replyToken,
            `このグループの ID:\n${groupId}\n\nスタッフ管理者に伝えて STAFF_PUSH_GROUP_ID にセットしてもらってください。`,
            accessToken,
          );
        } else {
          await replyLineMessage(replyToken, "このコマンドはグループ内で送ってください。", accessToken);
        }
        continue;
      }

      const shiftCmd = parseShiftCommand(text, today);

      // 認識できないメッセージは silent。グループでの雑談に毎回返信させないため。
      if (!shiftCmd && !isRecognizedReservationCommand(text, today)) continue;

      const staff = await resolveLineStaff(sql, userId);
      if (!staff) {
        await replyLineMessage(replyToken, "権限がありません。スタッフ管理者にご連絡ください。", accessToken);
        continue;
      }

      try {
        if (shiftCmd) {
          const result = await executeShiftCommand(sql, shiftCmd, staff, today);
          await replyLineMessage(replyToken, result.reply, accessToken);
          // グループ内で操作した場合は reply 自体がグループに届くので二重通知しない
          const sentInPushGroup = ev.source?.type === "group" && ev.source?.groupId === pushGroupId;
          if (result.notify && pushGroupId && !sentInPushGroup) {
            const pushed = await pushLineMessage(pushGroupId, result.notify, accessToken);
            if (!pushed.ok) console.error("Shift notify push failed", pushed.status, pushed.body);
          }
          continue;
        }
        const reply = await handleReservationCommand(sql, text, today);
        if (reply) await replyLineMessage(replyToken, reply, accessToken);
      } catch (err) {
        console.error("Command failed", err);
        await replyLineMessage(replyToken, "エラーが発生しました。", accessToken);
      }
    }
    return new Response("ok", { status: 200 });
  } finally {
    await sql.end({ timeout: 1 });
  }
};

// 未使用警告回避（ヘルプ本文はシフト側の SHIFT_HELP_TEXT を executeShiftCommand が返す）
void SHIFT_HELP_TEXT;

serve(handler);
