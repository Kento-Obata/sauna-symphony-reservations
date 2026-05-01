# セキュリティ棚卸しと修正計画

Supabase linter + コード監査で出た懸念を、**重大度順**にまとめました。重要なものから順に潰していく想定です。

---

## 🔴 重大（早めに修正推奨）

### 1. `cancel-reservation` の電話番号比較が timing-attack に弱い
`get-reservation-by-code` は `safeEqual` で定数時間比較していますが、`cancel-reservation` は普通の `!==` 比較です。攻撃難易度は高いものの、統一しておくべき。

→ `safeEqual` を導入。

### 2. `confirm-reservation` のトークン使い回し
`confirmation_token` で予約を取得した後、`is_confirmed=true` にしつつ `confirmation_token=null` にしているのは良いですが、**同じトークンが複数回叩かれても 200 を返す可能性**（既に確認済みでも処理が走らない）など、リプレイ防止のログを残しておく価値あり。

→ 既に `is_confirmed=true` の場合は早期 return。

### 3. RLS未設定テーブルが1件存在（linter ERROR）
linter で `RLS Disabled in Public` が1件報告されています。`shift_preferences` テーブルが RLS 有効だがポリシー未定義の可能性が高い（schemaで policies が空）。

→ どのテーブルか特定して RLS有効化 + ポリシー追加（admin/staff 用）。

### 4. `staff_auth` テーブルに `password_hash` が直接保存されている
独自のスタッフログイン用と思われますが、Supabase Auth ではなく自前ハッシュ管理は脆弱性混入リスクが高いです（ハッシュ方式不明、ソルト管理、ブルートフォース対策など）。

→ 中期的に Supabase Auth に統合することを推奨（今回はメモのみ、即修正はしない）。

---

## 🟡 中程度

### 5. DB関数の `search_path` 未設定（linter WARN × 8件）
`generate_reservation_code`, `set_reservation_code` など複数の関数で `SET search_path` 未設定。SQL injection 経路ではないものの、ベストプラクティス。

→ 各関数に `SET search_path = public` を追加するマイグレーション。

### 6. `SECURITY DEFINER` View が3件（linter ERROR）
schema には View が見えないので Supabase 内部ビューの可能性もありますが、自作なら作成者権限で動くため危険。

→ 該当 View を特定し、`SECURITY INVOKER` に変更 or 削除。

### 7. `cancel-reservation` に Zod 等の入力バリデーションなし
`reservationCode`, `phoneLastFourDigits` の型・形式チェックが薄い。

→ 形式バリデーション追加（英数8文字 / 数字4桁）。

### 8. `create-reservation` に rate-limit / 入力上限なし
`guestName` / `phone` / `email` の長さ・形式チェックなし。悪意ある長文や不正フォーマットが通る可能性。

→ Zod で形式・長さチェック追加。電話番号は数字のみ＆10〜11桁、メールは email 形式、名前は 1〜100 文字。

---

## 🟢 推奨（任意）

### 9. Leaked Password Protection が無効（linter WARN）
Supabase Auth の流出パスワード検出機能が OFF。スタッフログインに Supabase Auth 使うなら有効化推奨。

→ Supabase ダッシュボードで ON。

### 10. Postgres バージョンに security patch あり（linter WARN）
Supabase ダッシュボードからアップグレード推奨。

### 11. `RLS Policy Always True` が1件（linter WARN）
SELECT 以外で `USING (true)` / `WITH CHECK (true)` を使っているポリシー。`reservation_options` の INSERT が `true` になっている可能性大。

→ Edge Function 経由で挿入する設計なので、anon からの直接 INSERT は禁止に変更（`false` または authenticated 限定）。

### 12. `extension in public` schema（linter WARN）
拡張機能が public schema にある。本番影響は低いが整理推奨。

---

## 実装順序

```text
Phase 1（即対応・低リスク）
  ├─ #1  cancel-reservation safeEqual 導入
  ├─ #2  confirm-reservation の二重実行防止
  ├─ #7  cancel-reservation Zod バリデーション
  └─ #8  create-reservation Zod バリデーション

Phase 2（DBマイグレーション）
  ├─ #3  RLS未設定テーブル修正
  ├─ #5  DB関数 search_path 固定
  ├─ #6  SECURITY DEFINER View 修正
  └─ #11 reservation_options INSERT ポリシー厳格化

Phase 3（手動 / ダッシュボード作業）
  ├─ #9  Leaked Password Protection 有効化
  └─ #10 Postgres アップグレード

Phase 4（中長期）
  └─ #4  staff_auth → Supabase Auth 移行
```

---

## どこまでやりますか？

選択肢:
- **A**: Phase 1 + 2 全部やる（コード＋マイグレーションで影響範囲やや広い）
- **B**: Phase 1 だけ（Edge Function のみ、安全に小さく）
- **C**: 重大（🔴）だけ
- **D**: 上記から個別ピックアップ（番号で指定）

どれにします？
