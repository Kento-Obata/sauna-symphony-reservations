-- Add break_minutes column to shifts table
ALTER TABLE public.shifts 
ADD COLUMN break_minutes integer DEFAULT 0;

-- Create staff_hourly_rates table for hourly rate settings
CREATE TABLE public.staff_hourly_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL,
  weekday_rate integer NOT NULL DEFAULT 1300, -- 平日時給（円）
  weekend_rate integer NOT NULL DEFAULT 1450, -- 土日時給（円）
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT staff_hourly_rates_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES profiles(id)
);

-- Enable RLS on staff_hourly_rates
ALTER TABLE public.staff_hourly_rates ENABLE ROW LEVEL SECURITY;

-- Create policies for staff_hourly_rates
CREATE POLICY "Admins can manage hourly rates" 
ON public.staff_hourly_rates 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Staff can view their own hourly rates" 
ON public.staff_hourly_rates 
FOR SELECT 
USING (staff_id = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- Create trigger for updated_at
CREATE TRIGGER update_staff_hourly_rates_updated_at
BEFORE UPDATE ON public.staff_hourly_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a view for monthly salary calculations
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
  SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600 - COALESCE(s.break_minutes, 0) / 60.0) as total_work_hours
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