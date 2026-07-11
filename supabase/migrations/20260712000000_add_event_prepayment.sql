-- イベント予約 Square 事前決済:
--   - events.payment_type: イベントごとに現地払い(onsite) / 事前決済(prepaid)を選択
--   - event_reservations に決済待ち(pending_payment)・期限切れ(expired)状態と Square 相関列を追加
--
-- 残席の定義が変わる点に注意:
--   残席 = capacity - Σ guest_count of (confirmed + 期限内の pending_payment)
-- expires_at > now() は部分インデックスに入れられない(now() は IMMUTABLE でない)ため
-- クエリ側で判定する。

-- ============ events ============
ALTER TABLE public.events
  ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'onsite'
    CHECK (payment_type IN ('onsite', 'prepaid'));

-- ============ event_reservations: 状態の拡張 ============
-- pending_payment: Square 決済完了待ち。expires_at まで席を確保する
-- expired: 期限内に支払われなかった終端状態(席は解放済み)
ALTER TABLE public.event_reservations
  DROP CONSTRAINT event_reservations_status_check;
ALTER TABLE public.event_reservations
  ADD CONSTRAINT event_reservations_status_check
    CHECK (status IN ('confirmed', 'cancelled', 'pending_payment', 'expired'));

ALTER TABLE public.event_reservations
  ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN square_payment_link_id TEXT,
  ADD COLUMN square_order_id TEXT,
  ADD COLUMN square_payment_id TEXT;

-- ============ インデックス ============
-- 残席集計対象が confirmed + pending_payment になったため張り替え
DROP INDEX public.idx_event_reservations_slot_confirmed;
CREATE INDEX idx_event_reservations_slot_active
  ON public.event_reservations (slot_id)
  WHERE status IN ('confirmed', 'pending_payment');

-- Webhook(payment.updated)からの逆引き用
CREATE INDEX idx_event_reservations_square_order
  ON public.event_reservations (square_order_id)
  WHERE square_order_id IS NOT NULL;
