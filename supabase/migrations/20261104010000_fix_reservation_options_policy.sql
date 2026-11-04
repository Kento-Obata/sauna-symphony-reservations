-- reservation_options の管理者ポリシーが auth.users を参照しており、ログイン中の管理者(authenticated)には
-- auth.users を読む権限が無いため「permission denied for table users」で失敗していた。
-- (管理画面の予約詳細でオプションが読めない・オプション付きの予約登録や編集が失敗する)
-- 意味は同じまま(管理者だけが読み書きできる)、profiles だけで判定する形に置き換える。

drop policy if exists "Only administrators can manage reservation options" on public.reservation_options;

create policy "Only administrators can manage reservation options" on public.reservation_options for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
