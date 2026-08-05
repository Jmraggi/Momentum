create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pillar text not null check (pillar in ('health','finance','projects','habits')),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  metric_id uuid references public.metrics(id) on delete set null,
  target_type text not null check (target_type in ('reach_value','reduce_value','increase_value','weekly_frequency','weekly_duration')),
  target_value numeric check (target_value is null or target_value >= 0),
  start_value numeric,
  start_date date not null default current_date,
  due_date date,
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint goals_dates_check check (due_date is null or due_date >= start_date)
);
create index goals_user_pillar_status_idx on public.goals(user_id, pillar, status);
create trigger goals_set_updated_at before update on public.goals for each row execute function public.set_updated_at();
alter table public.goals enable row level security;
create policy "Users can manage own goals" on public.goals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.goals to authenticated;
