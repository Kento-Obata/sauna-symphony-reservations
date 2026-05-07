-- 1. shift_preferences RLS
CREATE POLICY "Staff can view their own shift preferences"
  ON public.shift_preferences FOR SELECT
  USING (staff_id = auth.uid());

CREATE POLICY "Staff can insert their own shift preferences"
  ON public.shift_preferences FOR INSERT
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff can update their own shift preferences"
  ON public.shift_preferences FOR UPDATE
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff can delete their own shift preferences"
  ON public.shift_preferences FOR DELETE
  USING (staff_id = auth.uid());

CREATE POLICY "Admins can manage all shift preferences"
  ON public.shift_preferences FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 2. reservation_options: drop always-true INSERT, restrict to admins
-- Edge Functions use service role and bypass RLS → no functional impact
DROP POLICY IF EXISTS "Anyone can create reservation options" ON public.reservation_options;

CREATE POLICY "Admins can insert reservation options"
  ON public.reservation_options FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 3. Pin search_path on existing functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_shift_updated_at() SET search_path = public;
ALTER FUNCTION public.set_default_time_slot_times() SET search_path = public;
ALTER FUNCTION public.ensure_admin_role() SET search_path = public;
ALTER FUNCTION public.generate_reservation_code() SET search_path = public;
ALTER FUNCTION public.set_reservation_code() SET search_path = public;
ALTER FUNCTION public.set_reservation_code_and_expiration() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_reservations() SET search_path = public;