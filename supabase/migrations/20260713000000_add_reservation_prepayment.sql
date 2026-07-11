-- 貸切予約の Square 事前決済(お客様が予約フォームで選択):
--   - payment_method: 'onsite'(既定・従来の仮予約→メール確認フロー不変) / 'square_online'
--   - 事前決済は status='pending_payment'(20分ホールド)→ Square 支払い完了(Webhook)で確定
--   - reservations.status は TEXT で CHECK 制約が無いため、
--     'pending_payment' / 'expired' の追加使用に DDL 変更は不要

ALTER TABLE public.reservations
  ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'onsite'
    CHECK (payment_method IN ('onsite', 'square_online')),
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  ADD COLUMN square_payment_link_id TEXT,
  ADD COLUMN square_order_id TEXT,
  ADD COLUMN square_payment_id TEXT;

-- Webhook(payment.updated)からの逆引き用
CREATE INDEX idx_reservations_square_order
  ON public.reservations (square_order_id)
  WHERE square_order_id IS NOT NULL;

-- cleanup_expired_reservations は本番で毎分 pg_cron 実行され、
-- 「NOT is_confirmed AND expires_at < now()」の行を物理 DELETE している。
-- 決済待ち(pending_payment)行が削除されると Square 注文との相関が失われ、
-- 期限後入金の自動返金が不可能になるため、square_online の行を除外する。
-- (事前決済行は expire-event-holds が pending_payment→expired へ遷移させ、
--  監査・返金照合のため物理削除しない)
-- ※ステージングは旧定義が本番と異なっていた(UPDATE で expired 化)ため、
--   この置換で両環境を同一定義に統一する。
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    DELETE FROM reservations
    WHERE NOT is_confirmed
    AND expires_at < NOW()
    AND COALESCE(payment_method, 'onsite') <> 'square_online';
END;
$$;
