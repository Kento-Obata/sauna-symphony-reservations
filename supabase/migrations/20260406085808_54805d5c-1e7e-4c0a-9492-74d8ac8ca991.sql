
CREATE TABLE public.time_slot_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  morning_start TIME NOT NULL DEFAULT '10:00',
  morning_end TIME NOT NULL DEFAULT '12:30',
  afternoon_start TIME NOT NULL DEFAULT '13:30',
  afternoon_end TIME NOT NULL DEFAULT '16:00',
  evening_start TIME NOT NULL DEFAULT '17:00',
  evening_end TIME NOT NULL DEFAULT '19:30',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.time_slot_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view time slot patterns"
  ON public.time_slot_patterns FOR SELECT
  TO public USING (true);

CREATE POLICY "Only admins can manage time slot patterns"
  ON public.time_slot_patterns FOR ALL
  TO public USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Insert default patterns
INSERT INTO public.time_slot_patterns (name, morning_start, morning_end, afternoon_start, afternoon_end, evening_start, evening_end)
VALUES 
  ('パターン①（通常）', '10:00', '12:30', '13:30', '16:00', '17:00', '19:30'),
  ('パターン②（午後シフト）', '13:00', '15:30', '16:30', '18:00', '19:00', '21:30');
