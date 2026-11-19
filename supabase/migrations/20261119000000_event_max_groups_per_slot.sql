-- イベント枠ごとの上限組数（駐車場の台数などで、人数とは別に組数を絞りたい場合）。
-- null は組数の上限なし。占有組数の数え方は人数と同じ（confirmed + 期限内の pending_payment）。
alter table public.events
  add column if not exists max_groups_per_slot integer
    check (max_groups_per_slot is null or max_groups_per_slot >= 1);

comment on column public.events.max_groups_per_slot is
  '1枠あたりの上限組数。null で上限なし。到達した枠は残席があっても満席扱い';
