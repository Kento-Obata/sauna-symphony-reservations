// 作業管理。管理者: 現場の状況・作業ログ・ログの否認・タスク・ボーナス。
// スタッフ: 今日の作業・作業の記録(写真つき)・取り消し・タスク登録。スタッフの操作はスタッフ用リンクと同じ
// DB 関数(staff_work_*)を通すので、1人1項目1日1回・写真必須などの決まりもそのまま効く。

import { formatMdWithWeekday } from "../../date-jst.ts";
import { type AgentContext, type AgentTool, type Sql, ToolError } from "../types.ts";
import { assertDateRange, dateSchema } from "./common.ts";

const WORK_ERRORS: Record<string, string> = {
  already_recorded: "この項目は今日もう記録済みです（同じ項目は1人1日1回）",
  photo_required: "この項目は写真が必要です\u3000写真を送ってから記録してください",
  invalid_photo_path: "写真の指定が正しくありません",
  item_not_found: "作業項目が見つかりません",
  task_not_found: "タスクが見つかりません（完了済みかもしれません）",
  title_required: "作業名を入れてください",
  log_not_found: "記録が見つかりません（取り消せるのは自分の今日の記録だけです）",
  invalid_log: "記録の内容が正しくありません",
  invalid_token: "スタッフ用リンクが無効です\u3000管理者に再発行を頼んでください",
  forbidden: "権限がありません",
};

const rethrowWorkError = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);
  const key = Object.keys(WORK_ERRORS).find((k) => message.includes(k));
  if (key) throw new ToolError(WORK_ERRORS[key]);
  throw error;
};

/** スタッフの作業用トークン。まだ発行していなければ発行する(スタッフ用リンクと同じもの) */
export const staffWorkToken = async (sql: Sql, staffId: string): Promise<string> => {
  const rows = await sql`
    insert into public.staff_access_tokens (staff_id) values (${staffId}::uuid)
    on conflict (staff_id) do update set staff_id = excluded.staff_id
    returning token::text
  `;
  return rows[0].token;
};

interface StaffWorkArea {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    category: string;
    photo_required: boolean;
    quantity_label: string | null;
    repeatable: boolean;
    my_today_count: number;
    last_worked_at: string | null;
    last_staff_name: string | null;
  }[];
  tasks: { id: string; title: string; item_id: string | null; due_date: string | null; assignee_name: string | null }[];
}

interface StaffWork {
  staff: { id: string; name: string };
  areas: StaffWorkArea[];
  my_logs_today: { id: string; area_name: string; title: string; worked_at: string; points: number; photo_count: number }[];
  score: { month_points: number | null; today_points: number; target_points: number | null; bonus_yen: number | null; streak_days: number | null };
}

const loadStaffWork = async (ctx: AgentContext): Promise<{ token: string; work: StaffWork }> => {
  const token = await staffWorkToken(ctx.sql, ctx.caller.userId);
  const rows = await ctx.sql`select public.staff_work_get(${token}::uuid) as work`;
  return { token, work: rows[0].work };
};

/** 名前で選ぶ(完全一致 → 部分一致が1件だけ)。複数・該当なしは候補を添えて止める */
const pick = <T extends { name: string }>(list: T[], name: string, what: string): T => {
  const key = name.trim();
  const exact = list.find((x) => x.name === key);
  if (exact) return exact;
  const partial = list.filter((x) => x.name.includes(key) || key.includes(x.name));
  if (partial.length === 1) return partial[0];
  const names = (partial.length ? partial : list).map((x) => x.name).join("・");
  throw new ToolError(`${what}「${key}」を決められません（${names}）`);
};

// --- スタッフ ---

