-- 作業管理（清掃・メンテナンス・営業）
--   work_areas      作業場（脱衣棟 / 洗濯 / サウナエリア / 庭 / 受付 / 民泊）
--   work_items      作業場ごとの作業項目。頻度の目安・数量入力・写真必須を持つ
--   work_tasks      作業場に登録された個別タスク（不具合対応・依頼など）。完了はログで記録
--   work_logs       作業ログ（誰が・いつ・どこで・何を）。項目の実施記録 or タスクの完了記録
--   work_log_photos ログの写真（storage: work-photos/<token>/<uuid>.jpg）
--   work_point_settings ポイント→ボーナスの設定（1行）
-- ポイント: ログ記録時に項目/タスクのポイントを work_logs.points に保存する。管理者が否認(rejected)したログは 0pt 扱い。
-- 同じスタッフが同じ日(JST)に同じ項目を記録できるのは1回だけ(repeatable な項目を除く。部分ユニークインデックスで保証)。
-- ボーナス: 月のポイントが「勤務時間 × 目安pt/時間」を超えた分 × 円/pt（上限あり）。
-- スタッフはログインせず、staff_access_tokens のトークン付き URL から security definer 関数経由で操作する。

create table if not exists public.staff_access_tokens (
  staff_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.work_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.work_areas(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'cleaning',
  -- 実施頻度の目安（日）。null = 目安なし
  frequency_days integer,
  -- 完了時に数量を入力させる場合のラベルと単位（例: 乾燥・畳んだ量 / 枚）
  quantity_label text,
  quantity_unit text,
  photo_required boolean not null default false,
  points integer not null default 1,
  -- true なら同じスタッフが同じ日に何度でも記録・加点できる（洗濯など）
  repeatable boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint work_items_points_check check (points >= 0),
  constraint work_items_category_check check (category in ('cleaning', 'maintenance', 'operation')),
  constraint work_items_frequency_check check (frequency_days is null or frequency_days > 0)
);

create index if not exists work_items_area_idx on public.work_items (area_id, sort_order);

create table if not exists public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.work_areas(id) on delete cascade,
  item_id uuid references public.work_items(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'cleaning',
  status text not null default 'open',
  due_date date,
  points integer not null default 1,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  constraint work_tasks_category_check check (category in ('cleaning', 'maintenance', 'operation')),
  constraint work_tasks_status_check check (status in ('open', 'done', 'cancelled'))
);

create index if not exists work_tasks_open_idx on public.work_tasks (area_id) where status = 'open';

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.work_areas(id) on delete restrict,
  item_id uuid references public.work_items(id) on delete set null,
  task_id uuid references public.work_tasks(id) on delete set null,
  -- 記録時点の作業名・区分（項目やタスクが後で変わってもログは変えない）
  title text not null,
  category text not null,
  staff_id uuid not null references public.profiles(id) on delete restrict,
  worked_at timestamptz not null default now(),
  work_date date not null default (now() at time zone 'Asia/Tokyo')::date,
  quantity numeric,
  quantity_unit text,
  note text,
  points integer not null default 0,
  rejected boolean not null default false,
  -- 記録時点で「1人1日1回」の項目だったか（項目の repeatable が後で変わっても既存ログに影響させない）
  once_per_day boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists work_logs_date_idx on public.work_logs (work_date desc);
create index if not exists work_logs_staff_idx on public.work_logs (staff_id, work_date desc);
create index if not exists work_logs_area_idx on public.work_logs (area_id, work_date desc);
create index if not exists work_logs_item_idx on public.work_logs (item_id, worked_at desc);
create unique index if not exists work_logs_once_per_day_unique
  on public.work_logs (work_date, staff_id, item_id) where once_per_day;

create table if not exists public.work_log_photos (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.work_logs(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists work_log_photos_log_idx on public.work_log_photos (log_id);

create table if not exists public.work_point_settings (
  id boolean primary key default true,
  target_points_per_hour numeric not null default 2,
  yen_per_point integer not null default 50,
  monthly_bonus_cap integer not null default 10000,
  updated_at timestamptz not null default now(),
  constraint work_point_settings_singleton check (id)
);

insert into public.work_point_settings (id) values (true) on conflict (id) do nothing;

-- RLS: 管理者のみ直接操作
alter table public.staff_access_tokens enable row level security;
alter table public.work_areas enable row level security;
alter table public.work_items enable row level security;
alter table public.work_tasks enable row level security;
alter table public.work_logs enable row level security;
alter table public.work_log_photos enable row level security;
alter table public.work_point_settings enable row level security;

create policy "Admins can manage staff access tokens" on public.staff_access_tokens for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Admins can manage work areas" on public.work_areas for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Admins can manage work items" on public.work_items for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Admins can manage work tasks" on public.work_tasks for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Admins can manage work logs" on public.work_logs for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Admins can manage work log photos" on public.work_log_photos for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "Admins can manage work point settings" on public.work_point_settings for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- 作業項目ごとの最終実施（管理画面の状況表示用）
create or replace view public.work_item_last_logs
with (security_invoker = true) as
select distinct on (l.item_id)
  l.item_id,
  l.worked_at,
  p.username as staff_name
from public.work_logs l
join public.profiles p on p.id = l.staff_id
where l.item_id is not null
order by l.item_id, l.worked_at desc;

-- 月ごとのポイントとボーナス。勤務時間は予定どおりのシフトのうち開始済みのもの(休憩を除く)
create or replace function public.work_bonus_summary_internal(p_year integer, p_month integer)
returns table (
  staff_id uuid,
  staff_name text,
  points bigint,
  log_count bigint,
  work_hours numeric,
  target_points numeric,
  bonus_yen integer
)
language sql
stable
security definer
set search_path = public
as $$
  with range as (
    select make_date(p_year, p_month, 1) as from_date,
           (make_date(p_year, p_month, 1) + interval '1 month')::date as to_date
  ),
  settings as (select * from work_point_settings where id),
  pts as (
    select l.staff_id, sum(case when l.rejected then 0 else l.points end) as points, count(*) as log_count
    from work_logs l, range r
    where l.work_date >= r.from_date and l.work_date < r.to_date
    group by l.staff_id
  ),
  hrs as (
    select s.staff_id,
           sum(extract(epoch from s.end_time - s.start_time) / 3600.0 - coalesce(s.break_minutes, 0) / 60.0) as hours
    from shifts s, range r
    where s.status = 'scheduled'
      and (s.start_time at time zone 'Asia/Tokyo')::date >= r.from_date
      and (s.start_time at time zone 'Asia/Tokyo')::date < r.to_date
      and s.start_time <= now()
    group by s.staff_id
  )
  select p.id,
         p.username,
         coalesce(pts.points, 0),
         coalesce(pts.log_count, 0),
         round(coalesce(hrs.hours, 0)::numeric, 2),
         round(coalesce(hrs.hours, 0)::numeric * st.target_points_per_hour, 1),
         least(
           st.monthly_bonus_cap,
           greatest(0, floor(coalesce(pts.points, 0) - coalesce(hrs.hours, 0)::numeric * st.target_points_per_hour))::integer
             * st.yen_per_point
         )
  from profiles p
  cross join settings st
  left join pts on pts.staff_id = p.id
  left join hrs on hrs.staff_id = p.id
  where p.role in ('staff', 'admin') and (pts.staff_id is not null or hrs.staff_id is not null);
$$;

revoke all on function public.work_bonus_summary_internal(integer, integer) from public, anon, authenticated;

-- 管理者用
create or replace function public.work_bonus_summary(p_year integer, p_month integer)
returns table (
  staff_id uuid,
  staff_name text,
  points bigint,
  log_count bigint,
  work_hours numeric,
  target_points numeric,
  bonus_yen integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return query select * from work_bonus_summary_internal(p_year, p_month);
end;
$$;

revoke all on function public.work_bonus_summary(integer, integer) from public, anon;
grant execute on function public.work_bonus_summary(integer, integer) to authenticated;

-- 写真: 非公開バケット。スタッフは自分のトークンのフォルダにだけアップロードでき、閲覧は管理者のみ
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('work-photos', 'work-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create or replace function public.staff_id_for_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select staff_id from staff_access_tokens where token::text = p_token;
$$;

revoke all on function public.staff_id_for_token(text) from public;
grant execute on function public.staff_id_for_token(text) to anon, authenticated;

create policy "Staff can upload work photos with token" on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'work-photos'
    and public.staff_id_for_token((storage.foldername(name))[1]) is not null
  );

create policy "Admins can view work photos" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'work-photos'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

-- スタッフ用: 作業場・項目(最終実施つき)・未完了タスク・今日の自分の記録
create or replace function public.staff_work_get(p_token uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_name text;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select a.staff_id, p.username into v_staff_id, v_name
  from staff_access_tokens a join profiles p on p.id = a.staff_id
  where a.token = p_token;
  if v_staff_id is null then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;

  return json_build_object(
    'staff', json_build_object('id', v_staff_id, 'name', v_name),
    'areas', coalesce((
      select json_agg(json_build_object(
        'id', a.id,
        'name', a.name,
        'items', coalesce((
          select json_agg(json_build_object(
            'id', i.id,
            'name', i.name,
            'description', i.description,
            'category', i.category,
            'frequency_days', i.frequency_days,
            'quantity_label', i.quantity_label,
            'quantity_unit', i.quantity_unit,
            'photo_required', i.photo_required,
            'points', i.points,
            'repeatable', i.repeatable,
            -- 自分の今日の記録（件数と最新の1件）。他の人の記録は last_* で見せる
            'my_today_count', (
              select count(*) from work_logs dl
              where dl.item_id = i.id and dl.task_id is null and dl.work_date = v_today and dl.staff_id = v_staff_id
            ),
            'my_today_log', (
              select json_build_object(
                'id', ml.id,
                'worked_at', ml.worked_at,
                'quantity', ml.quantity,
                'quantity_unit', ml.quantity_unit,
                'note', ml.note,
                'points', case when ml.rejected then 0 else ml.points end,
                'photo_count', (select count(*) from work_log_photos ph where ph.log_id = ml.id)
              )
              from work_logs ml
              where ml.item_id = i.id and ml.task_id is null and ml.work_date = v_today and ml.staff_id = v_staff_id
              order by ml.worked_at desc
              limit 1
            ),
            'last_worked_at', last.worked_at,
            'last_staff_name', last.username
          ) order by i.sort_order, i.created_at)
          from work_items i
          left join lateral (
            select l.worked_at, lp.username
            from work_logs l join profiles lp on lp.id = l.staff_id
            where l.item_id = i.id
            order by l.worked_at desc
            limit 1
          ) last on true
          where i.area_id = a.id and i.active
        ), '[]'::json),
        'tasks', coalesce((
          select json_agg(json_build_object(
            'id', t.id,
            'item_id', t.item_id,
            'title', t.title,
            'description', t.description,
            'category', t.category,
            'due_date', t.due_date,
            'points', t.points,
            'assignee_id', t.assignee_id,
            'assignee_name', ap.username,
            'created_by_name', cp.username,
            'created_at', t.created_at
          ) order by t.due_date nulls last, t.created_at)
          from work_tasks t
          left join profiles ap on ap.id = t.assignee_id
          left join profiles cp on cp.id = t.created_by
          where t.area_id = a.id and t.status = 'open'
        ), '[]'::json)
      ) order by a.sort_order, a.created_at)
      from work_areas a
      where a.active
    ), '[]'::json),
    'my_logs_today', coalesce((
      select json_agg(json_build_object(
        'id', l.id,
        'area_name', a.name,
        'title', l.title,
        'worked_at', l.worked_at,
        'quantity', l.quantity,
        'quantity_unit', l.quantity_unit,
        'note', l.note,
        'points', case when l.rejected then 0 else l.points end,
        'photo_count', (select count(*) from work_log_photos ph where ph.log_id = l.id)
      ) order by l.worked_at desc)
      from work_logs l join work_areas a on a.id = l.area_id
      where l.staff_id = v_staff_id and l.work_date = v_today
    ), '[]'::json),
    'score', (
      select json_build_object(
        'month_points', b.points,
        'today_points', (
          select coalesce(sum(points), 0) from work_logs
          where staff_id = v_staff_id and work_date = v_today and not rejected
        ),
        'work_hours', b.work_hours,
        'target_points', b.target_points,
        'bonus_yen', b.bonus_yen,
        'yen_per_point', st.yen_per_point,
        'monthly_bonus_cap', st.monthly_bonus_cap,
        'streak_days', (
          -- 今日(未記録なら昨日)から遡って、記録が途切れずに続いている日数
          select count(*) from (
            select d, row_number() over (order by d desc) as rn
            from (select distinct work_date as d from work_logs where staff_id = v_staff_id) days
          ) x
          where x.d = (
            select max(work_date) from work_logs
            where staff_id = v_staff_id and work_date >= v_today - 1
          ) - (x.rn - 1)::integer
        )
      )
      from work_point_settings st
      left join work_bonus_summary_internal(
        extract(year from v_today)::integer, extract(month from v_today)::integer
      ) b on b.staff_id = v_staff_id
      where st.id
    )
  );
end;
$$;

-- スタッフ用: 作業ログを記録する。項目の実施(p_item_id) / タスクの完了(p_task_id) / どちらもなし(p_title で自由記録)
create or replace function public.staff_work_log_create(
  p_token uuid,
  p_area_id uuid,
  p_item_id uuid,
  p_task_id uuid,
  p_title text,
  p_quantity numeric,
  p_note text,
  p_photo_paths text[]
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_item work_items%rowtype;
  v_task work_tasks%rowtype;
  v_title text;
  v_category text := 'cleaning';
  v_log_id uuid;
  v_path text;
  v_points integer := 0;
  v_once boolean := false;
begin
  select staff_id into v_staff_id from staff_access_tokens where token = p_token;
  if v_staff_id is null then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;

  if p_task_id is not null then
    select * into v_task from work_tasks where id = p_task_id and area_id = p_area_id and status = 'open';
    if not found then
      raise exception 'task_not_found' using errcode = 'P0001';
    end if;
    v_title := v_task.title;
    v_category := v_task.category;
    v_points := v_task.points;
    if v_task.item_id is not null then
      select * into v_item from work_items where id = v_task.item_id;
    end if;
  elsif p_item_id is not null then
    select * into v_item from work_items where id = p_item_id and area_id = p_area_id and active;
    if not found then
      raise exception 'item_not_found' using errcode = 'P0001';
    end if;
    v_title := v_item.name;
    v_category := v_item.category;
    v_points := v_item.points;
    v_once := not v_item.repeatable;
  else
    v_title := nullif(trim(p_title), '');
    if v_title is null or not exists (select 1 from work_areas where id = p_area_id) then
      raise exception 'invalid_log' using errcode = 'P0001';
    end if;
  end if;

  if p_item_id is not null and v_item.photo_required and coalesce(array_length(p_photo_paths, 1), 0) = 0 then
    raise exception 'photo_required' using errcode = 'P0001';
  end if;

  begin
    insert into work_logs (area_id, item_id, task_id, title, category, staff_id, quantity, quantity_unit, note, points, once_per_day)
    values (p_area_id, v_item.id, p_task_id, v_title, v_category, v_staff_id,
            p_quantity, case when p_quantity is not null then v_item.quantity_unit end,
            nullif(trim(p_note), ''), v_points, v_once)
    returning id into v_log_id;
  exception when unique_violation then
    raise exception 'already_recorded' using errcode = 'P0001';
  end;

  -- 写真は自分のトークンのフォルダにあるものだけ紐付ける
  foreach v_path in array coalesce(p_photo_paths, '{}') loop
    if v_path not like p_token::text || '/%' then
      raise exception 'invalid_photo_path' using errcode = 'P0001';
    end if;
    insert into work_log_photos (log_id, storage_path) values (v_log_id, v_path);
  end loop;

  if p_task_id is not null then
    update work_tasks set status = 'done', done_at = now() where id = p_task_id;
  end if;

  return json_build_object('log_id', v_log_id, 'points', v_points);
end;
$$;

-- スタッフ用: 今日の自分の記録を取り消す（タスク完了なら未完了に戻す）
create or replace function public.staff_work_log_delete(p_token uuid, p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_task_id uuid;
begin
  select staff_id into v_staff_id from staff_access_tokens where token = p_token;
  if v_staff_id is null then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;

  delete from work_logs
  where id = p_log_id
    and staff_id = v_staff_id
    and work_date = (now() at time zone 'Asia/Tokyo')::date
  returning task_id into v_task_id;
  if not found then
    raise exception 'log_not_found' using errcode = 'P0001';
  end if;

  if v_task_id is not null then
    update work_tasks set status = 'open', done_at = null where id = v_task_id;
  end if;
end;
$$;

-- スタッフ用: 作業場にタスクを登録する（不具合・後でやること）
create or replace function public.staff_work_task_create(
  p_token uuid,
  p_area_id uuid,
  p_item_id uuid,
  p_title text,
  p_description text,
  p_category text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_id uuid;
begin
  select staff_id into v_staff_id from staff_access_tokens where token = p_token;
  if v_staff_id is null then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'title_required' using errcode = 'P0001';
  end if;
  if p_item_id is not null and not exists (select 1 from work_items where id = p_item_id and area_id = p_area_id) then
    raise exception 'item_not_found' using errcode = 'P0001';
  end if;

  insert into work_tasks (area_id, item_id, title, description, category, created_by)
  values (p_area_id, p_item_id, trim(p_title), nullif(trim(p_description), ''), p_category, v_staff_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.staff_work_get(uuid) from public;
revoke all on function public.staff_work_log_create(uuid, uuid, uuid, uuid, text, numeric, text, text[]) from public;
revoke all on function public.staff_work_log_delete(uuid, uuid) from public;
revoke all on function public.staff_work_task_create(uuid, uuid, uuid, text, text, text) from public;
grant execute on function public.staff_work_get(uuid) to anon, authenticated;
grant execute on function public.staff_work_log_create(uuid, uuid, uuid, uuid, text, numeric, text, text[]) to anon, authenticated;
grant execute on function public.staff_work_log_delete(uuid, uuid) to anon, authenticated;
grant execute on function public.staff_work_task_create(uuid, uuid, uuid, text, text, text) to anon, authenticated;

-- 初期マスタ
do $$
declare
  v_area uuid;
begin
  if exists (select 1 from work_areas) then
    return;
  end if;

  insert into work_areas (name, sort_order) values ('脱衣棟', 1) returning id into v_area;
  insert into work_items (area_id, name, category, sort_order) values
    (v_area, 'シャワー室1', 'cleaning', 1),
    (v_area, 'シャワー室2', 'cleaning', 2),
    (v_area, '洗面台', 'cleaning', 3),
    (v_area, '洗面台アメニティ補充', 'cleaning', 4),
    (v_area, '鏡', 'cleaning', 5),
    (v_area, 'ゴミ袋補充', 'cleaning', 6),
    (v_area, 'サンダル清掃', 'cleaning', 7),
    (v_area, '清掃用品の補充', 'cleaning', 8);

  insert into work_areas (name, sort_order) values ('洗濯', 2) returning id into v_area;
  insert into work_items (area_id, name, category, quantity_label, quantity_unit, repeatable, sort_order) values
    (v_area, '洗濯業務', 'cleaning', '乾燥・畳んだ量', '枚', true, 1);
  insert into work_items (area_id, name, category, sort_order) values
    (v_area, '洗濯用洗剤補充', 'cleaning', 2);

  insert into work_areas (name, sort_order) values ('サウナエリア', 3) returning id into v_area;
  insert into work_items (area_id, name, category, sort_order) values
    (v_area, 'ウッドデッキ清掃', 'cleaning', 1),
    (v_area, '水風呂清掃', 'cleaning', 2),
    (v_area, '風呂清掃', 'cleaning', 3),
    (v_area, 'ストーブ煙突清掃', 'maintenance', 4),
    (v_area, 'サウナ室内椅子清掃', 'cleaning', 5),
    (v_area, 'チラーフィルター交換', 'maintenance', 6),
    (v_area, 'チラー清掃', 'maintenance', 7);

  insert into work_areas (name, sort_order) values ('庭', 4) returning id into v_area;
  insert into work_items (area_id, name, category, sort_order) values
    (v_area, '落ち葉清掃（1F）', 'cleaning', 1),
    (v_area, '落ち葉清掃（駐車エリア）', 'cleaning', 2),
    (v_area, '落ち葉清掃（階段エリア）', 'cleaning', 3),
    (v_area, '草刈り', 'maintenance', 4);

  update work_items set points = 3 where category = 'maintenance';

  insert into work_areas (name, sort_order) values ('受付', 5);
  insert into work_areas (name, sort_order, active) values ('民泊', 6, false);
end $$;
