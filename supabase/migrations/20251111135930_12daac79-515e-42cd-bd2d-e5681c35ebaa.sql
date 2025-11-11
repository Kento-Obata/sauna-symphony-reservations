-- Remove public SELECT policies that allow unrestricted access
DROP POLICY IF EXISTS "Public can read reservations by token" ON reservations;
DROP POLICY IF EXISTS "Public can view own reservations by token" ON reservations;

-- Keep the policy for public to create reservations (仮予約作成は引き続き可能)
-- "Public can create reservations" は維持

-- Staff/Admin policies remain unchanged
-- "Staff can view reservations"
-- "Staff can manage reservations" 
-- "Staff can update reservations"
-- "Staff can create reservations"