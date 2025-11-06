-- Add pricing type support to options table
CREATE TYPE pricing_type AS ENUM ('per_person', 'flat');

-- Add pricing_type and flat_price columns to options table
ALTER TABLE options 
  ADD COLUMN pricing_type pricing_type NOT NULL DEFAULT 'per_person',
  ADD COLUMN flat_price INTEGER;

-- Add CHECK constraint for pricing values
ALTER TABLE options
  ADD CONSTRAINT check_pricing_values CHECK (
    (pricing_type = 'per_person' AND price_per_person IS NOT NULL) OR
    (pricing_type = 'flat' AND flat_price IS NOT NULL)
  );

-- Add total_price column to reservation_options table
ALTER TABLE reservation_options 
  ADD COLUMN total_price INTEGER;

-- Backfill existing data with calculated total_price
UPDATE reservation_options ro
SET total_price = ro.quantity * (
  SELECT o.price_per_person 
  FROM options o 
  WHERE o.id = ro.option_id
);

-- Make total_price NOT NULL after backfill
ALTER TABLE reservation_options 
  ALTER COLUMN total_price SET NOT NULL;