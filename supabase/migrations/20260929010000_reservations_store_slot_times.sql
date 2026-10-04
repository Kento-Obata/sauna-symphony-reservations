-- 予約の実時刻(start_time/end_time)を reservations に保存する。
--
-- 背景: これまで予約の時刻は保存されておらず、表示のたびに
--   1) daily_time_slots の明示 active 行 → 2) 日付・曜日・祝日・ルール開始日からの既定
-- を各画面・各関数が個別に計算していた。計算ロジックが複数箇所に重複し、ルール変更時に
-- 取り残された箇所の表示がズレる事故が起きた(2026-09 の LINE 通知 1h ズレ)。
--
-- 方針:
--   - 予約行に実時刻を持たせ、表示側は一切計算しない
--   - 作成時の確定は DB トリガー(reservations_fill_slot_times)が一元的に行う
--       明示行があればそれ、無ければ default_slot_times() の既定ルール
--   - 日付/枠を変更する UPDATE で時刻が明示されなければ同じ手順で再計算する
--   - 既存行は同じ手順でバックフィルする
--
-- 既定ルール(フロント src/utils/timeSlotRules.ts と同一):
--   - 土日祝 2026-06-06〜 / 平日 2026-08-01〜 : 統一4枠
--       morning 10:00-12:30 / afternoon 13:00-15:30 / evening 16:00-18:30 / night 19:00-21:30
--   - それ以前 : 旧時刻
--       morning 10:00-12:30 / afternoon 13:30-16:00 / evening 17:00-19:30 / night 20:00-22:30
--   祝日は jp_holidays テーブル(japanese-holidays@1.0.10 から生成、2024〜2030)。
--   2031 年以降の予約を受ける前に行を追加すること。
--
-- 本番には 2026-09-29 に MCP execute_sql で適用済み(migration repair で履歴登録)。
-- staging には 2026-10-02 に適用(事前に time_slot enum へ 'night' を追加)。

begin;

-- ---------------------------------------------------------------------------
-- 1. 祝日テーブル
-- ---------------------------------------------------------------------------
create table if not exists public.jp_holidays (
  holiday_date date primary key,
  name text not null
);
comment on table public.jp_holidays is
  '日本の祝日。default_slot_times() の土日祝判定に使用。japanese-holidays@1.0.10 から生成(2024〜2030)';

alter table public.jp_holidays enable row level security;
drop policy if exists "jp_holidays are readable by everyone" on public.jp_holidays;
create policy "jp_holidays are readable by everyone"
  on public.jp_holidays for select using (true);