const myWorkToday: AgentTool = {
  name: "my_work_today",
  title: "今日の作業",
  description:
    "作業場ごとの作業項目(今日自分が記録したか・最後に誰がいつやったか)、未完了のタスク、今日の自分の記録、今月のポイントとボーナスの見込みを返します。" +
    "作業を記録する前に、作業場・項目の正確な名前をここで確かめてください。",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  roles: ["staff"],
  kind: "read",
  async run(ctx) {
    const { work } = await loadStaffWork(ctx);
    const areaLines = work.areas.map((a) => {
      const items = a.items.map((i) => `${i.name}${i.my_today_count > 0 ? "✓" : ""}${i.photo_required ? "📷" : ""}`).join("、");
      const tasks = a.tasks.map((t) => `タスク「${t.title}」${t.due_date ? `(${formatMdWithWeekday(t.due_date)}まで)` : ""}`).join("、");
      return `【${a.name}】${items}${tasks ? ` / ${tasks}` : ""}`;
    });
    const s = work.score;
    return {
      text: [
        `${work.staff.name}さんの今日の記録 ${work.my_logs_today.length}件（今日 ${s.today_points}pt）`,
        // 今月まだ記録もシフトも無い人は集計の行が無く、ポイント・ボーナスが null で返る
        `今月 ${s.month_points ?? 0}pt（目安 ${s.target_points ?? 0}pt）ボーナス見込み ¥${(s.bonus_yen ?? 0).toLocaleString()}${(s.streak_days ?? 0) > 1 ? ` / ${s.streak_days}日連続` : ""}`,
        "✓=今日記録済み 📷=写真が必要",
        ...areaLines,
      ].join("\n"),
      data: {
        areas: work.areas.map((a) => ({
          name: a.name,
          items: a.items.map((i) => ({ name: i.name, category: i.category, done_today: i.my_today_count > 0, photo_required: i.photo_required, quantity_label: i.quantity_label, last_worked_at: i.last_worked_at, last_staff_name: i.last_staff_name })),
          tasks: a.tasks.map((t) => ({ task_id: t.id, title: t.title, due_date: t.due_date, assignee: t.assignee_name })),
        })),
        my_logs_today: work.my_logs_today.map((l) => ({ log_id: l.id, area: l.area_name, title: l.title, points: l.points, photos: l.photo_count })),
        score: s,
      },
    };
  },
};

const recordWork: AgentTool<{ area: string; item?: string; task_id?: string; title?: string; quantity?: number; note?: string; photo_ids?: string[] }> = {
  name: "record_work",
  title: "作業を記録する",
  description:
    "終わった作業を記録します。作業場(area)と、項目(item)・タスク(task_id)・自由な作業名(title)のどれか1つを指定します。" +
    "写真が送られていれば、その photo_id を photo_ids に入れてください(📷の項目は写真が必要)。同じ項目は1人1日1回まで。",
  inputSchema: {
    type: "object",
    properties: {
      area: { type: "string", description: "作業場の名前(例: 脱衣棟)" },
      item: { type: "string", description: "作業項目の名前" },
      task_id: { type: "string", format: "uuid", description: "タスクを完了するときのタスクID(my_work_today の task_id)" },
      title: { type: "string", maxLength: 100, description: "項目に無い作業をしたときの作業名" },
      quantity: { type: "number", minimum: 0, maximum: 10000, description: "数量のある項目(洗濯の枚数など)の数" },
      note: { type: "string", maxLength: 500, description: "ひとこと(任意)" },
      photo_ids: { type: "array", maxItems: 6, items: { type: "string", format: "uuid" }, description: "受け取った写真の photo_id" },
    },
    required: ["area"],
    additionalProperties: false,
  },
  roles: ["staff"],
  kind: "write",
  async run(ctx, input) {
    const targets = [input.item, input.task_id, input.title].filter((v) => v !== undefined && v !== "");
    if (targets.length !== 1) throw new ToolError("項目(item)・タスク(task_id)・作業名(title)のどれか1つを指定してください");
    const { token, work } = await loadStaffWork(ctx);
    const area = pick(work.areas, input.area, "作業場");
    const item = input.item ? pick(area.items, input.item, "作業項目") : null;
    const task = input.task_id ? area.tasks.find((t) => t.id === input.task_id) : null;
    if (input.task_id && !task) throw new ToolError(WORK_ERRORS.task_not_found);
    const photoPaths = (input.photo_ids ?? []).map((id) => `${token}/${id}.jpg`);
    try {
      const rows = await ctx.sql`
        select public.staff_work_log_create(
          ${token}::uuid, ${area.id}::uuid, ${item?.id ?? null}::uuid, ${task?.id ?? null}::uuid,
          ${input.title?.trim() || null}, ${input.quantity ?? null}::numeric, ${input.note?.trim() || null}, ${photoPaths}::text[]
        ) as result
      `;
      const result = rows[0].result as { log_id: string; points: number };
      const label = item?.name ?? task?.title ?? input.title?.trim();
      return {
        text: `記録しました: ${area.name}「${label}」 +${result.points}pt${photoPaths.length ? `（写真${photoPaths.length}枚）` : ""}`,
        data: { log_id: result.log_id, points: result.points },
      };
    } catch (error) {
      return rethrowWorkError(error);
    }
  },
};

