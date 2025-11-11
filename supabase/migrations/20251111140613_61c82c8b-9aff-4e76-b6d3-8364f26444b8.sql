-- Drop and recreate the public insert policy to ensure it exists
DROP POLICY IF EXISTS "Public can create reservations" ON reservations;

-- Recreate policy to allow public reservation creation
CREATE POLICY "Public can create reservations" 
ON reservations 
FOR INSERT 
WITH CHECK (true);