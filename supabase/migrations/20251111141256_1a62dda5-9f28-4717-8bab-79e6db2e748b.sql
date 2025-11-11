-- Remove the public INSERT policy for reservations
-- Public users will now use the create-reservation edge function instead
DROP POLICY IF EXISTS "Public can create reservations" ON public.reservations;