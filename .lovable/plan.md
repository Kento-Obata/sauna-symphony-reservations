# 予約詳細ページのアクセス保護

## 現状の問題
`/reservation/:code` は予約コードさえ知っていれば、氏名・電話・日時・人数・金額など全ての情報が閲覧できてしまう。`get-reservation-by-code` Edge Function はコードだけで全データを返している。

## 方針（ユーザー承認済み）
- **直接URLアクセス**: 電話番号下4桁の入力を必須に
- **メール/SMS内リンク**: 署名付きトークンで自動アクセス可
- **完了直後ページ** (`/reservation/pending`, `/reservation/complete`): `location.state` 経由のときのみ表示（現状維持）

## DB変更
`reservations` に以下のカラムを追加:
- `access_token text` — 推測不能なランダムトークン（gen_random_bytes(32)）
- `access_token_expires_at timestamptz` — トークン有効期限（予約日 +7日 など）

予約作成トリガー (`set_reservation_code_and_expiration`) を更新し `access_token` を自動生成。既存予約にもバックフィル。

## Edge Function 変更

### `get-reservation-by-code` を改修
入力に応じて2モード:
1. `{ reservationCode, accessToken }` — トークン一致で全情報を返す
2. `{ reservationCode, phoneLastFourDigits }` — 電話番号下4桁一致で全情報を返す
3. どちらも無い、または不正 → 401 を返し、`{ requiresAuth: true, exists: true/false }` のみ返す（情報漏洩防止のため exists も曖昧に）

レート制限的な観点で、不正試行はログ出力のみ（短期的にはOK）。

### メール/SMS の本文リンク変更
現在 `reservation/{code}` のような URL を送っている箇所を `reservation/{code}?t={accessToken}` に変更:
- `send-reservation-notification`
- `send-confirmation-notification`
- `send-pending-notification`
- `send-reservation-reminders`
- `_shared/email.ts` 経由のもの

## フロント変更

### `src/pages/ReservationDetail.tsx`
- URL クエリ `?t=xxx` があれば自動でトークン認証 → 予約取得
- 無い、または失敗時は「電話番号下4桁を入力してください」フォーム表示
- 認証成功で `ReservationInfo` / `ReservationActions` を表示
- 認証前は予約の存在有無も含めて何も表示しない

### `src/pages/ReservationPending.tsx` / `ReservationComplete.tsx`
- 現状の `location.state` ベースを維持（変更なし）
- ただし内部で呼ぶ `get-reservation-by-code` には、作成直後に発行された `accessToken` を `location.state` 経由で受け取り渡す

### 予約作成フロー
予約作成 Edge Function（`create-reservation` 等）のレスポンスに `access_token` を含めるよう修正。フロント側は予約完了時にこれを `location.state` に格納し、Pending/Complete 画面で利用、また内部リンク生成にも使用。

## 技術詳細
- トークンは `crypto.randomUUID()` ではなく `encode(gen_random_bytes(32), 'hex')` で 64 文字
- 電話番号下4桁検証は既存 `cancel-reservation` のロジックを流用
- 認証失敗時のレスポンスは予約の存在を示唆しないよう統一メッセージ
- `accessToken` は URL に載るため HTTPS 前提（Lovable は標準対応）

## 影響範囲
- DB マイグレーション 1件
- Edge Function 改修: `get-reservation-by-code` + 各通知系（リンクURL）+ 予約作成系（レスポンス）
- フロント: `ReservationDetail.tsx`, `ReservationPending.tsx`, `ReservationComplete.tsx`, 予約作成フックまたはコンポーネント

承認いただければ実装に入ります。
