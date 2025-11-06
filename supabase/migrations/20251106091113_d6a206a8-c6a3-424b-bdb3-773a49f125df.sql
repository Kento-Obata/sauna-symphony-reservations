-- Drop the old constraint
ALTER TABLE options DROP CONSTRAINT IF EXISTS check_pricing_values;

-- Add updated constraint that includes per_guest
ALTER TABLE options
ADD CONSTRAINT check_pricing_values CHECK (
  (pricing_type = 'flat' AND flat_price IS NOT NULL AND price_per_person = 0) OR
  (pricing_type IN ('per_person', 'per_guest') AND price_per_person > 0 AND flat_price IS NULL)
);