CREATE OR REPLACE FUNCTION public.set_reservation_code_and_expiration()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_code TEXT;
  confirmation_token TEXT;
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
  NEW.confirmation_token := encode(gen_random_bytes(32), 'hex');
  
  -- Set expiration time (2 hours from now)
  NEW.expires_at := NOW() + interval '2 hours';
  
  RETURN NEW;
END;
$function$;