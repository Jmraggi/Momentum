create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  activity_type text not null check (activity_type in ('crossfit','strength','running','walking','cycling','mobility','sport','other')),
  started_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  perceived_exertion integer check (perceived_exertion between 1 and 10),
  notes text,
  source_id uuid references public.data_sources(id) on delete set null,
  external_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint workouts_external_source_key unique (user_id, source_id, external_id)
);
create index workouts_user_started_at_idx on public.workouts(user_id, started_at desc);
create trigger workouts_set_updated_at before update on public.workouts for each row execute function public.set_updated_at();
alter table public.workouts enable row level security;
create policy "Users can manage own workouts" on public.workouts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.workouts to authenticated;
