create table public.habit_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  time_of_day text check (time_of_day is null or time_of_day in ('morning', 'afternoon', 'evening', 'before_sleep', 'anytime')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.habit_routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  routine_id uuid not null references public.habit_routines(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  position integer not null check (position >= 0),
  trigger_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint habit_routine_items_routine_habit_key unique (routine_id, habit_id),
  constraint habit_routine_items_routine_position_key unique (routine_id, position)
);

create index habit_routines_user_active_idx on public.habit_routines(user_id, is_active);
create index habit_routine_items_routine_position_idx on public.habit_routine_items(routine_id, position);
create trigger habit_routines_set_updated_at before update on public.habit_routines for each row execute function public.set_updated_at();
create trigger habit_routine_items_set_updated_at before update on public.habit_routine_items for each row execute function public.set_updated_at();
alter table public.habit_routines enable row level security;
alter table public.habit_routine_items enable row level security;
create policy "Users can manage own habit routines" on public.habit_routines for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can manage own habit routine items" on public.habit_routine_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.habit_routines, public.habit_routine_items to authenticated;
