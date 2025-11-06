-- Fix RLS policies for options table to not reference auth.users table
-- Drop existing policies
DROP POLICY IF EXISTS "Only administrators can insert options" ON public.options;
DROP POLICY IF EXISTS "Only administrators can update options" ON public.options;
DROP POLICY IF EXISTS "Only administrators can delete options" ON public.options;

-- Recreate policies without auth.users reference
CREATE POLICY "Only administrators can insert options"
ON public.options
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Only administrators can update options"
ON public.options
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Only administrators can delete options"
ON public.options
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);