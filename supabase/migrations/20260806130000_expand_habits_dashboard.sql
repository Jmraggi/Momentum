alter table public.habits
  add column habit_type text not null default 'build' check (habit_type in ('build', 'break')),
  add column tracking_type text not null default 'count' check (tracking_type in ('binary', 'count', 'duration', 'quantitative')),
  add column time_of_day text not null default 'anytime' check (time_of_day in ('morning', 'afternoon', 'evening', 'before_sleep', 'anytime')),
  add column target_value numeric not null default 1 check (target_value > 0),
  add column unit text,
  add column minimum_success_value numeric not null default 1 check (minimum_success_value > 0);

update public.habits
set target_value = target_count,
    minimum_success_value = target_count,
    tracking_type = case when target_count = 1 then 'binary' else 'count' end;

alter table public.habits
  add constraint habits_success_value_check check (minimum_success_value <= target_value);

alter table public.habit_entries
  add column value numeric,
  add column status text,
  add column skipped_reason text,
  add constraint habit_entries_status_check check (status is null or status in ('completed', 'partial', 'skipped', 'avoided', 'occurred')),
  add constraint habit_entries_skipped_reason_check check (status <> 'skipped' or nullif(trim(skipped_reason), '') is not null);

update public.habit_entries
set value = completed_count,
    status = case when completed_count > 0 then 'completed' else null end;

create table public.habit_pause_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint habit_pause_periods_dates_check check (ends_on is null or ends_on >= starts_on)
);

create unique index habit_pause_periods_open_habit_idx on public.habit_pause_periods(habit_id) where ends_on is null;
create index habit_pause_periods_habit_range_idx on public.habit_pause_periods(habit_id, starts_on, ends_on);
create index habit_entries_habit_date_idx on public.habit_entries(habit_id, entry_date desc);

create table public.habit_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  general_streak_threshold numeric not null default 0.80 check (general_streak_threshold > 0 and general_streak_threshold <= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger habit_pause_periods_set_updated_at before update on public.habit_pause_periods for each row execute function public.set_updated_at();
create trigger habit_preferences_set_updated_at before update on public.habit_preferences for each row execute function public.set_updated_at();

alter table public.habit_pause_periods enable row level security;
alter table public.habit_preferences enable row level security;
create policy "Users can manage own habit pauses" on public.habit_pause_periods for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can manage own habit preferences" on public.habit_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.habit_pause_periods, public.habit_preferences to authenticated;
