create table public.health_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary_date date not null,
  steps integer not null default 0 check (steps >= 0),
  walking_running_distance_km numeric not null default 0 check (walking_running_distance_km >= 0),
  active_energy_kcal numeric not null default 0 check (active_energy_kcal >= 0),
  basal_energy_kcal numeric not null default 0 check (basal_energy_kcal >= 0),
  flights_climbed numeric not null default 0 check (flights_climbed >= 0),
  walking_speed_avg numeric, walking_step_length_avg numeric, walking_asymmetry_avg numeric,
  walking_double_support_avg numeric, walking_steadiness_avg numeric,
  is_partial boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, summary_date)
);

create table public.health_sleep_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  start_at timestamptz not null, end_at timestamptz not null, sleep_type text not null check (sleep_type in ('in_bed','asleep','awake','core','deep','rem','unknown')),
  source text, external_id text, created_at timestamptz not null default timezone('utc', now()),
  check (end_at > start_at), unique (user_id, external_id)
);

create table public.health_imports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider = 'apple_health'), filename text not null, file_size bigint not null check (file_size >= 0),
  started_at timestamptz not null default timezone('utc', now()), finished_at timestamptz,
  status text not null default 'pending' check (status in ('pending','processing','completed','completed_with_warnings','failed')),
  records_processed integer not null default 0, records_imported integer not null default 0, records_skipped integer not null default 0,
  earliest_date date, latest_date date, error_message text, summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index health_daily_summaries_user_date_idx on public.health_daily_summaries(user_id, summary_date desc);
create index health_sleep_sessions_user_start_idx on public.health_sleep_sessions(user_id, start_at desc);
create index health_imports_user_created_idx on public.health_imports(user_id, created_at desc);
create trigger health_daily_summaries_set_updated_at before update on public.health_daily_summaries for each row execute function public.set_updated_at();

alter table public.health_daily_summaries enable row level security;
alter table public.health_sleep_sessions enable row level security;
alter table public.health_imports enable row level security;
create policy "Users can manage own health daily summaries" on public.health_daily_summaries for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can manage own health sleep sessions" on public.health_sleep_sessions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can manage own health imports" on public.health_imports for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.health_daily_summaries, public.health_sleep_sessions, public.health_imports to authenticated;
