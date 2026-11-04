// スタッフ用 LINE bot の AI 部分。1:1 のトークでは、コマンドとして認識できない文章と写真を受ける。
// グループでは、ボットに @ でメンションした文章だけを受ける(_shared/line-mention.ts)。
//  - 写真: スタッフの作業写真の保存先(work-photos/<トークン>/<id>.jpg)にしまい、次の文章のときに AI に伝える
//  - 文章: その人の権限(管理者/スタッフ)の道具を使って Claude が返事をする。会話は agent_line_conversations に保存
//  - グループの会話は全員が見るので、管理者でもスタッフの道具だけを使う。会話はグループ×人ごとに分ける
// 会話の履歴は追記だけ。しばらく間が空いた・長くなった・道具の定義が変わったときは新しい会話にする。

import Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { formatYmdWithWeekday, getJstTodayYmd } from "../date-jst.ts";
import { pushLineMessage, replyLineMessage } from "../line.ts";
import type { LineStaff } from "../shift-service.ts";
import { publicApiKey } from "../supabase-keys.ts";
import { sha256Hex } from "./auth.ts";
import { type ChatMessage, claudeToolsFor, runChatTurn } from "./claude-chat.ts";
import { createAgentContext } from "./context.ts";
import { ToolRegistry } from "./registry.ts";
import { agentTools } from "./tools/index.ts";
import { staffWorkToken } from "./tools/work.ts";
import type { AgentCaller, Sql } from "./types.ts";

const CONVERSATION_IDLE_MINUTES = 30;
const MAX_HISTORY_MESSAGES = 60;
const PHOTO_BUCKET = "work-photos";
const LINE_API = "https://api.line.me/v2/bot";
const LINE_DATA_API = "https://api-data.line.me/v2/bot";

const registry = new ToolRegistry(agentTools);

export const LINE_SYSTEM_PROMPT = [
  "あなたは U sauna(予約制の貸切サウナ)の店舗アシスタントです。LINE でスタッフやオーナーと話します。",
  "",
  "# 話し方",
  "- 返事は短く、LINE で読みやすい日本語で書いてください。見出し・表・太字などのマークダウンは使わず、箇条書きは「・」を使います。",
  "- 相手は現場で手が離せないことが多いので、確認は必要なときだけ、ひとことで聞いてください。",
  "",
  "# 日時",
  "- 相手のメッセージの先頭の（日付 時刻）が今の日時です(日本時間)。「今日」「明日」「来週」はこれを基準に決めてください。",
  "",
  "# 店の情報",
  "- 予約・空き状況・シフト・作業・ハーブなどは、必ず道具で確かめてから答えてください。推測で答えないでください。",
  "- お客様の電話番号やメールアドレスは、業務に必要なとき以外は書かないでください。",
  "",
  "# 作業の記録",
  "- 「〇〇終わった」「〇〇やった」と言われたら、my_work_today で作業場と項目の正しい名前を確かめてから record_work で記録します。",
  "- [受け取った写真 photo_id: ...] とあれば、その作業の記録の photo_ids に入れてください。どの作業か分からなければ聞き返してください。",
  "",
  "# 確認が要る操作",
  "- 返金・お客様への送信・料金の変更などは、最初の呼び出しでは実行されず確認待ちになります。",
  "- 内容を相手に伝えて「実行してよいですか？」と聞き、相手がはっきり了承したときだけ confirm_action を呼んでください。",
  "",
  "# その他",
  "- シフトの追加・変更・取り消しは、スタッフの LINE グループにも自動で通知されます。",
  "- 道具でできないことを頼まれたら、管理画面で操作するよう伝えてください。",
].join("\n");

/** グループの会話用。全員が見ているので書いてよい内容を絞る */
export const LINE_GROUP_SYSTEM_PROMPT = [
  LINE_SYSTEM_PROMPT,
  "",
  "# グループでの会話",
  "- このやりとりはスタッフの LINE グループで、メンバー全員が見ています。お客様の連絡先やほかの人の給与など、個人的な情報は書かないでください。",
  "- 管理者向けの操作(返金・料金の変更・ほかの人のシフトの変更など)を頼まれたら、ボットとの1対1のトークで頼むよう伝えてください。",
].join("\n");

