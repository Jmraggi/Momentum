create table public.health_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  timezone text not null default 'America/Argentina/Buenos_Aires' check (char_length(trim(timezone)) > 0),
  water_goal_ml integer not null default 2000 check (water_goal_ml between 250 and 20000),
  steps_goal integer not null default 8000 check (steps_goal between 100 and 100000),
  show_readiness boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  load_type text not null check (load_type in ('strength', 'bodyweight', 'cardio', 'mobility')),
  primary_muscle text,
  secondary_muscles text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint exercises_user_name_key unique (user_id, name)
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint workout_exercises_position_key unique (workout_id, position)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  position integer not null check (position >= 0),
  repetitions integer check (repetitions between 0 and 10000),
  weight_kg numeric check (weight_kg is null or weight_kg >= 0),
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 86400),
  perceived_exertion integer check (perceived_exertion between 1 and 10),
  is_warmup boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint workout_sets_position_key unique (workout_exercise_id, position),
  constraint workout_sets_measurement_check check (
    repetitions is not null or weight_kg is not null or distance_meters is not null or duration_seconds is not null
  )
);

create index metric_entries_user_metric_check_in_date_idx on public.metric_entries(user_id, metric_id, check_in_date desc) where check_in_date is not null;
create index exercises_user_id_idx on public.exercises(user_id);
create index workout_exercises_workout_position_idx on public.workout_exercises(workout_id, position);
create index workout_sets_workout_exercise_position_idx on public.workout_sets(workout_exercise_id, position);
create index workout_sets_user_id_idx on public.workout_sets(user_id);

create function public.validate_workout_exercise()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare workout_user uuid; exercise_user uuid;
begin
  select user_id into workout_user from public.workouts where id = new.workout_id;
  select user_id into exercise_user from public.exercises where id = new.exercise_id;
  if workout_user is null or exercise_user is null or workout_user <> new.user_id or exercise_user <> new.user_id then
    raise exception 'El entrenamiento y ejercicio deben pertenecer al mismo usuario';
  end if;
  return new;
end;
$$;

create function public.validate_workout_set()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare workout_exercise_user uuid;
begin
  select user_id into workout_exercise_user from public.workout_exercises where id = new.workout_exercise_id;
  if workout_exercise_user is null or workout_exercise_user <> new.user_id then
    raise exception 'La serie debe pertenecer al mismo usuario que el ejercicio';
  end if;
  return new;
end;
$$;

create trigger health_settings_set_updated_at before update on public.health_settings for each row execute function public.set_updated_at();
create trigger exercises_set_updated_at before update on public.exercises for each row execute function public.set_updated_at();
create trigger workout_exercises_set_updated_at before update on public.workout_exercises for each row execute function public.set_updated_at();
create trigger workout_sets_set_updated_at before update on public.workout_sets for each row execute function public.set_updated_at();
create trigger workout_exercises_validate before insert or update on public.workout_exercises for each row execute function public.validate_workout_exercise();
create trigger workout_sets_validate before insert or update on public.workout_sets for each row execute function public.validate_workout_set();

alter table public.health_settings enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
create policy "Users can manage own health settings" on public.health_settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can manage own exercises" on public.exercises for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can manage own workout exercises" on public.workout_exercises for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can manage own workout sets" on public.workout_sets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.health_settings, public.exercises, public.workout_exercises, public.workout_sets to authenticated;
revoke all on function public.validate_workout_exercise() from public;
revoke all on function public.validate_workout_set() from public;
