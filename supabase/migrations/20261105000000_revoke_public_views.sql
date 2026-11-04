-- 所有者の権限で動くビュー(security_invoker なし)が anon / authenticated に公開されていて、
-- 公開キーだけで予約の個人情報・予約ページのトークン、Square の決済・売上を読めた。
-- どれも Edge Function(postgres ロール)からだけ読んでいるので、anon / authenticated の権限を外す。
-- 売上・Square のビューは別リポジトリの管理なので、無い環境(ローカル・ステージング)では飛ばす。
-- (2026-11-05 本番に先行して適用済み)
do $$
declare
  v text;
begin
  foreach v in array array[
    'v_valid_reservations', 'v_monthly_reconciliation', 'v_monthly_revenue',
    'v_monthly_sales', 'v_square_classified', 'v_square_monthly'
  ] loop
    if to_regclass('public.' || v) is not null then
      execute format('revoke all on public.%I from anon, authenticated', v);
    end if;
  end loop;
end $$;
