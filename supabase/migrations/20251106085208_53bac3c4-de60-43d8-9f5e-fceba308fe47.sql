-- Add 'per_guest' to pricing_type enum (auto-applies to all guests)
ALTER TYPE pricing_type ADD VALUE IF NOT EXISTS 'per_guest';