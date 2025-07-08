-- Update the monthly salary summary view to include total break time
CREATE OR REPLACE VIEW public.monthly_salary_summary AS
SELECT 
  s.staff_id,
  p.username as staff_name,
  EXTRACT(YEAR FROM s.start_time) as year,
  EXTRACT(MONTH FROM s.start_time) as month,
  COUNT(*) as total_shifts,
  SUM(
    CASE 
      WHEN EXTRACT(DOW FROM s.start_time) IN (0, 6) THEN -- Sunday=0, Saturday=6
        (EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600 - COALESCE(s.break_minutes, 0) / 60.0) * COALESCE(hr.weekend_rate, 1450)
      ELSE 
        (EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600 - COALESCE(s.break_minutes, 0) / 60.0) * COALESCE(hr.weekday_rate, 1300)
    END
  ) as total_salary,
  SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600 - COALESCE(s.break_minutes, 0) / 60.0) as total_work_hours,
  SUM(COALESCE(s.break_minutes, 0) / 60.0) as total_break_hours
FROM 
  public.shifts s
  INNER JOIN public.profiles p ON s.staff_id = p.id
  LEFT JOIN public.staff_hourly_rates hr ON s.staff_id = hr.staff_id
WHERE 
  s.status = 'scheduled'
GROUP BY 
  s.staff_id, p.username, EXTRACT(YEAR FROM s.start_time), EXTRACT(MONTH FROM s.start_time), hr.weekday_rate, hr.weekend_rate
ORDER BY 
  year DESC, month DESC, staff_name;