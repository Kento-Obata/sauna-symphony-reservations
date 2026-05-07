ALTER TABLE public.time_slot_patterns
  ADD COLUMN IF NOT EXISTS night_start TIME NULL,
  ADD COLUMN IF NOT EXISTS night_end TIME NULL;

CREATE OR REPLACE FUNCTION public.set_default_time_slot_times()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.time_slot = 'morning' THEN
    IF NEW.start_time IS NULL THEN NEW.start_time = '10:00'::TIME; END IF;
    IF NEW.end_time IS NULL THEN NEW.end_time = '12:30'::TIME; END IF;
  ELSIF NEW.time_slot = 'afternoon' THEN
    IF NEW.start_time IS NULL THEN NEW.start_time = '13:30'::TIME; END IF;
    IF NEW.end_time IS NULL THEN NEW.end_time = '16:00'::TIME; END IF;
  ELSIF NEW.time_slot = 'evening' THEN
    IF NEW.start_time IS NULL THEN NEW.start_time = '17:00'::TIME; END IF;
    IF NEW.end_time IS NULL THEN NEW.end_time = '19:30'::TIME; END IF;
  ELSIF NEW.time_slot = 'night' THEN
    IF NEW.start_time IS NULL THEN NEW.start_time = '20:00'::TIME; END IF;
    IF NEW.end_time IS NULL THEN NEW.end_time = '22:30'::TIME; END IF;
  END IF;
  RETURN NEW;
END;
$function$;