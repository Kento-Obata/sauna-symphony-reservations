-- 本番のベーススキーマ(マイグレーション管理外・Lovable 時代)に存在した
-- reservations_status_check が 'pending','confirmed','cancelled' しか許可しておらず:
--   - 事前決済(status='pending_payment')の INSERT が本番のみ失敗
--   - 既存の期限切れ遷移(send-expiration-notification の status='expired' 化)も
--     実は本番では常に制約違反で失敗していた(潜在バグ)
-- 許可値を追加して張り替える。ステージングには元々この制約が無かったため
-- (E2E をすり抜けた原因)、同一定義で新設し両環境を揃える。
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired', 'pending_payment'));
