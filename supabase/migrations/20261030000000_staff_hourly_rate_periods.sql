-- 期間限定の時給（研修期間など）
-- monthly_salary_summary はシフトの日付(JST)に該当する期間の時給を優先し、
-- 無ければ staff_hourly_rates（基本時給）、それも無ければ 1300/1450 を使う。

create table if not exists public.staff_hourly_rate_periods (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  weekday_rate integer not null,
  weekend_rate integer not null,
  note text,
  created_at timestamptz not null default now(),
  constraint staff_hourly_rate_periods_range_check check (start_date <= end_date)
);

create index if not exists staff_hourly_rate_periods_staff_idx
  on public.staff_hourly_rate_periods (staff_id, start_date);

alter table public.staff_hourly_rate_periods enable row level security;

create policy "Admins can manage hourly rate periods"
  on public.staff_hourly_rate_periods for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "Staff can view their own hourly rate periods"
  on public.staff_hourly_rate_periods for select
  using (staff_id = auth.uid());

create or replace view public.monthly_salary_summary
with (security_invoker = true) as
select
  s.staff_id,
  p.username as staff_name,
  extract(year from s.start_time) as year,
  extract(month from s.start_time) as month,
  count(*) as total_shifts,
  sum(
    (extract(epoch from s.end_time - s.start_time) / 3600::numeric - coalesce(s.break_minutes, 0)::numeric / 60.0)
    * case
        when extract(dow from s.start_time) = any (array[0::numeric, 6::numeric])
          then coalesce(rp.weekend_rate, hr.weekend_rate, 1450)::numeric
        else coalesce(rp.weekday_rate, hr.weekday_rate, 1300)::numeric
      end
  ) as total_salary,
  sum(extract(epoch from s.end_time - s.start_time) / 3600::numeric - coalesce(s.break_minutes, 0)::numeric / 60.0) as total_work_hours,
  sum(coalesce(s.break_minutes, 0)::numeric / 60.0) as total_break_hours
from public.shifts s
join public.profiles p on s.staff_id = p.id
left join public.staff_hourly_rates hr on s.staff_id = hr.staff_id
left join lateral (
  select r.weekday_rate, r.weekend_rate
  from public.staff_hourly_rate_periods r
  where r.staff_id = s.staff_id
    and (s.start_time at time zone 'Asia/Tokyo')::date between r.start_date and r.end_date
  order by r.start_date desc
  limit 1
) rp on true
where s.status = 'scheduled'::shift_status
group by s.staff_id, p.username, extract(year from s.start_time), extract(month from s.start_time)
order by extract(year from s.start_time) desc, extract(month from s.start_time) desc, p.username;