const undoWorkRecord: AgentTool<{ log_id: string }> = {
  name: "undo_work_record",
  title: "作業の記録を取り消す",
  description: "自分の今日の作業記録を取り消します(間違えて記録したとき)。log_id は my_work_today の my_logs_today にあります。",
  inputSchema: {
    type: "object",
    properties: { log_id: { type: "string", format: "uuid" } },
    required: ["log_id"],
    additionalProperties: false,
  },
  roles: ["staff"],
  kind: "write",
  async run(ctx, { log_id }) {
    const token = await staffWorkToken(ctx.sql, ctx.caller.userId);
    try {
      await ctx.sql`select public.staff_work_log_delete(${token}::uuid, ${log_id}::uuid)`;
    } catch (error) {
      rethrowWorkError(error);
    }
    return { text: "記録を取り消しました" };
  },
};

// --- 管理者 / 共通 ---

interface Named {
  id: string;
  name: string;
}

const createWorkTask: AgentTool<{ area: string; title: string; description?: string; category: string; item?: string; due_date?: string; assignee?: string; points?: number }> = {
  name: "create_work_task",
  title: "作業タスクを登録",
  description:
    "作業場に個別のタスク(不具合の対応・依頼など)を登録します。完了はスタッフが作業の記録で付けます。" +
    "期限・担当・ポイントを決められるのは管理者だけです。",
  inputSchema: {
    type: "object",
    properties: {
      area: { type: "string", description: "作業場の名前" },
      title: { type: "string", minLength: 1, maxLength: 100 },
      description: { type: "string", maxLength: 500 },
      category: { type: "string", enum: ["cleaning", "maintenance", "operation"], default: "maintenance", description: "cleaning=清掃 / maintenance=メンテナンス / operation=営業" },
      item: { type: "string", description: "関係する作業項目(任意)" },
      due_date: dateSchema("期限(管理者のみ・任意)"),
      assignee: { type: "string", description: "担当スタッフの名前(管理者のみ・任意)" },
      points: { type: "integer", minimum: 0, maximum: 50, description: "完了時のポイント(管理者のみ・既定1)" },
    },
    required: ["area", "title"],
    additionalProperties: false,
  },
  roles: ["admin", "staff"],
  kind: "write",
  async run(ctx, input) {
    if (ctx.caller.role !== "admin") {
      if (input.due_date || input.assignee || input.points !== undefined) throw new ToolError("期限・担当・ポイントは管理者だけが決められます");
      const { token, work } = await loadStaffWork(ctx);
      const area = pick(work.areas, input.area, "作業場");
      const item = input.item ? pick(area.items, input.item, "作業項目") : null;
      try {
        await ctx.sql`
          select public.staff_work_task_create(${token}::uuid, ${area.id}::uuid, ${item?.id ?? null}::uuid,
            ${input.title.trim()}, ${input.description?.trim() || null}, ${input.category})
        `;
      } catch (error) {
        rethrowWorkError(error);
      }
      return { text: `${area.name} にタスク「${input.title.trim()}」を登録しました` };
    }

    const text = await ctx.asUser(async (tx) => {
      const areas: Named[] = await tx`select id::text, name from public.work_areas where active order by sort_order`;
      const area = pick(areas, input.area, "作業場");
      const items: Named[] = input.item ? await tx`select id::text, name from public.work_items where area_id = ${area.id}::uuid and active` : [];
      const item = input.item ? pick(items, input.item, "作業項目") : null;
      let assigneeId: string | null = null;
      if (input.assignee) {
        const staff: Named[] = await tx`select id::text, username as name from public.profiles where role in ('admin', 'staff') and username is not null`;
        assigneeId = pick(staff, input.assignee, "スタッフ").id;
      }
      await tx`
        insert into public.work_tasks (area_id, item_id, title, description, category, due_date, points, assignee_id, created_by)
        values (${area.id}::uuid, ${item?.id ?? null}::uuid, ${input.title.trim()}, ${input.description?.trim() || null},
                ${input.category}, ${input.due_date ?? null}::date, ${input.points ?? 1}, ${assigneeId}::uuid, ${ctx.caller.userId}::uuid)
      `;
      return `${area.name} にタスク「${input.title.trim()}」を登録しました${input.due_date ? `（${formatMdWithWeekday(input.due_date)}まで）` : ""}${input.assignee ? ` 担当: ${input.assignee}` : ""}`;
    });
    return { text };
  },
};

