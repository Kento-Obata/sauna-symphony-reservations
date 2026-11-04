-- ハーブ蒸しのブレンド選択
--   herbs             ハーブ（名前・ノート top/middle/base・有効）
--   herb_blends       ブレンド（番号・見出し・説明・注意書き・ORIGINAL か・仕込みが要るか・有効）
--   herb_blend_herbs  ブレンドの構成ハーブ
--   herb_settings     おすすめの組み合わせ（1段目・2段目）。1行だけ
--
-- 予約には選び方(herb_choice)と、予約時点の中身(herb_selection)をスナップショットで保存する。
-- マスタを後から編集・無効化しても、既存の予約の表示は変わらない。
--   herb_choice: select(事前に選ぶ) / recommended(おすすめ) / consult(当日スタッフと一緒に選ぶ)
--                null = この機能より前の予約
--   herb_selection: {"tiers":[{tier, blend_id, code, title, is_original, needs_prep, caution, herbs:[{id,name,note}]}, ...]}
--                   consult はスタッフが受付で確定内容を入れるまで null
--
-- ブレンドが選べるのは「有効」かつ「構成ハーブがすべて有効」のときだけ（ハーブの在庫切れを自動で反映する）。
-- 予約・変更時の検証とスナップショット作成は build_herb_selection() に集約し、Edge Function / 管理画面の両方から使う。

create table if not exists public.herbs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint herbs_note_check check (note in ('top', 'middle', 'base'))
);

