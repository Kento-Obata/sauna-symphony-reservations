-- AIエージェント用の窓口(MCP / LINE)
--   agent_api_keys         Claude Code・自動実行用の API キー(ハッシュだけ保存)。Claudeアプリは OAuth で入るので使わない
--   agent_pending_actions  返金・お客様への送信など、実行前に確認が要る操作の控え。確認されたものだけ実行する
--   agent_action_logs      AI 経由の操作の記録(誰が・どの窓口から・何をしたか)
--
-- Edge Function は POSTGRES_URL(postgres ロール)で接続し、利用者の権限で動かすときは
-- トランザクション内で role=authenticated と request.jwt.claims を設定して RLS をそのまま効かせる。

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.agent_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists agent_api_keys_user_idx on public.agent_api_keys (user_id);

create table if not exists public.agent_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool text not null,
  input jsonb not null,
  summary text not null,
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  channel text not null check (channel in ('mcp', 'line')),
  client text,
  tool text not null,
  tool_title text,
  input jsonb,
  status text not null check (status in ('ok', 'error', 'pending_confirmation', 'confirmed')),
  result_summary text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists agent_action_logs_created_idx on public.agent_action_logs (created_at desc);
create index if not exists agent_action_logs_user_idx on public.agent_action_logs (user_id, created_at desc);

alter table public.agent_api_keys enable row level security;
alter table public.agent_pending_actions enable row level security;
alter table public.agent_action_logs enable row level security;

-- キーの一覧・失効は管理画面から(発行は下の関数で行い、平文は発行時に一度だけ返す)
create policy "Admins can view agent api keys" on public.agent_api_keys for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Admins can revoke agent api keys" on public.agent_api_keys for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "Admins can view agent action logs" on public.agent_action_logs for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- LINE の AI との会話(LINE の利用者ごとに1つ)。履歴は追記だけで、しばらく間が空いたら新しい会話にする
--   fingerprint: その会話で使っている system と道具の定義のハッシュ。変わったら(デプロイ・権限の変更)新しい会話にする
--   version: 同時に届いたメッセージで履歴を上書きし合わないための版番号
create table if not exists public.agent_line_conversations (
  line_user_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  fingerprint text,
  version integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- LINE で受け取った写真(作業の記録に添える)。保存先は work-photos/<スタッフのトークン>/<id>.jpg
--   announced_at: AI に「この写真が届いている」と伝えた時刻(同じ写真を何度も伝えない)
create table if not exists public.agent_line_photos (
  id uuid primary key,
  line_user_id text not null,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  announced_at timestamptz
);

create index if not exists agent_line_photos_user_idx on public.agent_line_photos (line_user_id, created_at desc);

alter table public.agent_line_conversations enable row level security;
alter table public.agent_line_photos enable row level security;

-- agent_pending_actions / agent_line_conversations / agent_line_photos はポリシー無し(Edge Function だけが読み書きする)

-- API キーの発行(管理者のみ)。平文はこの戻り値でしか分からない
create or replace function public.create_agent_api_key(p_user_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if not exists (select 1 from profiles where id = p_user_id and role in ('admin', 'staff')) then
    raise exception 'agent_key_user_invalid' using errcode = 'P0001';
  end if;

  v_key := 'usk_' || encode(gen_random_bytes(24), 'hex');
  insert into agent_api_keys (user_id, name, key_prefix, key_hash)
  values (p_user_id, trim(p_name), left(v_key, 12), encode(digest(v_key, 'sha256'), 'hex'));
  return v_key;
end;
$$;

revoke all on function public.create_agent_api_key(uuid, text) from public, anon;
grant execute on function public.create_agent_api_key(uuid, text) to authenticated;
