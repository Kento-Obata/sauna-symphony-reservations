-- 未設定のスタッフ全員に標準時給を設定
INSERT INTO staff_hourly_rates (staff_id, weekday_rate, weekend_rate) 
VALUES 
  ('cd6038cc-5402-4d57-84bd-6d4ced4af556', 1300, 1450), -- 吉田
  ('3e0a26fa-1d05-49ea-b828-56b98ba2e180', 1300, 1450), -- 大谷
  ('ce9bdbec-94ca-48e3-b278-5a3320040662', 1300, 1450), -- 宮崎
  ('9f934c82-d84f-4e83-8224-ea0ef86e6a72', 1300, 1450), -- 池田
  ('8926ef79-a6ce-49ac-9794-472a5a616a0c', 1300, 1450)  -- 藤木
ON CONFLICT (staff_id) DO UPDATE SET
  weekday_rate = EXCLUDED.weekday_rate,
  weekend_rate = EXCLUDED.weekend_rate;