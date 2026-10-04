// LINE bot のシフト系コマンドの DB 操作。POSTGRES_URL 直結の postgres.js `sql` を受け取る。
// テキスト解釈・整形は shift-bot.ts（純粋関数）に分離している。
//
// 権限モデル:
//   - staff_line_users.staff_id で LINE ユーザー → profiles を紐付ける（未設定なら操作不可）
//   - 自分のシフトは誰でも追加/変更/削除できる
//   - 名前を指定して他人のシフトを操作できるのは profiles.role = 'admin' のみ
//   - 削除は物理削除ではなく status = 'cancelled'（UI と給与集計は scheduled のみ参照）

import { addJstDays, formatMdWithWeekday } from "./date-jst.ts";
import {
  formatMyShifts,
  formatShiftsForDate,
  formatShiftsForRange,
  formatTimeRange,
  SHIFT_HELP_TEXT,
  type ShiftCommand,
  type ShiftRow,
} from "./shift-bot.ts";

// deno-lint-ignore no-explicit-any
type Sql = any;

export interface LineStaff {
  line_user_id: string;
  display_name: string | null;
  staff_id: string | null;
  username: string | null;
  role: string | null;
}

interface StaffProfile {
  id: string;
  username: string;
  role: string;
}

export interface ShiftCommandResult {
  /** コマンド送信者への返信 */
  reply: string;
  /** 変更があった場合にスタッフグループへ流す通知（無ければ undefined） */
  notify?: string;
}

const MY_SHIFTS_DAYS = 14;

export const resolveLineStaff = async (sql: Sql, lineUserId: string): Promise<LineStaff | null> => {
  const rows = await sql`
    select u.line_user_id, u.display_name, u.staff_id, p.username, p.role
    from public.staff_line_users u
    left join public.profiles p on p.id = u.staff_id
    where u.line_user_id = ${lineUserId} and u.is_active = true
    limit 1
  `;
  return (rows[0] as LineStaff | undefined) ?? null;
};

/** [from, to] (JST 日付) のシフト。staffId 指定で絞り込み。 */
export const listShifts = async (sql: Sql, from: string, to: string, staffId?: string): Promise<ShiftRow[]> => {
  const rows = await sql`
    select s.id, s.staff_id, coalesce(p.username, '(名前未設定)') as username,
           to_char(s.start_time at time zone 'Asia/Tokyo', 'YYYY-MM-DD') as date,
           to_char(s.start_time at time zone 'Asia/Tokyo', 'HH24:MI') as start,
           to_char(s.end_time at time zone 'Asia/Tokyo', 'HH24:MI') as "end",
           coalesce(s.break_minutes, 0)::int as break_minutes
    from public.shifts s
    join public.profiles p on p.id = s.staff_id
    where s.status = 'scheduled'
      and (s.start_time at time zone 'Asia/Tokyo')::date between ${from}::date and ${to}::date
      ${staffId ? sql`and s.staff_id = ${staffId}` : sql``}
    order by s.start_time, p.username
  `;
  return rows as ShiftRow[];
};

/**
 * 名前でスタッフを検索。完全一致 → 部分一致（1件のみ）の順。
 * 複数ヒットは { ambiguous } で候補を返す。
 */
export const findStaffByName = async (
  sql: Sql,
  name: string,
): Promise<{ staff: StaffProfile | null; ambiguous?: string[] }> => {
  const rows = (await sql`
    select id, username, role from public.profiles
    where role in ('staff', 'admin') and username is not null
  `) as StaffProfile[];
  const exact = rows.filter((r) => r.username === name);
  if (exact.length === 1) return { staff: exact[0] };
  if (exact.length > 1) return { staff: null, ambiguous: exact.map((r) => r.username) };
  const partial = rows.filter((r) => r.username.includes(name) || name.includes(r.username));
  if (partial.length === 1) return { staff: partial[0] };
  if (partial.length > 1) return { staff: null, ambiguous: partial.map((r) => r.username) };
  return { staff: null };
};

const toJstTimestamp = (date: string, hhmm: string): string => `${date}T${hhmm}:00+09:00`;

