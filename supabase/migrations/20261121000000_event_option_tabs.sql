-- イベント当日のオプション記録（水着・タオルなどの貸し出し / 販売）と、最後の会計。
--   event_option_items  オプションの品目と単価（全イベント共通）
--   event_tabs          お客さんごとの会計。イベント予約(event_reservation_id)か、当日飛び込み(名前だけ)のどちらか
--   event_tab_lines     会計の明細（品目ごとの個数。単価は最初に追加した時点の値を保存）
-- 操作はすべて security definer 関数経由。スタッフは staff_access_tokens のトークン（ログイン不要）、
-- 管理者はログインした状態で p_token を null にして呼ぶ。
-- スタッフが扱えるのは「今日(JST)の前後1日に枠があるイベント」だけ。スタッフには電話・メールを返さない。
-- 精算済みの会計は明細を変えられない（取り消してから直す）。

create table if not exists public.event_option_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  price integer not null check (price >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.event_tabs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  -- 予約のお客さん。null は当日飛び込み
  event_reservation_id uuid unique references public.event_reservations(id) on delete cascade,
  -- 飛び込みのお客さんの名前・人数・枠（予約の場合は予約側の値を使うので null）
  guest_name text check (guest_name is null or char_length(guest_name) between 1 and 60),
  guest_count integer check (guest_count is null or guest_count between 1 and 20),
  slot_id uuid references public.event_slots(id) on delete set null,
  settled_at timestamptz,
  settled_amount integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (event_reservation_id is not null or guest_name is not null),
  check ((settled_at is null) = (settled_amount is null))
);

create index if not exists idx_event_tabs_event on public.event_tabs (event_id);

create table if not exists public.event_tab_lines (
  tab_id uuid not null references public.event_tabs(id) on delete cascade,
  item_id uuid not null references public.event_option_items(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99),
  unit_price integer not null check (unit_price >= 0),
  updated_at timestamptz not null default now(),
  primary key (tab_id, item_id)
);

create trigger update_event_tabs_updated_at
  before update on public.event_tabs
  for each row execute function public.update_updated_at_column();

alter table public.event_option_items enable row level security;
alter table public.event_tabs enable row level security;
alter table public.event_tab_lines enable row level security;

create policy "Admins can manage event option items" on public.event_option_items for all
  to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "Admins can manage event tabs" on public.event_tabs for all
  to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "Admins can manage event tab lines" on public.event_tab_lines for all
  to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

insert into public.event_option_items (name, price, sort_order) values
  ('水着', 500, 10),
  ('ポンチョ', 500, 20),
  ('タオル', 500, 30),
  ('サウナハット', 500, 40),
  ('アイスボックス', 250, 50),
  ('おかゆ', 400, 60);