create table if not exists public.herb_blends (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  -- 予約画面に添える注意書き（例: 作成にお時間をいただきます）
  caution text,
  -- true: 構成を持たず、お客様がハーブを 1〜3 種選ぶ（07 ORIGINAL）
  is_original boolean not null default false,
  -- true: 仕込みに手間がかかる。仕込みリストで目立たせる
  needs_prep boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.herb_blend_herbs (
  blend_id uuid not null references public.herb_blends(id) on delete cascade,
  herb_id uuid not null references public.herbs(id) on delete restrict,
  sort_order integer not null default 0,
  primary key (blend_id, herb_id)
);

create table if not exists public.herb_settings (
  id boolean primary key default true,
  recommended_tier1_blend_id uuid references public.herb_blends(id) on delete set null,
  recommended_tier2_blend_id uuid references public.herb_blends(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint herb_settings_singleton check (id)
);

insert into public.herb_settings (id) values (true) on conflict (id) do nothing;

alter table public.reservations
  add column if not exists herb_choice text,
  add column if not exists herb_selection jsonb,
  add column if not exists herb_updated_at timestamptz,
  add column if not exists herb_updated_by text;

alter table public.reservations drop constraint if exists reservations_herb_choice_check;
alter table public.reservations add constraint reservations_herb_choice_check
  check (herb_choice is null or herb_choice in ('select', 'recommended', 'consult'));
alter table public.reservations drop constraint if exists reservations_herb_updated_by_check;
alter table public.reservations add constraint reservations_herb_updated_by_check
  check (herb_updated_by is null or herb_updated_by in ('customer', 'staff'));

-- RLS: マスタは誰でも読める（予約画面に出す内容）。編集は管理者のみ
alter table public.herbs enable row level security;
alter table public.herb_blends enable row level security;
alter table public.herb_blend_herbs enable row level security;
alter table public.herb_settings enable row level security;

create policy "Anyone can view herbs" on public.herbs for select using (true);
create policy "Admins can manage herbs" on public.herbs for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Anyone can view herb blends" on public.herb_blends for select using (true);
create policy "Admins can manage herb blends" on public.herb_blends for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Anyone can view herb blend herbs" on public.herb_blend_herbs for select using (true);
create policy "Admins can manage herb blend herbs" on public.herb_blend_herbs for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Anyone can view herb settings" on public.herb_settings for select using (true);
create policy "Admins can manage herb settings" on public.herb_settings for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- ブレンドが今選べるか（有効かつ構成ハーブがすべて有効。ORIGINAL は有効なハーブが1つ以上あること）
create or replace function public.herb_blend_available(p_blend_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from herb_blends b
    where b.id = p_blend_id
      and b.active
      and not exists (
        select 1 from herb_blend_herbs bh join herbs h on h.id = bh.herb_id
        where bh.blend_id = b.id and not h.active
      )
      and (not b.is_original or exists (select 1 from herbs h where h.active))
  );
$$;

-- 1段分のスナップショット。選べないブレンド・不正な ORIGINAL の指定は例外にする
create or replace function public.herb_tier_snapshot(p_tier integer, p_blend_id uuid, p_herb_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_blend herb_blends%rowtype;
  v_herbs jsonb;
  v_count integer := coalesce(array_length(p_herb_ids, 1), 0);
begin
  select * into v_blend from herb_blends where id = p_blend_id;
  if not found or not herb_blend_available(p_blend_id) then
    raise exception 'herb_blend_unavailable' using errcode = 'P0001';
  end if;

  if v_blend.is_original then
    -- 1〜3 種、重複なし、すべて有効なハーブ
    if v_count not between 1 and 3
       or (select count(distinct x) from unnest(p_herb_ids) x) <> v_count then
      raise exception 'herb_original_invalid' using errcode = 'P0001';
    end if;
    select jsonb_agg(
             jsonb_build_object('id', h.id, 'name', h.name, 'note', h.note)
             order by case h.note when 'top' then 0 when 'middle' then 1 else 2 end, h.sort_order, h.name
           )
      into v_herbs
    from herbs h
    where h.id = any (p_herb_ids) and h.active;
    if coalesce(jsonb_array_length(v_herbs), 0) <> v_count then
      raise exception 'herb_original_invalid' using errcode = 'P0001';
    end if;
  else
    select coalesce(jsonb_agg(
             jsonb_build_object('id', h.id, 'name', h.name, 'note', h.note)
             order by bh.sort_order, h.sort_order
           ), '[]'::jsonb)
      into v_herbs
    from herb_blend_herbs bh
    join herbs h on h.id = bh.herb_id
    where bh.blend_id = p_blend_id;
  end if;

  return jsonb_build_object(
    'tier', p_tier,
    'blend_id', v_blend.id,
    'code', v_blend.code,
    'title', v_blend.title,
    'is_original', v_blend.is_original,
    'needs_prep', v_blend.needs_prep,
    'caution', v_blend.caution,
    'herbs', v_herbs
  );
end;
$$;

-- 選び方と入力から、予約に保存するスナップショットを作る。
--   p_tiers: [{"tier":1,"blend_id":"...","herb_ids":["..."]}, {"tier":2,...}]（select のとき必須）
--   p_allow_consult_tiers: true なら consult でも p_tiers を確定内容として保存する（受付でのスタッフ入力）
create or replace function public.build_herb_selection(
  p_choice text,
  p_tiers jsonb,
  p_allow_consult_tiers boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings herb_settings%rowtype;
  v_t1 jsonb;
  v_t2 jsonb;
begin
  if p_choice = 'recommended' then
    select * into v_settings from herb_settings where id;
    if v_settings.recommended_tier1_blend_id is null
       or v_settings.recommended_tier2_blend_id is null
       or not herb_blend_available(v_settings.recommended_tier1_blend_id)
       or not herb_blend_available(v_settings.recommended_tier2_blend_id)
       or exists (
         select 1 from herb_blends b
         where b.id in (v_settings.recommended_tier1_blend_id, v_settings.recommended_tier2_blend_id)
           and b.is_original
       ) then
      raise exception 'herb_recommended_unavailable' using errcode = 'P0001';
    end if;
    -- 予約時点のおすすめを保存する（後からおすすめ設定を変えても既存の予約は変わらない）
    return jsonb_build_object('tiers', jsonb_build_array(
      herb_tier_snapshot(1, v_settings.recommended_tier1_blend_id, null),
      herb_tier_snapshot(2, v_settings.recommended_tier2_blend_id, null)
    ));
  elsif p_choice = 'select' or (p_choice = 'consult' and p_allow_consult_tiers and p_tiers is not null
                                 and jsonb_typeof(p_tiers) = 'array' and jsonb_array_length(p_tiers) > 0) then
    if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' then
      raise exception 'herb_tiers_required' using errcode = 'P0001';
    end if;
    select t into v_t1 from jsonb_array_elements(p_tiers) t where t->>'tier' = '1' limit 1;
    select t into v_t2 from jsonb_array_elements(p_tiers) t where t->>'tier' = '2' limit 1;
    if v_t1 is null or v_t2 is null or v_t1->>'blend_id' is null or v_t2->>'blend_id' is null then
      raise exception 'herb_tiers_required' using errcode = 'P0001';
    end if;
    return jsonb_build_object('tiers', jsonb_build_array(
      herb_tier_snapshot(
        1, (v_t1->>'blend_id')::uuid,
        array(select jsonb_array_elements_text(coalesce(v_t1->'herb_ids', '[]'::jsonb))::uuid)
      ),
      herb_tier_snapshot(
        2, (v_t2->>'blend_id')::uuid,
        array(select jsonb_array_elements_text(coalesce(v_t2->'herb_ids', '[]'::jsonb))::uuid)
      )
    ));
  elsif p_choice = 'consult' then
    return null;
  else
    raise exception 'herb_choice_invalid' using errcode = 'P0001';
  end if;
end;
$$;

-- 予約画面用: 有効なハーブ・ブレンド（選べるか付き）・おすすめ
create or replace function public.get_herb_catalog()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'herbs', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', h.id, 'name', h.name, 'note', h.note)
               order by case h.note when 'top' then 0 when 'middle' then 1 else 2 end, h.sort_order, h.name
             )
      from herbs h
      where h.active
    ), '[]'::jsonb),
    'blends', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id,
               'code', b.code,
               'title', b.title,
               'description', b.description,
               'caution', b.caution,
               'is_original', b.is_original,
               'needs_prep', b.needs_prep,
               'available', herb_blend_available(b.id),
               'herbs', coalesce((
                 select jsonb_agg(
                          jsonb_build_object('id', h.id, 'name', h.name, 'note', h.note)
                          order by bh.sort_order, h.sort_order
                        )
                 from herb_blend_herbs bh
                 join herbs h on h.id = bh.herb_id
                 where bh.blend_id = b.id
               ), '[]'::jsonb)
             ) order by b.sort_order, b.code)
      from herb_blends b
      where b.active
    ), '[]'::jsonb),
    'recommended', (
      select jsonb_build_object(
               'tier1_blend_id', s.recommended_tier1_blend_id,
               'tier2_blend_id', s.recommended_tier2_blend_id,
               'available',
                 s.recommended_tier1_blend_id is not null
                 and s.recommended_tier2_blend_id is not null
                 and herb_blend_available(s.recommended_tier1_blend_id)
                 and herb_blend_available(s.recommended_tier2_blend_id)
                 and not exists (
                   select 1 from herb_blends x
                   where x.id in (s.recommended_tier1_blend_id, s.recommended_tier2_blend_id)
                     and x.is_original
                 )
             )
      from herb_settings s
      where s.id
    )
  );