/** 同一スタッフの重複シフト（cancelled 以外）。excludeId は変更対象自身を除外する用。 */
const findOverlap = async (
  sql: Sql,
  staffId: string,
  startTs: string,
  endTs: string,
  excludeId?: string,
): Promise<ShiftRow | null> => {
  const rows = await sql`
    select s.id, s.staff_id, coalesce(p.username, '') as username,
           to_char(s.start_time at time zone 'Asia/Tokyo', 'YYYY-MM-DD') as date,
           to_char(s.start_time at time zone 'Asia/Tokyo', 'HH24:MI') as start,
           to_char(s.end_time at time zone 'Asia/Tokyo', 'HH24:MI') as "end",
           coalesce(s.break_minutes, 0)::int as break_minutes
    from public.shifts s
    join public.profiles p on p.id = s.staff_id
    where s.staff_id = ${staffId}
      and s.status = 'scheduled'
      and s.start_time < ${endTs}::timestamptz
      and s.end_time > ${startTs}::timestamptz
      ${excludeId ? sql`and s.id <> ${excludeId}` : sql``}
    limit 1
  `;
  return (rows[0] as ShiftRow | undefined) ?? null;
};

/** 操作対象スタッフの決定。名前指定は admin のみ。 */
const resolveTarget = async (
  sql: Sql,
  actor: LineStaff,
  staffName: string | null,
): Promise<{ target: StaffProfile } | { error: string }> => {
  if (staffName === null) {
    if (!actor.staff_id || !actor.username) {
      return {
        error: "このLINEアカウントはスタッフに紐付いていません。\n管理者に staff_line_users の staff_id 設定を依頼してください。",
      };
    }
    return { target: { id: actor.staff_id, username: actor.username, role: actor.role ?? "staff" } };
  }
  if (actor.role !== "admin") {
    return { error: "他のスタッフのシフトを操作できるのは管理者のみです。" };
  }
  const found = await findStaffByName(sql, staffName);
  if (found.ambiguous) {
    return { error: `候補が複数あります: ${found.ambiguous.join(" / ")}\n名前を正確に指定してください。` };
  }
  if (!found.staff) return { error: `スタッフが見つかりません: ${staffName}` };
  return { target: found.staff };
};

const byLabel = (actor: LineStaff): string => `（${actor.username ?? actor.display_name ?? "LINE"} が操作）`;