-- ============ 権限チェック ============
-- 管理者なら true、有効なスタッフトークンなら false、どちらでもなければ例外
create or replace function public.event_tab_auth(p_token uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    return true;
  end if;
  if p_token is not null and exists (select 1 from staff_access_tokens where token = p_token) then
    return false;
  end if;
  raise exception 'invalid_token' using errcode = 'P0001';
end;
$$;

-- スタッフが扱えるイベント（今日(JST)の前後1日に有効な枠がある）か
create or replace function public.event_tab_event_in_window(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from event_slots s
    where s.event_id = p_event_id
      and s.date between (now() at time zone 'Asia/Tokyo')::date - 1
                     and (now() at time zone 'Asia/Tokyo')::date + 1
  );
$$;

create or replace function public.event_tab_check_event(p_token uuid, p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := event_tab_auth(p_token);
begin
  if not exists (select 1 from events where id = p_event_id) then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;
  if not v_is_admin and not event_tab_event_in_window(p_event_id) then
    raise exception 'event_not_available' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.event_tab_auth(uuid) from public, anon, authenticated;
revoke all on function public.event_tab_event_in_window(uuid) from public, anon, authenticated;
revoke all on function public.event_tab_check_event(uuid, uuid) from public, anon, authenticated;

-- ============ 画面のデータ ============
-- p_event_id が null なら、選べるイベントの一覧と、その先頭のイベントを返す
create or replace function public.event_tab_board(p_token uuid, p_event_id uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := event_tab_auth(p_token);
  v_event_id uuid := p_event_id;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_events json;
  v_default_id uuid;
begin
  -- 選べるイベント: スタッフは前後1日に枠があるもの。管理者は全部（今日に近い順）
  select json_agg(json_build_object('id', id, 'title', title, 'first_date', first_date) order by dist, first_date desc),
         (array_agg(id order by dist, first_date desc))[1]
  into v_events, v_default_id
  from (
    select e.id, e.title, min(s.date) as first_date, min(abs(s.date - v_today)) as dist
    from events e join event_slots s on s.event_id = e.id
    where v_is_admin or s.date between v_today - 1 and v_today + 1
    group by e.id, e.title
  ) ev;

  if v_event_id is null then
    v_event_id := v_default_id;
  elsif not (v_is_admin or event_tab_event_in_window(v_event_id)) then
    raise exception 'event_not_available' using errcode = 'P0001';
  end if;

  return json_build_object(
    'is_admin', v_is_admin,
    'items', coalesce((
      select json_agg(json_build_object('id', i.id, 'name', i.name, 'price', i.price) order by i.sort_order, i.created_at)
      from event_option_items i where i.active
    ), '[]'::json),
    'events', coalesce(v_events, '[]'::json),
    'event', (
      select json_build_object('id', e.id, 'title', e.title, 'price_per_person', e.price_per_person)
      from events e where e.id = v_event_id
    ),
    'slots', coalesce((
      select json_agg(json_build_object('id', s.id, 'date', s.date, 'start_time', s.start_time, 'end_time', s.end_time)
                      order by s.date, s.start_time)
      from event_slots s where s.event_id = v_event_id
    ), '[]'::json),
    'guests', coalesce((
      select json_agg(g order by g->>'date', g->>'start_time', g->>'created_at')
      from (
        -- 予約のお客さん（確定のみ）+ 会計がまだなくても一覧に出す
        select json_build_object(
          'key', 'r:' || r.id,
          'reservation_id', r.id,
          'tab_id', t.id,
          'guest_name', r.guest_name,
          'guest_count', r.guest_count,
          'reservation_code', r.reservation_code,
          'payment_status', r.payment_status,
          'payment_method', r.payment_method,
          'total_price', r.total_price,
          'slot_id', s.id,
          'date', s.date,
          'start_time', s.start_time,
          'end_time', s.end_time,
          'created_at', r.created_at,
          'settled_at', t.settled_at,
          'settled_amount', t.settled_amount,
          'lines', coalesce((
            select json_agg(json_build_object('item_id', l.item_id, 'quantity', l.quantity, 'unit_price', l.unit_price))
            from event_tab_lines l where l.tab_id = t.id
          ), '[]'::json)
        ) as g
        from event_reservations r
        join event_slots s on s.id = r.slot_id
        left join event_tabs t on t.event_reservation_id = r.id
        where s.event_id = v_event_id and r.status = 'confirmed'
        union all
        -- 当日飛び込み
        select json_build_object(
          'key', 't:' || t.id,
          'reservation_id', null,
          'tab_id', t.id,
          'guest_name', t.guest_name,
          'guest_count', t.guest_count,
          'reservation_code', null,
          'payment_status', null,
          'payment_method', null,
          'total_price', null,
          'slot_id', s.id,
          'date', s.date,
          'start_time', s.start_time,
          'end_time', s.end_time,
          'created_at', t.created_at,
          'settled_at', t.settled_at,
          'settled_amount', t.settled_amount,
          'lines', coalesce((
            select json_agg(json_build_object('item_id', l.item_id, 'quantity', l.quantity, 'unit_price', l.unit_price))
            from event_tab_lines l where l.tab_id = t.id
          ), '[]'::json)
        ) as g
        from event_tabs t
        left join event_slots s on s.id = t.slot_id
        where t.event_id = v_event_id and t.event_reservation_id is null
      ) sub
    ), '[]'::json)
  );
end;
$$;

-- ============ 操作 ============
-- 飛び込みのお客さんを追加
create or replace function public.event_tab_create_walkin(
  p_token uuid, p_event_id uuid, p_slot_id uuid, p_guest_name text, p_guest_count integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform event_tab_check_event(p_token, p_event_id);
  if p_slot_id is not null and not exists (select 1 from event_slots where id = p_slot_id and event_id = p_event_id) then
    raise exception 'slot_not_found' using errcode = 'P0001';
  end if;
  insert into event_tabs (event_id, guest_name, guest_count, slot_id)
  values (p_event_id, nullif(btrim(p_guest_name), ''), p_guest_count, p_slot_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- 品目の個数を増減（2台のスマホで同時に押しても数がずれないよう差分で受ける）。
-- 予約のお客さんは最初の追加で会計を作る。戻り値は会計の id
create or replace function public.event_tab_add_item(
  p_token uuid, p_tab_id uuid, p_reservation_id uuid, p_item_id uuid, p_delta integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tab event_tabs%rowtype;
  v_event_id uuid;
  v_price integer;
  v_qty integer;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 99 then
    raise exception 'invalid_delta' using errcode = 'P0001';
  end if;

  if p_tab_id is not null then
    select * into v_tab from event_tabs where id = p_tab_id for update;
    if not found then raise exception 'tab_not_found' using errcode = 'P0001'; end if;
  elsif p_reservation_id is not null then
    select s.event_id into v_event_id
    from event_reservations r join event_slots s on s.id = r.slot_id
    where r.id = p_reservation_id and r.status = 'confirmed';
    if v_event_id is null then raise exception 'reservation_not_found' using errcode = 'P0001'; end if;
    perform event_tab_check_event(p_token, v_event_id);
    insert into event_tabs (event_id, event_reservation_id) values (v_event_id, p_reservation_id)
    on conflict (event_reservation_id) do nothing;
    select * into v_tab from event_tabs where event_reservation_id = p_reservation_id for update;
  else
    raise exception 'tab_not_found' using errcode = 'P0001';
  end if;

  perform event_tab_check_event(p_token, v_tab.event_id);
  if v_tab.settled_at is not null then
    raise exception 'tab_settled' using errcode = 'P0001';
  end if;

  select quantity into v_qty from event_tab_lines where tab_id = v_tab.id and item_id = p_item_id for update;
  if v_qty is null then
    if p_delta < 0 then return v_tab.id; end if;
    select price into v_price from event_option_items where id = p_item_id and active;
    if v_price is null then raise exception 'item_not_found' using errcode = 'P0001'; end if;
    insert into event_tab_lines (tab_id, item_id, quantity, unit_price) values (v_tab.id, p_item_id, least(p_delta, 99), v_price);
  elsif v_qty + p_delta <= 0 then
    delete from event_tab_lines where tab_id = v_tab.id and item_id = p_item_id;
  else
    update event_tab_lines set quantity = least(v_qty + p_delta, 99), updated_at = now()
    where tab_id = v_tab.id and item_id = p_item_id;
  end if;
  return v_tab.id;
end;
$$;

-- 精算済みにする / 取り消す。精算済みにしたときの合計を settled_amount に残す
create or replace function public.event_tab_settle(p_token uuid, p_tab_id uuid, p_settled boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tab event_tabs%rowtype;
  v_total integer;
begin
  select * into v_tab from event_tabs where id = p_tab_id for update;
  if not found then raise exception 'tab_not_found' using errcode = 'P0001'; end if;
  perform event_tab_check_event(p_token, v_tab.event_id);

  if p_settled then
    select coalesce(sum(quantity * unit_price), 0) into v_total from event_tab_lines where tab_id = p_tab_id;
    update event_tabs set settled_at = now(), settled_amount = v_total where id = p_tab_id;
    return v_total;
  end if;
  update event_tabs set settled_at = null, settled_amount = null where id = p_tab_id;
  return null;
end;
$$;

-- 飛び込みのお客さんを削除（精算済みは不可）
create or replace function public.event_tab_delete_walkin(p_token uuid, p_tab_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tab event_tabs%rowtype;
begin
  select * into v_tab from event_tabs where id = p_tab_id for update;
  if not found or v_tab.event_reservation_id is not null then
    raise exception 'tab_not_found' using errcode = 'P0001';
  end if;
  perform event_tab_check_event(p_token, v_tab.event_id);
  if v_tab.settled_at is not null then
    raise exception 'tab_settled' using errcode = 'P0001';
  end if;
  delete from event_tabs where id = p_tab_id;
end;
$$;

revoke all on function public.event_tab_board(uuid, uuid) from public;
revoke all on function public.event_tab_create_walkin(uuid, uuid, uuid, text, integer) from public;
revoke all on function public.event_tab_add_item(uuid, uuid, uuid, uuid, integer) from public;
revoke all on function public.event_tab_settle(uuid, uuid, boolean) from public;
revoke all on function public.event_tab_delete_walkin(uuid, uuid) from public;
grant execute on function public.event_tab_board(uuid, uuid) to anon, authenticated;
grant execute on function public.event_tab_create_walkin(uuid, uuid, uuid, text, integer) to anon, authenticated;
grant execute on function public.event_tab_add_item(uuid, uuid, uuid, uuid, integer) to anon, authenticated;
grant execute on function public.event_tab_settle(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.event_tab_delete_walkin(uuid, uuid) to anon, authenticated;
