-- Drop existing daily_time_slots table if it exists
DROP TABLE IF EXISTS public.daily_time_slots;

-- Create daily_time_slots table with proper default values
CREATE TABLE public.daily_time_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  time_slot time_slot NOT NULL,
  start_time TIME NOT NULL DEFAULT CASE 
    WHEN time_slot = 'morning' THEN '10:00'::TIME
    WHEN time_slot = 'afternoon' THEN '13:30'::TIME  
    WHEN time_slot = 'evening' THEN '17:00'::TIME
  END,
  end_time TIME NOT NULL DEFAULT CASE
    WHEN time_slot = 'morning' THEN '12:30'::TIME
    WHEN time_slot = 'afternoon' THEN '16:00'::TIME
    WHEN time_slot = 'evening' THEN '19:30'::TIME  
  END,
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