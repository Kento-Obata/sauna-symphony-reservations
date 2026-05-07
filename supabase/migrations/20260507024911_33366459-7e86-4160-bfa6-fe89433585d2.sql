-- 1. Enable RLS on shift_preferences (policies already exist)
ALTER TABLE public.shift_preferences ENABLE ROW LEVEL SECURITY;

-- 2. Restrict profiles SELECT to authenticated users
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Restrict reservation_options SELECT to admin/staff only
DROP POLICY IF EXISTS "Anyone can view reservation options" ON public.reservation_options;
CREATE POLICY "Staff and admins can view reservation options"
  ON public.reservation_options
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin','staff')
  ));

-- 4. Remove reservations from realtime publication (no client subscribes to it)
ALTER PUBLICATION supabase_realtime DROP TABLE public.reservations;

-- 5. Recreate views with security_invoker=true
ALTER VIEW public.monthly_salary_summary SET (security_invoker = true);
ALTER VIEW public.user_reservation_stats SET (security_invoker = true);
ALTER VIEW public.customer_search SET (security_invoker = true);