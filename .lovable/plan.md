## 原因

先日の Phase 2 セキュリティマイグレーションで `set_reservation_code_and_expiration()` 関数の `search_path` を `public` のみに固定しました。しかし `gen_random_bytes()` は `pgcrypto` 拡張に属し、そのスキーマは `extensions`（`public` ではない）にインストールされています。

結果、予約 INSERT 時のトリガー処理で：
```
function gen_random_bytes(integer) does not exist
```
が発生し、Edge Function が 500 を返しています。

## 修正方針

`set_reservation_code_and_expiration()` の `search_path` を `public, extensions` に変更します（同様に他の関数も `gen_random_bytes` / `gen_random_uuid` を使うものは合わせます）。

代替案として「関数内で `extensions.gen_random_bytes(...)` と完全修飾」にしてもよいですが、search_path 変更の方が変更箇所が小さいです。

### 対象関数（DB マイグレーション）

- `public.set_reservation_code_and_expiration` → `SET search_path = public, extensions`
- 念のため `public.handle_new_user`, `public.set_reservation_code`, `public.generate_reservation_code` なども同じ設定に統一（pgcrypto/uuid 系を使う可能性があるため）

### コード変更
不要（DB マイグレーションのみ）。

## 確認手順

1. マイグレーション適用
2. `/` から予約を再実行 → 200 で予約コードが返ること
3. `create-reservation` のログにエラーが出ないこと
