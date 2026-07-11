-- パブリックイベント予約: イベント / 枠(定員あり) / 予約 の3テーブル。
-- 既存 reservations(貸切・1枠1組)とは独立した共有予約モデル。
-- 定員の担保は create-event-reservation edge function 内の
-- 「SELECT ... FOR UPDATE + confirmed 合計」トランザクションで行う。

-- ============ events ============
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- slug は /events/:slug の URL になる。complete / reservation はフロントの
  -- 静的ルート(/events/complete, /events/reservation/:code)と衝突するため予約語。
  slug TEXT NOT NULL UNIQUE CHECK (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 3 AND 60
    AND slug NOT IN ('complete', 'reservation')
  ),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description TEXT,
  venue TEXT,
  price_per_person INTEGER NOT NULL DEFAULT 0 CHECK (price_per_person >= 0),
  price_note TEXT,
  max_guests_per_reservation INTEGER NOT NULL DEFAULT 4
    CHECK (max_guests_per_reservation BETWEEN 1 AND 20),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============ event_slots ============
CREATE TABLE public.event_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (event_id, date, start_time),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_event_slots_event_date ON public.event_slots (event_id, date);

-- ============ event_reservations ============
CREATE TABLE public.event_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 予約が存在する枠の削除は禁止(is_active=false で締める運用)
  slot_id UUID NOT NULL REFERENCES public.event_slots(id) ON DELETE RESTRICT,
  guest_name TEXT NOT NULL,
  guest_count INTEGER NOT NULL CHECK (guest_count >= 1),
  -- キャンセルリンクをメールで届けるため必須(貸切予約と異なる点)
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  reservation_code TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  total_price INTEGER NOT NULL DEFAULT 0,
  -- 将来の Square オンライン決済用。現状は現地払い(unpaid のまま運用)
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payment_method TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 残席集計(confirmed の guest_count 合計)用の部分インデックス
CREATE INDEX idx_event_reservations_slot_confirmed
  ON public.event_reservations (slot_id) WHERE status = 'confirmed';

-- ============ updated_at トリガ(既存関数を流用) ============
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_slots_updated_at
  BEFORE UPDATE ON public.event_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_reservations_updated_at
  BEFORE UPDATE ON public.event_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS ============
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published events"
  ON public.events FOR SELECT
  TO public USING (status = 'published');

CREATE POLICY "Only admins can manage events"
  ON public.events FOR ALL
  TO public USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Anyone can view active slots of published events"
  ON public.event_slots FOR SELECT
  TO public USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.status = 'published'
    )
  );

CREATE POLICY "Only admins can manage event slots"
  ON public.event_slots FOR ALL
  TO public USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- event_reservations は公開ポリシーなし(reservations と同方針)。
-- 公開側の作成・照会・キャンセルは edge function(直接 postgres 接続)経由のみ。
CREATE POLICY "Only admins can manage event reservations"
  ON public.event_reservations FOR ALL
  TO public USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
