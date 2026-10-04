-- LINE bot からシフトを操作できるよう、LINE ユーザーとスタッフ (profiles) を紐付ける。
-- staff_id が NULL の LINE ユーザーは予約照会のみ可能で、シフト系コマンドは使えない。
alter table public.staff_line_users
  add column if not exists staff_id uuid references public.profiles(id);

create index if not exists staff_line_users_staff_id_idx
  on public.staff_line_users (staff_id);

comment on column public.staff_line_users.staff_id is
  'シフト操作の主体となる profiles.id。NULL の場合はシフト系コマンド不可';