insert into public.jp_holidays (holiday_date, name) values
  ('2024-01-01', '元日'),
  ('2024-01-08', '成人の日'),
  ('2024-02-11', '建国記念の日'),
  ('2024-02-12', '振替休日'),
  ('2024-02-23', '天皇誕生日'),
  ('2024-03-20', '春分の日'),
  ('2024-04-29', '昭和の日'),
  ('2024-05-03', '憲法記念日'),
  ('2024-05-04', 'みどりの日'),
  ('2024-05-05', 'こどもの日'),
  ('2024-05-06', '振替休日'),
  ('2024-07-15', '海の日'),
  ('2024-08-11', '山の日'),
  ('2024-08-12', '振替休日'),
  ('2024-09-16', '敬老の日'),
  ('2024-09-22', '秋分の日'),
  ('2024-09-23', '振替休日'),
  ('2024-10-14', 'スポーツの日'),
  ('2024-11-03', '文化の日'),
  ('2024-11-04', '振替休日'),
  ('2024-11-23', '勤労感謝の日'),
  ('2025-01-01', '元日'),
  ('2025-01-13', '成人の日'),
  ('2025-02-11', '建国記念の日'),
  ('2025-02-23', '天皇誕生日'),
  ('2025-02-24', '振替休日'),
  ('2025-03-20', '春分の日'),
  ('2025-04-29', '昭和の日'),
  ('2025-05-03', '憲法記念日'),
  ('2025-05-04', 'みどりの日'),
  ('2025-05-05', 'こどもの日'),
  ('2025-05-06', '振替休日'),
  ('2025-07-21', '海の日'),
  ('2025-08-11', '山の日'),
  ('2025-09-15', '敬老の日'),
  ('2025-09-23', '秋分の日'),
  ('2025-10-13', 'スポーツの日'),
  ('2025-11-03', '文化の日'),
  ('2025-11-23', '勤労感謝の日'),
  ('2025-11-24', '振替休日'),
  ('2026-01-01', '元日'),
  ('2026-01-12', '成人の日'),
  ('2026-02-11', '建国記念の日'),
  ('2026-02-23', '天皇誕生日'),
  ('2026-03-20', '春分の日'),
  ('2026-04-29', '昭和の日'),
  ('2026-05-03', '憲法記念日'),
  ('2026-05-04', 'みどりの日'),
  ('2026-05-05', 'こどもの日'),
  ('2026-05-06', '振替休日'),
  ('2026-07-20', '海の日'),
  ('2026-08-11', '山の日'),
  ('2026-09-21', '敬老の日'),
  ('2026-09-22', '国民の休日'),
  ('2026-09-23', '秋分の日'),
  ('2026-10-12', 'スポーツの日'),
  ('2026-11-03', '文化の日'),
  ('2026-11-23', '勤労感謝の日'),
  ('2027-01-01', '元日'),
  ('2027-01-11', '成人の日'),
  ('2027-02-11', '建国記念の日'),
  ('2027-02-23', '天皇誕生日'),
  ('2027-03-21', '春分の日'),
  ('2027-03-22', '振替休日'),
  ('2027-04-29', '昭和の日'),
  ('2027-05-03', '憲法記念日'),
  ('2027-05-04', 'みどりの日'),
  ('2027-05-05', 'こどもの日'),
  ('2027-07-19', '海の日'),
  ('2027-08-11', '山の日'),
  ('2027-09-20', '敬老の日'),
  ('2027-09-23', '秋分の日'),
  ('2027-10-11', 'スポーツの日'),
  ('2027-11-03', '文化の日'),
  ('2027-11-23', '勤労感謝の日'),
  ('2028-01-01', '元日'),
  ('2028-01-10', '成人の日'),
  ('2028-02-11', '建国記念の日'),
  ('2028-02-23', '天皇誕生日'),
  ('2028-03-20', '春分の日'),
  ('2028-04-29', '昭和の日'),
  ('2028-05-03', '憲法記念日'),
  ('2028-05-04', 'みどりの日'),
  ('2028-05-05', 'こどもの日'),
  ('2028-07-17', '海の日'),
  ('2028-08-11', '山の日'),
  ('2028-09-18', '敬老の日'),
  ('2028-09-22', '秋分の日'),
  ('2028-10-09', 'スポーツの日'),
  ('2028-11-03', '文化の日'),
  ('2028-11-23', '勤労感謝の日'),
  ('2029-01-01', '元日'),
  ('2029-01-08', '成人の日'),
  ('2029-02-11', '建国記念の日'),
  ('2029-02-12', '振替休日'),
  ('2029-02-23', '天皇誕生日'),
  ('2029-03-20', '春分の日'),
  ('2029-04-29', '昭和の日'),
  ('2029-04-30', '振替休日'),
  ('2029-05-03', '憲法記念日'),
  ('2029-05-04', 'みどりの日'),
  ('2029-05-05', 'こどもの日'),
  ('2029-07-16', '海の日'),
  ('2029-08-11', '山の日'),
  ('2029-09-17', '敬老の日'),
  ('2029-09-23', '秋分の日'),
  ('2029-09-24', '振替休日'),
  ('2029-10-08', 'スポーツの日'),
  ('2029-11-03', '文化の日'),
  ('2029-11-23', '勤労感謝の日'),
  ('2030-01-01', '元日'),
  ('2030-01-14', '成人の日'),
  ('2030-02-11', '建国記念の日'),
  ('2030-02-23', '天皇誕生日'),
  ('2030-03-20', '春分の日'),
  ('2030-04-29', '昭和の日'),
  ('2030-05-03', '憲法記念日'),
  ('2030-05-04', 'みどりの日'),
  ('2030-05-05', 'こどもの日'),
  ('2030-05-06', '振替休日'),
  ('2030-07-15', '海の日'),
  ('2030-08-11', '山の日'),
  ('2030-08-12', '振替休日'),
  ('2030-09-16', '敬老の日'),
  ('2030-09-23', '秋分の日'),
  ('2030-10-14', 'スポーツの日'),
  ('2030-11-03', '文化の日'),
  ('2030-11-04', '振替休日'),
  ('2030-11-23', '勤労感謝の日')
on conflict (holiday_date) do update set name = excluded.name;

