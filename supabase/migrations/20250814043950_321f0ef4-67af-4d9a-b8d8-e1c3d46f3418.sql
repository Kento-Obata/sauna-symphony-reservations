-- Drop existing daily_time_slots table if it exists
DROP TABLE IF EXISTS public.daily_time_slots;

-- Create daily_time_slots table without column-dependent defaults
CREATE TABLE public.daily_time_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  time_slot time_slot NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(date, time_slot)
);

-- Enable RLS
ALTER TABLE public.daily_time_slots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view daily time slots" 
ON public.daily_time_slots 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage daily time slots" 
ON public.daily_time_slots 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Create updated_at trigger
CREATE TRIGGER update_daily_time_slots_updated_at
  BEFORE UPDATE ON public.daily_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to set default times based on time_slot
CREATE OR REPLACE FUNCTION public.set_default_time_slot_times()
RETURNS TRIGGER AS $$
BEGIN
  -- Set default start and end times based on time_slot if not provided
  IF NEW.time_slot = 'morning' THEN
    IF NEW.start_time IS NULL THEN NEW.start_time = '10:00'::TIME; END IF;
    IF NEW.end_time IS NULL THEN NEW.end_time = '12:30'::TIME; END IF;
  ELSIF NEW.time_slot = 'afternoon' THEN
    IF NEW.start_time IS NULL THEN NEW.start_time = '13:30'::TIME; END IF;
    IF NEW.end_time IS NULL THEN NEW.end_time = '16:00'::TIME; END IF;
  ELSIF NEW.time_slot = 'evening' THEN
    IF NEW.start_time IS NULL THEN NEW.start_time = '17:00'::TIME; END IF;
    IF NEW.end_time IS NULL THEN NEW.end_time = '19:30'::TIME; END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for default time setting
CREATE TRIGGER set_default_time_slot_times_trigger
  BEFORE INSERT ON public.daily_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_time_slot_times();