$$;

-- 管理画面・受付用: 予約のハーブを設定する（締切なし。当日の確定内容の入力にも使う）
create or replace function public.admin_set_reservation_herbs(
  p_reservation_id uuid,
  p_choice text,
  p_tiers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_selection jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'staff')) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  v_selection := build_herb_selection(p_choice, p_tiers, true);

  update reservations
  set herb_choice = p_choice,
      herb_selection = v_selection,
      herb_updated_at = now(),
      herb_updated_by = 'staff'
  where id = p_reservation_id;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0001';
  end if;

  return v_selection;
end;
$$;

-- 在庫切れの影響を受ける予約（今日以降・有効な予約で、保存した中身に無効なブレンド/ハーブを含む）
create or replace view public.herb_affected_reservations
with (security_invoker = true) as
select
  r.id,
  r.reservation_code,
  r.date,
  r.start_time,
  r.guest_name,
  r.guest_count,
  r.phone,
  r.status,
  r.herb_choice,
  (t->>'tier')::integer as tier,
  t->>'code' as blend_code,
  t->>'title' as blend_title,
  (
    select string_agg(h->>'name', '・')
    from jsonb_array_elements(t->'herbs') h
    join herbs hh on hh.id = (h->>'id')::uuid
    where not hh.active
  ) as unavailable_herbs,
  not exists (
    select 1 from herb_blends b where b.id = (t->>'blend_id')::uuid and b.active
  ) as blend_inactive
from reservations r
cross join lateral jsonb_array_elements(r.herb_selection->'tiers') t
where r.herb_selection is not null
  and r.date >= (now() at time zone 'Asia/Tokyo')::date
  and r.status in ('confirmed', 'pending', 'pending_payment')
  and (
    not exists (select 1 from herb_blends b where b.id = (t->>'blend_id')::uuid and b.active)
    or exists (
      select 1
      from jsonb_array_elements(t->'herbs') h
      join herbs hh on hh.id = (h->>'id')::uuid
      where not hh.active
    )
  );

