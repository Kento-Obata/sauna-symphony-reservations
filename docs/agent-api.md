# AI エージェント用の窓口（MCP / LINE）

オーナーやスタッフが AI に話しかけて、予約・空き状況・休業・シフト・給与・作業管理・ハーブ・顧客・料金を操作するための仕組み。

| 入口 | 使う人 | ログイン | 実体 |
| --- | --- | --- | --- |
| Claude アプリ（カスタムコネクタ） | オーナー（管理者） | Supabase Auth の OAuth 2.1（管理者アカウント） | `supabase/functions/agent-mcp` |
| Claude Code・自動実行 | 管理者が発行したキーの持ち主 | API キー `usk_...`（管理画面 → 設定 → AI連携） | 同上 |
| スタッフ用 LINE bot（1:1 のトーク） | スタッフ・オーナー | `staff_line_users` の紐付け | `supabase/functions/line-staff-webhook` → `_shared/agent/line-agent.ts` |

## 構成

- `_shared/agent/tools/*.ts` … 道具（tool）の定義。分野ごとのファイル。`tools/index.ts` に集める
- `_shared/agent/registry.ts` … 権限の確認・入力の検証・実行前の確認・操作ログ
- `_shared/agent/mcp.ts` … MCP の JSON-RPC（initialize / ping / tools/list / tools/call）。セッションを持たない Streamable HTTP
- `_shared/agent/auth.ts` … OAuth のアクセストークン / API キーから呼び出した人を特定（`profiles.role` が admin / staff の人だけ）
- `_shared/agent/oauth-proxy.ts` … OAuth の入口の中継（下記）
- `_shared/supabase-keys.ts` … Edge Function から Supabase の Auth・Storage を呼ぶときの公開キー
- `_shared/agent/claude-chat.ts` … LINE 用の Claude（Messages API + tool use）のループ
- DB: `agent_api_keys` / `agent_pending_actions` / `agent_action_logs` / `agent_line_conversations` / `agent_line_photos`（migration `20261104000000_agent_api.sql`）

## 安全のための決まり

- **権限**: 道具ごとに `roles` を持つ。スタッフには管理者向けの道具が見えない（tools/list に出ない）
- **RLS**: 道具の多くは `ctx.asUser()` で、呼び出した人の権限（`role=authenticated` と `request.jwt.claims`）で SQL を実行する。管理画面と同じ RLS が効く
- **実行前の確認**: `kind: "dangerous"` の道具（キャンセル・返金・お客様への通知が出る変更・料金の変更）は、最初の呼び出しでは実行せず内容と `confirmation_id` を返す。ユーザーの了承後に `confirm_action` で、控えた入力そのものを一度だけ実行する（10分で失効）
- **操作ログ**: すべての呼び出しを `agent_action_logs` に残す（管理画面 → 設定 → AI連携 で直近50件を見られる）
- **ブラウザ側だけの決まり**: 管理画面ではブラウザでしか確かめていない決まり（休業日・その日に開いている枠・同じ枠の予約・料金）を、道具ではサーバー側で確かめる。枠の判定は `_shared/slot-rules.ts`（フロントの `src/utils/timeSlotRules.ts` と同じルール。変えるときは両方）

## OAuth の中継

本番の API ゲートウェイは、Supabase Auth の OAuth の入口（メタデータ・authorize・token・クライアント登録）でも apikey の無いリクエストを拒む。
MCP クライアントは apikey を知らないので、agent-mcp を認可サーバーとして見せ、各入口を公開キー付きで Supabase Auth へ中継する。

| クライアントが使う URL | 中継先 |
| --- | --- |
| `agent-mcp/.well-known/oauth-protected-resource` | （agent-mcp が返す。authorization_servers は agent-mcp 自身） |
| `agent-mcp/.well-known/openid-configuration`・`.../oauth-authorization-server` | Supabase の認可サーバーのメタデータ（入口を agent-mcp に差し替え、openid は外す） |
| `agent-mcp/oauth/authorize` | `auth/v1/oauth/authorize?...&apikey=`（302） |
| `agent-mcp/oauth/token` / `oauth/register` | `auth/v1/oauth/token` / `oauth/clients/register` |

また本番では、自動注入の `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEYS` もゲートウェイに拒否される。Edge Function から Auth・Storage を呼ぶときは `publicApiKey()`（サイトと同じ公開キー）を使う。

## 設定（本番）

1. Supabase ダッシュボード → Authentication → **OAuth Server** を有効にする
   - Authorization Path: `/oauth/consent`（Site URL と合わせて同意画面になる）
   - Dynamic Client Registration: 有効（Claude アプリが自分でクライアント登録するため）
2. LINE の AI を使うなら、Anthropic の API キーを secrets に入れる（キーは本人が入力する）
   - `supabase secrets set ANTHROPIC_API_KEY=... --project-ref knjbxqiyngztylnzxzln`
   - 未設定のあいだ、LINE の 1:1 でコマンド以外を送ると「AI はまだ準備中です」と返す
3. Claude アプリ → 設定 → コネクタ → カスタムコネクタを追加 → URL に
   `https://knjbxqiyngztylnzxzln.supabase.co/functions/v1/agent-mcp` → 管理者アカウントでログイン → 許可
   （同意画面は Site URL + `/oauth/consent`。Site URL は `https://www.u-sauna-private.com`）

## LINE の AI

- 1:1 のトークで、コマンド（「ヘルプ」「シフト追加 …」「今日」など）として認識できない文章と写真を AI が受ける
- グループでは、ボットに @ でメンションした文章だけ AI が受ける（メンション部分を外した本文がコマンドならコマンドとして動く）。それ以外は従来どおりコマンドだけに反応する。グループの会話は全員が見るので、管理者でもスタッフの道具だけを使い、会話はグループ×人ごとに分ける
- 写真は `work-photos/<スタッフのトークン>/<id>.jpg` に保存し、次の文章のときに `[受け取った写真 photo_id: …]` として AI に伝える（作業の記録に添える）
- 会話は `agent_line_conversations` に追記で保存。30分あく・60件を超える・道具の定義が変わると新しい会話にする（Claude の thinking ブロックは過去の内容と結びついているため、履歴を削ったり書き換えたりしない）
- モデルは `claude-opus-5-5`（effort `low`）。安全上の理由で断られたときは `fallbacks: "default"` でサーバー側が別モデルに切り替える
- webhook にはすぐ 200 を返し、AI の処理は `EdgeRuntime.waitUntil` で続ける（返事は reply、期限切れなら push）

## 道具を足すとき

1. `_shared/agent/tools/<分野>.ts` に `AgentTool` を書く（`name` は英小文字、`title` / `description` は日本語。AI が読むので、いつ使うか・何が起きるかを具体的に）
2. お客様に通知が届く・お金が動く・取り消せない操作は `kind: "dangerous"` にして `preview` を書く
3. `tools/index.ts` に足す
4. ステージングで確かめる: `supabase functions deploy agent-mcp --project-ref ycpcwtxpqehjbjiydbbc` のあと、API キーで `tools/call` を叩く
   - 予約の作成・変更を試すときは、お客様に SMS が飛ばないよう `notify_customer: false` と送れない番号（`00000000000`）を使う

LINE の会話では、道具の定義が変わると進行中の会話は次のメッセージから新しく始まる。
