# ローカル開発・テスト・デプロイ手順

本番（Netlify + Supabase）へ反映する前に、ローカルで検証するためのワークフロー。

## 前提ツール
- `supabase` CLI（インストール済み: `supabase --version`）
- Docker（`supabase start` に必要）
- `deno`（Edge Function のユニットテスト用。未インストールなら `brew install deno`）

## 1. Edge Function のユニットテスト（DB/Docker不要）

純粋ロジックは Deno のテストで即検証できる。

```bash
deno test supabase/functions/_shared/
```

- `rate-limit_test.ts` … レート制限のしきい値判定・記録ロジック（`sql` をモック）
- `time-slot-rules_test.ts` … 時間帯ラベル算出

## 2. ローカル Supabase スタックで結合テスト

```bash
supabase start                 # ローカルの Postgres + Edge Runtime を起動
supabase db reset              # migrations/ を順に適用（auth_attempts 等も作成される）
supabase functions serve       # Edge Function をローカルで配信
```

別ターミナルから関数を叩いて確認（例: レート制限）:

```bash
ANON=$(supabase status -o env | grep ANON_KEY | cut -d= -f2 | tr -d '"')
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://127.0.0.1:54321/functions/v1/get-reservation-by-code \
    -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
    -d '{"reservationCode":"ZZZZ9999"}'
done
# 20回失敗後、21回目以降が 429 になれば OK
```

## 3. 本番へデプロイ

```bash
# DB マイグレーション（関数より先に適用すること）
supabase db push

# Edge Function（_shared 配下も自動でバンドルされる）
supabase functions deploy get-reservation-by-code
supabase functions deploy cancel-reservation

# フロントエンド（git push で Netlify が自動ビルド・デプロイ）
git push origin main
```

> ⚠️ `main` への push は即本番反映。先に `supabase db push` を済ませてから push すること。

## メモ
- レート制限の記録テーブル `public.auth_attempts` は RLS 有効・ポリシー無し（Edge Function の直 Postgres 接続のみアクセス可）。
- 古い記録は `public.prune_auth_attempts()` で削除可能（cron 推奨）。
