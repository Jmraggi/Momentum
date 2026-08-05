create table public.habits (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0), description text,
  pillar text not null default 'habits' check (pillar in ('health','finance','projects','habits')),
  frequency_type text not null check (frequency_type in ('daily','specific_days','weekly_count')),
  target_count integer not null default 1 check (target_count > 0), days_of_week integer[] check (days_of_week is null or days_of_week <@ array[0,1,2,3,4,5,6]),
  start_date date not null default current_date, end_date date, is_active boolean not null default true,
  linked_entity_type text, linked_entity_id uuid, created_at timestamptz not null default timezone('utc',now()), updated_at timestamptz not null default timezone('utc',now()),
  constraint habits_dates_check check (end_date is null or end_date >= start_date),
  constraint habits_days_check check ((frequency_type = 'specific_days' and cardinality(days_of_week) > 0) or (frequency_type <> 'specific_days' and days_of_week is null))
);
create table public.habit_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, habit_id uuid not null references public.habits(id) on delete cascade,
  entry_date date not null, completed_count integer not null default 0 check (completed_count >= 0), notes text, created_at timestamptz not null default timezone('utc',now()), updated_at timestamptz not null default timezone('utc',now()),
  constraint habit_entries_habit_date_key unique (habit_id, entry_date)
);
create index habits_user_active_idx on public.habits(user_id,is_active); create index habit_entries_user_date_idx on public.habit_entries(user_id,entry_date desc);
create trigger habits_set_updated_at before update on public.habits for each row execute function public.set_updated_at(); create trigger habit_entries_set_updated_at before update on public.habit_entries for each row execute function public.set_updated_at();
alter table public.habits enable row level security; alter table public.habit_entries enable row level security;
create policy "Users can manage own habits" on public.habits for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users can manage own habit entries" on public.habit_entries for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.habits,public.habit_entries to authenticated;
