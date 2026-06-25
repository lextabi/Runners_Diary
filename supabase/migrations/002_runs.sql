create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_date date not null,
  run_time time,
  distance_km numeric(7, 2) not null check (distance_km > 0),
  pace text not null,
  duration_minutes numeric(7, 2) check (
    duration_minutes is null or duration_minutes > 0
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists runs_user_date_idx
on public.runs (user_id, run_date desc);

alter table public.runs enable row level security;

grant select, insert, update, delete on public.runs to authenticated;

drop policy if exists "Users can read their own runs" on public.runs;
create policy "Users can read their own runs"
on public.runs
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own runs" on public.runs;
create policy "Users can insert their own runs"
on public.runs
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own runs" on public.runs;
create policy "Users can update their own runs"
on public.runs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own runs" on public.runs;
create policy "Users can delete their own runs"
on public.runs
for delete
using (auth.uid() = user_id);

drop trigger if exists set_runs_updated_at on public.runs;
create trigger set_runs_updated_at
before update on public.runs
for each row
execute function public.set_updated_at();
