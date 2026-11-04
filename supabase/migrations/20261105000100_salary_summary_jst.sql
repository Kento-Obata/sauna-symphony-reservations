-- 月の給与集計の年・月・曜日を日本時間で判定する。
-- DB のタイムゾーンは UTC のため、extract(... from start_time) だと JST 9時前に始まるシフトが前日扱いになり、
-- 土日/平日の時給と集計月がずれていた(土曜朝が平日の時給、月初の朝が前月など)。
-- 期間時給の判定は 20261030000000 から JST 日付。列と型は変えない。

create or replace view public.monthly_salary_summary
with (security_invoker = true) as
select
  s.staff_id,
  p.username as staff_name,
  extract(year from (s.start_time at time zone 'Asia/Tokyo')) as year,
  extract(month from (s.start_time at time zone 'Asia/Tokyo')) as month,
  count(*) as total_shifts,
  sum(
    (extract(epoch from s.end_time - s.start_time) / 3600::numeric - coalesce(s.break_minutes, 0)::numeric / 60.0)
    * case
        when extract(dow from (s.start_time at time zone 'Asia/Tokyo')) = any (array[0::numeric, 6::numeric])
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
group by s.staff_id, p.username,
         extract(year from (s.start_time at time zone 'Asia/Tokyo')),
         extract(month from (s.start_time at time zone 'Asia/Tokyo'))
order by extract(year from (s.start_time at time zone 'Asia/Tokyo')) desc,
         extract(month from (s.start_time at time zone 'Asia/Tokyo')) desc,
         p.username;
