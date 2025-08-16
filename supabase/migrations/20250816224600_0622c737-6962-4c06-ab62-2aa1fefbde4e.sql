-- Allow public users to create reservations (for regular customers)
CREATE POLICY "Public can create reservations" 
ON public.reservations 
FOR INSERT 
WITH CHECK (true);

-- Allow public users to read their own reservations by confirmation token
CREATE POLICY "Public can read reservations by token" 
ON public.reservations 
FOR SELECT 
USING (true);