-- staff_idにユニーク制約を追加
ALTER TABLE staff_hourly_rates 
ADD CONSTRAINT staff_hourly_rates_staff_id_unique UNIQUE (staff_id);

-- 検算用に主要スタッフの時給設定を追加
INSERT INTO staff_hourly_rates (staff_id, weekday_rate, weekend_rate) 
VALUES 
  ('6f46b953-2439-4ab0-8826-42db740c94fe', 1300, 1450), -- 稲垣
  ('86590e91-1ea2-475b-b783-0b3ce54ccac9', 1300, 1450), -- 長澤
  ('5eb34982-5da1-4b93-94cd-5c2c4071b278', 1300, 1450), -- 宮城姉
  ('8fe65b28-6063-4e6f-9a6c-bed1985f8cc1', 1300, 1450); -- 宮城