const getWorkStatus: AgentTool = {
  name: "get_work_status",
  title: "現場の作業状況",
  description:
    "作業場ごとに、各項目を最後に誰がいつやったか、目安の頻度を過ぎた項目、未完了のタスク、今日の記録数を返します。",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  roles: ["admin"],
  kind: "read",
  async run(ctx) {
    const { items, tasks, today } = await ctx.asUser(async (tx) => ({
      items: await tx`
        select a.name as area, i.name as item, i.category, i.frequency_days, l.worked_at, l.staff_name,
               case when l.worked_at is null then null
                    else (now() at time zone 'Asia/Tokyo')::date - (l.worked_at at time zone 'Asia/Tokyo')::date end as days_since
        from public.work_areas a
        join public.work_items i on i.area_id = a.id and i.active
        left join public.work_item_last_logs l on l.item_id = i.id
        where a.active
        order by a.sort_order, i.sort_order
      `,
      tasks: await tx`
        select t.id::text, a.name as area, t.title, t.category, t.due_date::text, p.username as assignee
        from public.work_tasks t join public.work_areas a on a.id = t.area_id left join public.profiles p on p.id = t.assignee_id
        where t.status = 'open'
        order by t.due_date nulls last, t.created_at
      `,
      today: await tx`
        select count(*)::int as logs, count(distinct staff_id)::int as staff
        from public.work_logs where work_date = (now() at time zone 'Asia/Tokyo')::date and not rejected
      `,
    }));
    const overdue = items.filter((i: { frequency_days: number | null; days_since: number | null }) =>
      i.frequency_days !== null && (i.days_since === null || i.days_since >= i.frequency_days)
    );
    return {
      text: [
        `今日の記録 ${today[0].logs}件（${today[0].staff}人）`,
        overdue.length
          ? `目安を過ぎた項目 ${overdue.length}件:\n${overdue.map((i: { area: string; item: string; days_since: number | null; staff_name: string | null; frequency_days: number }) =>
            `・${i.area}/${i.item}（${i.days_since === null ? "記録なし" : `最後は${i.days_since}日前 ${i.staff_name}`}・目安${i.frequency_days}日ごと）`
          ).join("\n")}`
          : "目安を過ぎた項目はありません",
        tasks.length
          ? `未完了のタスク ${tasks.length}件:\n${tasks.map((t: { area: string; title: string; due_date: string | null; assignee: string | null }) =>
            `・${t.area}「${t.title}」${t.due_date ? ` ${formatMdWithWeekday(t.due_date)}まで` : ""}${t.assignee ? ` 担当${t.assignee}` : ""}`
          ).join("\n")}`
          : "未完了のタスクはありません",
      ].join("\n"),
      data: { items, tasks },
    };
  },
};

