
-- reservationsテーブルに管理者メモ関連のカラムを追加
ALTER TABLE public.reservations 
ADD COLUMN admin_memo text,
ADD COLUMN admin_memo_updated_at timestamp with time zone,
ADD COLUMN admin_memo_updated_by uuid;

-- ユーザー統計用のビューを作成（user_key ベース - オーナー電話番号の特例処理含む）
CREATE OR REPLACE VIEW public.user_reservation_stats AS 
SELECT 
  CASE
    WHEN phone = '08033717377' THEN guest_name
    ELSE phone
  END AS user_key,
  phone,
  MAX(guest_name) as latest_name,
  MAX(email) as latest_email,
  COUNT(*) as total_reservations,
  COUNT(CASE WHEN status != 'cancelled' THEN 1 END) as completed_reservations,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_reservations,
  MAX(date) as last_visit_date,
  MIN(date) as first_visit_date,
  MAX(created_at) as last_reservation_created
FROM public.reservations 
WHERE status = 'confirmed'
GROUP BY user_key, phone
ORDER BY last_reservation_created DESC;

-- 顧客検索用のビューも作成（検索しやすくするため）
CREATE OR REPLACE VIEW public.customer_search AS
SELECT 
  CASE
    WHEN phone = '08033717377' THEN guest_name
    ELSE phone
  END AS user_key,
  phone,
  guest_name,
  email,
  date,
  status,
  total_price,
  admin_memo,
  created_at,
  id as reservation_id
FROM public.reservations
ORDER BY created_at DESC;