-- ---------------------------------------------------------------------------
-- 2. 既定ルール関数
-- ---------------------------------------------------------------------------
create or replace function public.default_slot_times(_date date, _slot public.time_slot)
returns table (start_time time, end_time time)
language sql
stable
set search_path = public
as $$
  with flags as (
    select
      (extract(dow from _date) in (0, 6)
       or exists (select 1 from public.jp_holidays h where h.holiday_date = _date)) as weekend_or_holiday
  ),
  mode as (
    select
      ((_date >= date '2026-06-06' and weekend_or_holiday)
       or (_date >= date '2026-08-01' and not weekend_or_holiday)) as unified4
    from flags
  )
  select
    case _slot
      when 'morning'   then time '10:00'
      when 'afternoon' then case when unified4 then time '13:00' else time '13:30' end
      when 'evening'   then case when unified4 then time '16:00' else time '17:00' end
      when 'night'     then case when unified4 then time '19:00' else time '20:00' end
    end,
    case _slot
      when 'morning'   then time '12:30'
      when 'afternoon' then case when unified4 then time '15:30' else time '16:00' end
      when 'evening'   then case when unified4 then time '18:30' else time '19:30' end
      when 'night'     then case when unified4 then time '21:30' else time '22:30' end
    end
  from mode
$$;
comment on function public.default_slot_times(date, public.time_slot) is
  '明示行(daily_time_slots)が無い場合の枠既定時刻。フロント timeSlotRules.ts と同一ルール';

-- 明示行 → 既定ルール の順で枠の時刻を解決する
create or replace function public.resolve_slot_times(_date date, _slot public.time_slot)
returns table (start_time time, end_time time)
language sql
stable
set search_path = public
as $$
  select coalesce(d.start_time, r.start_time), coalesce(d.end_time, r.end_time)
  from public.default_slot_times(_date, _slot) r
  left join public.daily_time_slots d
    on d.date = _date and d.time_slot = _slot and d.is_active = true
$$;

-- ---------------------------------------------------------------------------
-- 3. 列追加 + バックフィル
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists start_time time,
  add column if not exists end_time time;

comment on column public.reservations.start_time is
  '予約枠の開始時刻(JST)。作成時にトリガーで確定し、以後は表示側で導出しない';
comment on column public.reservations.end_time is
  '予約枠の終了時刻(JST)。同上';

update public.reservations r
set start_time = (select t.start_time from public.resolve_slot_times(r.date, r.time_slot) t),
    end_time   = (select t.end_time   from public.resolve_slot_times(r.date, r.time_slot) t)
where r.start_time is null or r.end_time is null;

alter table public.reservations
  alter column start_time set not null,
  alter column end_time set not null;

alter table public.reservations
  drop constraint if exists reservations_slot_times_check;
alter table public.reservations
  add constraint reservations_slot_times_check check (end_time > start_time);

-- ---------------------------------------------------------------------------
-- 4. 作成/変更時に時刻を確定するトリガー
-- ---------------------------------------------------------------------------
create or replace function public.reservations_fill_slot_times()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- 日付・枠が変わらない更新は触らない(時刻の明示変更もそのまま通す)
    if (new.date, new.time_slot) is not distinct from (old.date, old.time_slot) then
      return new;
    end if;
    -- 日付/枠と同時に時刻も明示指定されていればそれを尊重
    if (new.start_time, new.end_time) is distinct from (old.start_time, old.end_time)
       and new.start_time is not null and new.end_time is not null then
      return new;
    end if;
  elsif new.start_time is not null and new.end_time is not null then
    return new;
  end if;

  select t.start_time, t.end_time
    into new.start_time, new.end_time
  from public.resolve_slot_times(new.date, new.time_slot) t;

  return new;
end;
$$;

drop trigger if exists reservations_fill_slot_times on public.reservations;
create trigger reservations_fill_slot_times
  before insert or update of date, time_slot on public.reservations
  for each row execute function public.reservations_fill_slot_times();

-- ---------------------------------------------------------------------------
-- 5. ビューに列を追加
-- ---------------------------------------------------------------------------
-- ビューは環境ごとに列順が異なりうる(staging は phone, email の順。create or replace は
-- 既存の列順を要求する)ため、既存の列並びをそのまま読み取り、末尾に start_time / end_time を足す。
-- 依存ビュー(v_monthly_sales 等)は末尾追加なら影響を受けない。
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'v_valid_reservations'
    and column_name not in ('start_time', 'end_time');

  if cols is null then
    cols := 'id, date, time_slot, guest_name, guest_count, email, phone, water_temperature, '
         || 'created_at, reservation_code, status, is_confirmed, confirmation_token, expires_at, '
         || 'total_price, admin_memo, admin_memo_updated_at, admin_memo_updated_by, access_token, '
         || 'payment_method, payment_status, square_payment_link_id, square_order_id, square_payment_id';
  end if;

  execute format(
    'create or replace view public.v_valid_reservations as '
    || 'select %s, start_time, end_time from public.reservations '
    || 'where status = ''confirmed'' and guest_name <> ''休枠''',
    cols
  );
end
$$;

commit;
