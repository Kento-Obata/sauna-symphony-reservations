-- Add access_token column for protected reservation detail access
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS access_token text;

-- Backfill existing reservations with a unique access token
UPDATE public.reservations
SET access_token = encode(gen_random_bytes(32), 'hex')
WHERE access_token IS NULL;

-- Index for faster token-based lookup
CREATE INDEX IF NOT EXISTS idx_reservations_access_token
  ON public.reservations(access_token);

-- Update existing trigger function to also generate access_token
CREATE OR REPLACE FUNCTION public.set_reservation_code_and_expiration()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Generate reservation code
  LOOP
    new_code := generate_reservation_code();

    SELECT EXISTS (
      SELECT 1 FROM reservations
      WHERE reservation_code = new_code
    ) INTO code_exists;

    IF NOT code_exists THEN
      NEW.reservation_code := new_code;
      EXIT;
    END IF;
  END LOOP;

  -- Generate confirmation token
  IF NEW.confirmation_token IS NULL THEN
    NEW.confirmation_token := encode(gen_random_bytes(32), 'hex');
  END IF;

  -- Generate access token (for protected detail page access)
  IF NEW.access_token IS NULL THEN
    NEW.access_token := encode(gen_random_bytes(32), 'hex');
  END IF;

  -- Set expiration time (2 hours from now)
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + interval '2 hours';
  END IF;

  RETURN NEW;
END;
$function$;