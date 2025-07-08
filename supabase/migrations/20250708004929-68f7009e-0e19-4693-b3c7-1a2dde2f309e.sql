-- Update existing shifts to set appropriate break times
-- For shifts longer than 6.5 hours (390 minutes), set break to 60 minutes
UPDATE public.shifts 
SET break_minutes = 60
WHERE EXTRACT(EPOCH FROM (end_time - start_time)) / 60 >= 390
  AND break_minutes = 0;