export interface LineAiMessage {
  replyToken: string;
  lineUserId: string;
  /** グループ(・複数人トーク)で受けたときのグループ ID。1:1 のトークなら無し */
  groupId?: string;
  message: { id: string; type: "text" | "image"; text?: string };
}

const callerOf = (staff: LineStaff, groupId?: string): AgentCaller | null => {
  if (!staff.staff_id || (staff.role !== "admin" && staff.role !== "staff")) return null;
  return {
    userId: staff.staff_id,
    // グループでは全員が見るので、管理者でもスタッフの道具だけにする
    role: groupId ? "staff" : staff.role,
    name: staff.username ?? staff.display_name ?? "",
    channel: "line",
    client: groupId ? "line-group" : "line",
    lineGroupId: groupId ?? null,
  };
};

/** 返事。reply トークンの期限が切れていたら push で送る(グループならグループへ) */
const sendLine = async (ev: LineAiMessage, text: string, accessToken: string) => {
  const replied = await replyLineMessage(ev.replyToken, text, accessToken);
  if (!replied.ok) {
    const pushed = await pushLineMessage(ev.groupId ?? ev.lineUserId, text, accessToken);
    if (!pushed.ok) console.error("LINE push failed", pushed.status, pushed.body);
  }
};

/** 1:1 トークに「入力中」を出す(考えている間に何も起きていないように見えないように) */
const startLoading = (lineUserId: string, accessToken: string) =>
  fetch(`${LINE_API}/chat/loading/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ chatId: lineUserId, loadingSeconds: 30 }),
  }).catch((error) => console.error("LINE loading error:", error));

const storePhoto = async (sql: Sql, ev: LineAiMessage, caller: AgentCaller, accessToken: string) => {
  const content = await fetch(`${LINE_DATA_API}/message/${ev.message.id}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!content.ok) throw new Error(`LINE content ${content.status}`);
  const bytes = new Uint8Array(await content.arrayBuffer());

  // スタッフ用リンクからの写真と同じ場所・同じ権限(トークンのフォルダ)に置く
  const token = await staffWorkToken(sql, caller.userId);
  const photoId = crypto.randomUUID();
  const path = `${token}/${photoId}.jpg`;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
  // 公開キー(anon の権限)で入れる。スタッフ用リンクと同じストレージのポリシー(トークンのフォルダ)が効く
  const uploaded = await fetch(`${supabaseUrl}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: publicApiKey(),
      "Content-Type": content.headers.get("content-type") ?? "image/jpeg",
      "x-upsert": "false",
    },
    body: bytes,
  });
  if (!uploaded.ok) throw new Error(`storage upload ${uploaded.status} ${await uploaded.text()}`);

  await sql`
    insert into public.agent_line_photos (id, line_user_id, staff_id, storage_path)
    values (${photoId}::uuid, ${ev.lineUserId}, ${caller.userId}::uuid, ${path})
  `;
};

interface ConversationRow {
  user_id: string;
  messages: ChatMessage[];
  fingerprint: string | null;
  version: number;
  idle_minutes: number;
}

const stamp = () => {
  const now = new Date();
  const hhmm = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return `（${formatYmdWithWeekday(getJstTodayYmd(now))} ${hhmm}）`;
};

export async function handleLineAiMessage(sql: Sql, ev: LineAiMessage, staff: LineStaff, accessToken: string): Promise<void> {
  const caller = callerOf(staff, ev.groupId);
  if (!caller) {
    await sendLine(ev, "このLINEはスタッフに紐付いていません\n管理者に登録を頼んでください", accessToken);
    return;
  }

  if (ev.message.type === "image") {
    try {
      await storePhoto(sql, ev, caller, accessToken);
      await sendLine(ev, "📷 写真を受け取りました\n何の作業の写真か教えてください（例: 脱衣棟のシャワー室1 終わった）", accessToken);
    } catch (error) {
      console.error("LINE photo error:", error);
      await sendLine(ev, "写真を保存できませんでした\u3000もう一度送ってください", accessToken);
    }
    return;
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    await sendLine(ev, "AI はまだ準備中です\n今は「ヘルプ」で出るコマンドが使えます", accessToken);
    return;
  }
  // 「入力中」の表示は 1:1 のトークだけ
  if (!ev.groupId) startLoading(ev.lineUserId, accessToken);

  const ctx = createAgentContext(sql, caller);
  const system = ev.groupId ? LINE_GROUP_SYSTEM_PROMPT : LINE_SYSTEM_PROMPT;
  // 会話は 1:1 なら人ごと、グループならグループ×人ごと
  const conversationKey = ev.groupId ? `group:${ev.groupId}:${ev.lineUserId}` : ev.lineUserId;
  const fingerprint = await sha256Hex(JSON.stringify({ system, tools: claudeToolsFor(registry, ctx) }));
  const rows: ConversationRow[] = await sql`
    select user_id::text, messages, fingerprint, version,
           (extract(epoch from now() - updated_at) / 60)::float8 as idle_minutes
    from public.agent_line_conversations
    where line_user_id = ${conversationKey}
  `;
  const conv = rows[0];
  const fresh = !conv || conv.user_id !== caller.userId || conv.fingerprint !== fingerprint ||
    conv.idle_minutes > CONVERSATION_IDLE_MINUTES || conv.messages.length > MAX_HISTORY_MESSAGES;
  const history: ChatMessage[] = fresh ? [] : conv.messages;

  // まだ伝えていない写真(30分以内・1:1 で受けたもの)を、このメッセージに添える
  const photos = ev.groupId ? [] : await sql`
    update public.agent_line_photos set announced_at = now()
    where line_user_id = ${ev.lineUserId} and announced_at is null and created_at > now() - interval '30 minutes'
    returning id::text
  `;
  const photoNote = photos.length ? `\n[受け取った写真 photo_id: ${photos.map((p: { id: string }) => p.id).join(", ")}]` : "";
  const userMessage: ChatMessage = { role: "user", content: `${stamp()}${ev.message.text ?? ""}${photoNote}` };

  let reply: string;
  let turn: ChatMessage[];
  try {
    const client = new Anthropic({ apiKey, timeout: 50_000, maxRetries: 1 });
    const result = await runChatTurn({ client, registry, ctx, system, history: [...history, userMessage] });
    reply = result.reply;
    turn = [userMessage, ...result.appended];
  } catch (error) {
    console.error("LINE AI error:", error);
    await sendLine(ev, "AI が応答できませんでした\u3000少し待ってからもう一度送ってください", accessToken);
    return;
  }

  // 同時に別のメッセージを処理していて履歴が先に進んでいたら、この回だけで新しい会話にする
  const saved = fresh
    ? await sql`
      insert into public.agent_line_conversations (line_user_id, user_id, messages, fingerprint, version, started_at, updated_at)
      values (${conversationKey}, ${caller.userId}::uuid, ${sql.json(turn)}::jsonb, ${fingerprint}, 1, now(), now())
      on conflict (line_user_id) do update
        set user_id = excluded.user_id, messages = excluded.messages, fingerprint = excluded.fingerprint,
            version = agent_line_conversations.version + 1, started_at = now(), updated_at = now()
      returning 1
    `
    : await sql`
      update public.agent_line_conversations
      set messages = ${sql.json([...history, ...turn])}::jsonb, version = version + 1, updated_at = now()
      where line_user_id = ${conversationKey} and version = ${conv.version}
      returning 1
    `;
  if (!saved.length) {
    await sql`
      update public.agent_line_conversations
      set messages = ${sql.json(turn)}::jsonb, fingerprint = ${fingerprint}, version = version + 1, started_at = now(), updated_at = now()
      where line_user_id = ${conversationKey}
    `;
  }

  await sendLine(ev, reply, accessToken);
}
