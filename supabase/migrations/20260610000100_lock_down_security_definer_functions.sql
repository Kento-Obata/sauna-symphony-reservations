-- Restrict who can invoke SECURITY DEFINER functions via the exposed RPC API.
-- Flagged by the Supabase security advisor (lint 0028 / 0029):
-- these functions were callable by anon/authenticated through /rest/v1/rpc/.

-- handle_new_user() is a trigger function only. It must never be callable via RPC.
-- The trigger continues to run with the table owner's privileges regardless.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- get_current_user_role() is referenced by the profiles UPDATE RLS policy, so
-- the authenticated role must keep EXECUTE. Remove anon/public RPC access only.
revoke execute on function public.get_current_user_role() from public, anon;
grant execute on function public.get_current_user_role() to authenticated, service_role;
