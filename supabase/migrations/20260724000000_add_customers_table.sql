-- customers master table (phone-based identity)
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE,
  email TEXT,
  name TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  visit_count INTEGER NOT NULL DEFAULT 0,
  last_visit_date DATE,
  marketing_email_opt_in BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_email ON public.customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_opt_in ON public.customers(marketing_email_opt_in) WHERE marketing_email_opt_in = true AND email IS NOT NULL;

-- bulk email campaign tracking
CREATE TABLE public.bulk_email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_customers" ON public.customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_campaigns" ON public.bulk_email_campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_customers_updated_at();

-- Seed from reservations (phone-based dedup, confirmed only)
INSERT INTO public.customers (phone, email, name, source, visit_count, last_visit_date)
SELECT
  phone,
  MAX(email) AS email,
  MAX(guest_name) AS name,
  'reservation' AS source,
  COUNT(*) AS visit_count,
  MAX(date) AS last_visit_date
FROM public.reservations
WHERE status = 'confirmed' AND phone IS NOT NULL AND phone != ''
GROUP BY phone
ON CONFLICT (phone) DO NOTHING;

-- Merge from event_reservations
INSERT INTO public.customers (phone, email, name, source, visit_count, last_visit_date)
SELECT
  er.phone,
  MAX(er.email) AS email,
  MAX(er.guest_name) AS name,
  'event' AS source,
  COUNT(*) AS visit_count,
  MAX(es.date) AS last_visit_date
FROM public.event_reservations er
JOIN public.event_slots es ON er.slot_id = es.id
WHERE er.status = 'confirmed' AND er.phone IS NOT NULL AND er.phone != ''
GROUP BY er.phone
ON CONFLICT (phone) DO UPDATE SET
  email = COALESCE(customers.email, EXCLUDED.email),
  name = COALESCE(customers.name, EXCLUDED.name),
  visit_count = customers.visit_count + EXCLUDED.visit_count,
  last_visit_date = GREATEST(customers.last_visit_date, EXCLUDED.last_visit_date),
  updated_at = now();