revoke all on function public.herb_blend_available(uuid) from public, anon, authenticated;
revoke all on function public.herb_tier_snapshot(integer, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.build_herb_selection(text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.get_herb_catalog() from public;
grant execute on function public.get_herb_catalog() to anon, authenticated;
revoke all on function public.admin_set_reservation_herbs(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_set_reservation_herbs(uuid, text, jsonb) to authenticated;

-- 初期マスタ（ブレンド7件・ハーブ10種・おすすめ 01 + 02）
do $$
declare
  v_blend uuid;
begin
  if exists (select 1 from herbs) or exists (select 1 from herb_blends) then
    return;
  end if;

  insert into herbs (name, note, sort_order) values
    ('レモングラス', 'top', 1),
    ('ラベンダー', 'top', 2),
    ('ローズ', 'top', 3),
    ('ローズマリー', 'middle', 1),
    ('よもぎ', 'middle', 2),
    ('ラズベリーリーフ', 'middle', 3),
    ('セージ', 'base', 1),
    ('レディスマントル', 'base', 2),
    ('香木', 'base', 3),
    ('ムスク', 'base', 4);

  -- 文末の句点は付けず、文の区切りは改行（サイトの表記ルール）
  insert into herb_blends (code, title, description, sort_order) values
    ('01', 'Uの基本', E'レモングラスが先に立ち、ローズマリーの清涼感へ\n最後にセージの深い青さが残る', 1)
    returning id into v_blend;
  insert into herb_blend_herbs (blend_id, herb_id, sort_order)
    select v_blend, id, ord from (values ('レモングラス', 1), ('ローズマリー', 2), ('セージ', 3)) v(name, ord)
    join herbs using (name);

  insert into herb_blends (code, title, description, sort_order) values
    ('02', 'Uの基本 2', E'ローズの華やかさで始まり、やわらかな葉の香りを経て、静かに落ち着く', 2)
    returning id into v_blend;
  insert into herb_blend_herbs (blend_id, herb_id, sort_order)
    select v_blend, id, ord from (values ('ローズ', 1), ('ラズベリーリーフ', 2), ('レディスマントル', 3)) v(name, ord)
    join herbs using (name);

  insert into herb_blends (code, title, description, sort_order) values
    ('03', '華やかで和風', E'ラベンダーが華やかに立ち、よもぎの和の苦みを経て、静かに落ち着く', 3)
    returning id into v_blend;
  insert into herb_blend_herbs (blend_id, herb_id, sort_order)
    select v_blend, id, ord from (values ('ラベンダー', 1), ('よもぎ', 2), ('レディスマントル', 3)) v(name, ord)
    join herbs using (name);

  insert into herb_blends (code, title, description, sort_order) values
    ('04', 'より和なテイスト', E'レモングラスの軽さのあと、よもぎのほろ苦さが広がり、セージが深く支える', 4)
    returning id into v_blend;
  insert into herb_blend_herbs (blend_id, herb_id, sort_order)
    select v_blend, id, ord from (values ('レモングラス', 1), ('よもぎ', 2), ('セージ', 3)) v(name, ord)
    join herbs using (name);

  insert into herb_blends (code, title, description, sort_order) values
    ('05', '爽やか', E'レモングラスの爽やかさを、二つの葉の香りが穏やかに受け止める', 5)
    returning id into v_blend;
  insert into herb_blend_herbs (blend_id, herb_id, sort_order)
    select v_blend, id, ord from (values ('レモングラス', 1), ('ラズベリーリーフ', 2), ('レディスマントル', 3)) v(name, ord)
    join herbs using (name);

  insert into herb_blends (code, title, description, caution, needs_prep, sort_order) values
    ('06', '雰囲気を変えたい方に', E'ベースだけで組んだ、重く長く残るwoodyな香り\nほかの段と重ねると、奥行きが増す', '作成にお時間をいただきます', true, 6)
    returning id into v_blend;
  insert into herb_blend_herbs (blend_id, herb_id, sort_order)
    select v_blend, id, ord from (values ('香木', 1), ('ムスク', 2)) v(name, ord)
    join herbs using (name);

  insert into herb_blends (code, title, description, is_original, needs_prep, sort_order) values
    ('07', 'ORIGINAL', 'TOP・MIDDLE・BASEから1種ずつ選ぶと、香りが整います', true, true, 7);

  update herb_settings
  set recommended_tier1_blend_id = (select id from herb_blends where code = '01'),
      recommended_tier2_blend_id = (select id from herb_blends where code = '02'),
      updated_at = now()
  where id;
end $$;
