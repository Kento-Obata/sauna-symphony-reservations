-- さとしさんの時給設定を追加
INSERT INTO staff_hourly_rates (staff_id, weekday_rate, weekend_rate) 
VALUES ('bbb9bd61-0a28-46b0-bd05-05a7995b4d3e', 1300, 1450) -- さとし
ON CONFLICT (staff_id) DO UPDATE SET
  weekday_rate = EXCLUDED.weekday_rate,
  weekend_rate = EXCLUDED.weekend_rate;