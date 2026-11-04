-- 顧客マスタ(customers)が「ログインできる人なら誰でも読み書きできる」ポリシーだった。
-- 管理画面は customers を直接使っておらず、読み書きは import-customers / send-bulk-email(service role)だけなので、
-- ログイン中の利用者からは管理者だけにする。
drop policy if exists "authenticated_all_customers" on public.customers;

create policy "Admins can manage customers" on public.customers for all
  to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