const listWorkLogs: AgentTool<{ date_from: string; date_to?: string; staff?: string; area?: string }> = {
  name: "list_work_logs",
  title: "作業ログ",
  description: "期間内の作業ログ(誰が・いつ・どこで・何を・ポイント・写真の枚数・否認済みか)を返します。log_id はログの否認に使います。",
  inputSchema: {
    type: "object",
    properties: {
      date_from: dateSchema("開始日"),
      date_to: dateSchema("終了日(省略すると開始日だけ)"),
      staff: { type: "string", description: "スタッフ名で絞る" },
      area: { type: "string", description: "作業場で絞る" },
    },
    required: ["date_from"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "read",
  async run(ctx, { date_from, date_to, staff, area }) {
    const to = date_to ?? date_from;
    assertDateRange(date_from, to);
    const rows = await ctx.asUser((tx) => tx`
      select l.id::text as log_id, l.work_date::text, to_char(l.worked_at at time zone 'Asia/Tokyo', 'HH24:MI') as time,
             p.username as staff, a.name as area, l.title, l.category, l.quantity, l.quantity_unit, l.note, l.points, l.rejected,
             (select count(*)::int from public.work_log_photos ph where ph.log_id = l.id) as photos
      from public.work_logs l join public.profiles p on p.id = l.staff_id join public.work_areas a on a.id = l.area_id
      where l.work_date between ${date_from}::date and ${to}::date
        ${staff?.trim() ? tx`and p.username like ${`%${staff.trim()}%`}` : tx``}
        ${area?.trim() ? tx`and a.name like ${`%${area.trim()}%`}` : tx``}
      order by l.worked_at desc
      limit 300
    `) as { log_id: string; work_date: string; time: string; staff: string; area: string; title: string; quantity: number | null; quantity_unit: string | null; points: number; rejected: boolean; photos: number }[];
    return {
      text: rows.length
        ? rows.map((r) =>
          `${formatMdWithWeekday(r.work_date)} ${r.time} ${r.staff} ${r.area}「${r.title}」${r.quantity !== null ? ` ${r.quantity}${r.quantity_unit ?? ""}` : ""} ${r.rejected ? "否認(0pt)" : `${r.points}pt`}${r.photos ? ` 写真${r.photos}` : ""}`
        ).join("\n")
        : "期間内の作業ログはありません",
      data: rows,
    };
  },
};

const setWorkLogRejected: AgentTool<{ log_id: string; rejected: boolean }> = {
  name: "set_work_log_rejected",
  title: "作業ログを否認・戻す",
  description: "作業ログを否認(ポイント0)にする、または否認を取り消します。スタッフへの通知はありません。",
  inputSchema: {
    type: "object",
    properties: { log_id: { type: "string", format: "uuid" }, rejected: { type: "boolean", description: "true=否認 / false=否認を取り消す" } },
    required: ["log_id", "rejected"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "write",
  async run(ctx, { log_id, rejected }) {
    const rows = await ctx.asUser((tx) => tx`
      update public.work_logs set rejected = ${rejected} where id = ${log_id}::uuid
      returning title, (select username from public.profiles where id = staff_id) as staff
    `) as { title: string; staff: string }[];
    if (!rows[0]) throw new ToolError("作業ログが見つかりません");
    return { text: `${rows[0].staff}「${rows[0].title}」を${rejected ? "否認しました(0pt)" : "否認から戻しました"}` };
  },
};

const cancelWorkTask: AgentTool<{ task_id: string }> = {
  name: "cancel_work_task",
  title: "作業タスクを取り下げる",
  description: "未完了のタスクを取り下げます(不要になったとき)。",
  inputSchema: {
    type: "object",
    properties: { task_id: { type: "string", format: "uuid" } },
    required: ["task_id"],
    additionalProperties: false,
  },
  roles: ["admin"],
  kind: "write",
  async run(ctx, { task_id }) {
    const rows = await ctx.asUser((tx) => tx`
      update public.work_tasks set status = 'cancelled' where id = ${task_id}::uuid and status = 'open' returning title
    `) as { title: string }[];
    if (!rows[0]) throw new ToolError("未完了のタスクが見つかりません");
    return { text: `タスク「${rows[0].title}」を取り下げました` };
  },
};

export const workTools: AgentTool[] = [
  myWorkToday,
  recordWork,
  undoWorkRecord,
  createWorkTask,
  getWorkStatus,
  listWorkLogs,
  setWorkLogRejected,
  cancelWorkTask,
];

