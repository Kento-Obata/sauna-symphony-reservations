-- パブリックイベント日: 休業日(shop_closures)にイベントを紐づける。
-- イベント日は貸切予約を受け付けない(休業日と同じ扱い)が、予約カレンダーでは
-- 「休」ではなくイベントへの導線を出す。
-- イベント枠(event_slots)を登録・削除すると、その日の休業日もトリガーで自動で追従する。

-- 本番には date の UNIQUE 制約が無く(staging にはある)、同じ日の重複行が残っていたため、
-- 古い方を残して重複を消してから制約を付ける(トリガーの ON CONFLICT (date) が前提にする)
DELETE FROM public.shop_closures a
USING public.shop_closures b
WHERE a.date = b.date AND (a.created_at, a.id) > (b.created_at, b.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shop_closures'::regclass AND contype = 'u' AND conname = 'shop_closures_date_key'
  ) THEN
    ALTER TABLE public.shop_closures ADD CONSTRAINT shop_closures_date_key UNIQUE (date);
  END IF;
END $$;

ALTER TABLE public.shop_closures
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shop_closures_event_id ON public.shop_closures (event_id);

-- 自動で作った休業日の目印。手動で入れていた休業日と区別し、枠が無くなったときに消してよいかの判定に使う
-- (手動の休業日にイベントが乗った場合は、枠が無くなると event_id だけ外して休業日に戻す)
CREATE OR REPLACE FUNCTION public.event_day_closure_reason() RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$ SELECT 'パブリックイベント'::text $$;

-- ============ 1日に開催できるイベントは1つまで ============
CREATE OR REPLACE FUNCTION public.ensure_single_event_per_day()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- 同じ日への同時登録をこの日付単位で直列化する
  PERFORM pg_advisory_xact_lock(hashtext('event_day:' || NEW.date::text));
  IF EXISTS (
    SELECT 1 FROM public.event_slots s
    WHERE s.date = NEW.date AND s.event_id <> NEW.event_id
  ) THEN
    RAISE EXCEPTION '%は別のイベントの開催日です（1日に開催できるイベントは1つまで）', to_char(NEW.date, 'YYYY/MM/DD');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_slots_single_event_per_day ON public.event_slots;
CREATE TRIGGER event_slots_single_event_per_day
  BEFORE INSERT OR UPDATE OF date, event_id ON public.event_slots
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_event_per_day();

-- ============ イベント枠 → 休業日の自動追従 ============
CREATE OR REPLACE FUNCTION public.sync_event_day_closures()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.event_slots
      WHERE event_id = OLD.event_id AND date = OLD.date
    ) THEN
      DELETE FROM public.shop_closures
      WHERE date = OLD.date AND event_id = OLD.event_id
        AND reason IS NOT DISTINCT FROM public.event_day_closure_reason();
      UPDATE public.shop_closures SET event_id = NULL, updated_at = now()
      WHERE date = OLD.date AND event_id = OLD.event_id;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    INSERT INTO public.shop_closures (date, reason, event_id)
    VALUES (NEW.date, public.event_day_closure_reason(), NEW.event_id)
    ON CONFLICT (date) DO UPDATE
      SET event_id = EXCLUDED.event_id, updated_at = now()
      WHERE shop_closures.event_id IS DISTINCT FROM EXCLUDED.event_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS event_slots_sync_closures ON public.event_slots;
CREATE TRIGGER event_slots_sync_closures
  AFTER INSERT OR DELETE OR UPDATE OF date, event_id ON public.event_slots
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_day_closures();

-- ============ 既存の今日以降のイベント枠を反映 ============
INSERT INTO public.shop_closures (date, reason, event_id)
SELECT DISTINCT ON (s.date) s.date, public.event_day_closure_reason(), s.event_id
FROM public.event_slots s
WHERE s.date >= (now() AT TIME ZONE 'Asia/Tokyo')::date
ORDER BY s.date, s.created_at
ON CONFLICT (date) DO UPDATE
  SET event_id = EXCLUDED.event_id, updated_at = now()
  WHERE shop_closures.event_id IS NULL;
