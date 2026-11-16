create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform varchar(100) not null,
  minutes_online integer not null check (minutes_online > 0),
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_user_date_idx
  on public.time_entries (user_id, date desc);

alter table public.time_entries enable row level security;

drop policy if exists "time_entries_owner_manage" on public.time_entries;
create policy "time_entries_owner_manage" on public.time_entries
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.time_entries to authenticated;