export const executeShiftCommand = async (
  sql: Sql,
  cmd: ShiftCommand,
  actor: LineStaff,
  today: string,
): Promise<ShiftCommandResult> => {
  switch (cmd.kind) {
    case "help":
      return { reply: SHIFT_HELP_TEXT };

    case "error":
      return { reply: `⚠ ${cmd.message}\n\n「シフト ヘルプ」で使い方を表示` };

    case "list": {
      const rows = await listShifts(sql, cmd.date, cmd.date);
      return { reply: formatShiftsForDate(cmd.date, rows) };
    }

    case "list_range": {
      const rows = await listShifts(sql, cmd.from, cmd.to);
      return { reply: formatShiftsForRange(cmd.label, cmd.from, cmd.to, rows) };
    }

    case "mine": {
      if (!actor.staff_id || !actor.username) {
        return {
          reply: "このLINEアカウントはスタッフに紐付いていません。\n管理者に staff_line_users の staff_id 設定を依頼してください。",
        };
      }
      const to = addJstDays(today, MY_SHIFTS_DAYS - 1);
      const rows = await listShifts(sql, today, to, actor.staff_id);
      return { reply: formatMyShifts(actor.username, today, to, rows) };
    }

    case "add": {
      const t = await resolveTarget(sql, actor, cmd.staffName);
      if ("error" in t) return { reply: `⚠ ${t.error}` };
      const startTs = toJstTimestamp(cmd.date, cmd.start);
      const endTs = toJstTimestamp(cmd.date, cmd.end);
      const overlap = await findOverlap(sql, t.target.id, startTs, endTs);
      if (overlap) {
        return {
          reply: `⚠ ${t.target.username} は ${formatMdWithWeekday(cmd.date)} に既にシフトがあります: ${formatTimeRange(overlap)}\n変更する場合は「シフト変更」を使ってください。`,
        };
      }
      const breakMinutes = cmd.breakMinutes ?? 0;
      await sql`
        insert into public.shifts (staff_id, start_time, end_time, break_minutes, status)
        values (${t.target.id}, ${startTs}::timestamptz, ${endTs}::timestamptz, ${breakMinutes}, 'scheduled')
      `;
      const detail = `${t.target.username} ${formatMdWithWeekday(cmd.date)} ${formatTimeRange({ start: cmd.start, end: cmd.end, break_minutes: breakMinutes })}`;
      return {
        reply: `✅ シフトを追加しました\n${detail}`,
        notify: `➕ シフト追加\n${detail}\n${byLabel(actor)}`,
      };
    }

    case "update": {
      const t = await resolveTarget(sql, actor, cmd.staffName);
      if ("error" in t) return { reply: `⚠ ${t.error}` };
      const existing = await listShifts(sql, cmd.date, cmd.date, t.target.id);
      if (existing.length === 0) {
        return {
          reply: `⚠ ${t.target.username} の ${formatMdWithWeekday(cmd.date)} にシフトはありません。\n「シフト追加」で登録してください。`,
        };
      }
      if (existing.length > 1) {
        return {
          reply: [
            `⚠ ${formatMdWithWeekday(cmd.date)} にシフトが ${existing.length} 件あるため自動で特定できません:`,
            ...existing.map((r) => `・${formatTimeRange(r)}`),
            "管理画面で編集するか、「シフト削除」→「シフト追加」で登録し直してください。",
          ].join("\n"),
        };
      }
      const before = existing[0];
      const startTs = toJstTimestamp(cmd.date, cmd.start);
      const endTs = toJstTimestamp(cmd.date, cmd.end);
      const overlap = await findOverlap(sql, t.target.id, startTs, endTs, before.id);
      if (overlap) {
        return { reply: `⚠ 別のシフトと重なります: ${formatMdWithWeekday(overlap.date)} ${formatTimeRange(overlap)}` };
      }
      const breakMinutes = cmd.breakMinutes ?? before.break_minutes;
      await sql`
        update public.shifts
        set start_time = ${startTs}::timestamptz,
            end_time = ${endTs}::timestamptz,
            break_minutes = ${breakMinutes}
        where id = ${before.id}
      `;
      const after = { start: cmd.start, end: cmd.end, break_minutes: breakMinutes };
      const detail = `${t.target.username} ${formatMdWithWeekday(cmd.date)}\n${formatTimeRange(before)} → ${formatTimeRange(after)}`;
      return {
        reply: `✅ シフトを変更しました\n${detail}`,
        notify: `🔄 シフト変更\n${detail}\n${byLabel(actor)}`,
      };
    }

    case "delete": {
      const t = await resolveTarget(sql, actor, cmd.staffName);
      if ("error" in t) return { reply: `⚠ ${t.error}` };
      const existing = await listShifts(sql, cmd.date, cmd.date, t.target.id);
      if (existing.length === 0) {
        return { reply: `⚠ ${t.target.username} の ${formatMdWithWeekday(cmd.date)} にシフトはありません。` };
      }
      if (existing.length > 1) {
        return {
          reply: [
            `⚠ ${formatMdWithWeekday(cmd.date)} にシフトが ${existing.length} 件あるため自動で特定できません:`,
            ...existing.map((r) => `・${formatTimeRange(r)}`),
            "管理画面から削除してください。",
          ].join("\n"),
        };
      }
      const target = existing[0];
      await sql`update public.shifts set status = 'cancelled' where id = ${target.id}`;
      const detail = `${t.target.username} ${formatMdWithWeekday(cmd.date)} ${formatTimeRange(target)}`;
      return {
        reply: `🗑 シフトを削除しました\n${detail}`,
        notify: `➖ シフト削除\n${detail}\n${byLabel(actor)}`,
      };
    }
  }
};
