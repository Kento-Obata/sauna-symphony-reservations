import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { getClientIp, isRateLimited, recordAttempt } from "../_shared/rate-limit.ts";
import { getJstTodayYmd } from "../_shared/date-jst.ts";
import { herbErrorMessage, isHerbChoice, normalizeHerbTiers } from "../_shared/herb.ts";

// お客様がマイページからハーブ蒸しの選び方・ブレンドを変更する。
// 本人確認は get-reservation-by-code と同じ(予約詳細リンクのトークン or 電話番号下4桁)。
// 締切は利用日の前日24時(JST)。当日は受付でスタッフが管理画面から変更する。
// 中身の検証とスナップショット作成は DB 関数 build_herb_selection() が行う。

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION = "herb-update";
const CODE_MAX = 5;   // failed attempts per reservation code
const IP_MAX = 20;    // failed attempts per IP
const WINDOW_MIN = 15;

// 変更できる予約: 確定済み + メール確認待ちの仮予約(決済手続き中・取消・失効は不可)
const EDITABLE_STATUSES = ['confirmed', 'pending'];

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const getDb = () => {
  const databaseUrl = Deno.env.get('POSTGRES_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!databaseUrl) throw new Error('Missing POSTGRES_URL / SUPABASE_DB_URL');
  return postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getDb();

  try {
    const body = await req.json().catch(() => ({}));
    const { reservationCode, accessToken, phoneLastFourDigits, herbChoice } = body || {};

    if (typeof reservationCode !== "string" || !/^[A-Z0-9]{8}$/.test(reservationCode)) {
      return json({ error: "予約コードが必要です" }, 400);
    }
    const herbTiers = normalizeHerbTiers(body?.herbTiers);
    if (!isHerbChoice(herbChoice) || herbTiers === null) {
      return json({ error: "ハーブの選び方の指定が正しくありません" }, 400);
    }

    const ip = getClientIp(req);
    if (await isRateLimited(sql, [
      { action: ACTION, identifier: reservationCode, max: CODE_MAX, windowMinutes: WINDOW_MIN },
      { action: ACTION, identifier: ip, max: IP_MAX, windowMinutes: WINDOW_MIN },
    ])) {
      return json({ error: "試行回数が多すぎます。しばらく時間をおいて再度お試しください。" }, 429);
    }

    const rows = await sql`
      select id::text, date::text, status, phone, access_token
      from public.reservations
      where reservation_code = ${reservationCode}
      limit 1
    `;
    const reservation = rows[0];

    let authorized = false;
    if (reservation && typeof accessToken === "string" && reservation.access_token) {
      if (safeEqual(accessToken, reservation.access_token)) authorized = true;
    }
    if (reservation && !authorized && typeof phoneLastFourDigits === "string") {
      const digits = phoneLastFourDigits.replace(/\D/g, "");
      const last4 = (reservation.phone || "").replace(/\D/g, "").slice(-4);
      if (digits.length === 4 && last4.length === 4 && safeEqual(digits, last4)) authorized = true;
    }
    if (!reservation || !authorized) {
      await recordAttempt(sql, ACTION, reservation ? [reservationCode, ip] : [ip], false);
      return json({ error: "認証が必要です", requiresAuth: true }, 401);
    }

    if (!EDITABLE_STATUSES.includes(reservation.status)) {
      return json({ error: "このご予約は変更できません" }, 409);
    }
    // 前日24時(JST)まで = 今日が利用日より前
    if (getJstTodayYmd() >= reservation.date) {
      return json({ error: "ハーブの変更は前日24時までです　当日は受付でスタッフにお申し付けください" }, 409);
    }

    const updated = await sql`
      update public.reservations
      set herb_choice = ${herbChoice},
          herb_selection = public.build_herb_selection(${herbChoice}, ${sql.json(herbTiers)}::jsonb),
          herb_updated_at = now(),
          herb_updated_by = 'customer'
      where id = ${reservation.id}::uuid
      returning herb_choice, herb_selection
    `;

    return json({ herb_choice: updated[0].herb_choice, herb_selection: updated[0].herb_selection });
  } catch (error) {
    const herbMessage = herbErrorMessage(error);
    if (herbMessage) return json({ error: herbMessage }, 400);
    console.error("update-reservation-herbs error:", error);
    return json({ error: "ハーブの変更に失敗しました　時間をおいて再度お試しください" }, 500);
  } finally {
    await sql.end({ timeout: 1 });
  }
};

serve(handler);
