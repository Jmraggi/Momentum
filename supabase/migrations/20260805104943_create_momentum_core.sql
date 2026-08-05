create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  source_type text not null check (source_type in ('manual', 'external')),
  provider text,
  external_account_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint data_sources_source_details_check check (
    (source_type = 'manual' and provider is null and external_account_id is null)
    or (source_type = 'external' and provider is not null)
  ),
  constraint data_sources_user_name_key unique (user_id, name)
);

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  pillar text not null check (pillar in ('health', 'finance', 'projects', 'habits')),
  data_type text not null check (data_type in ('numeric', 'text', 'boolean')),
  unit text,
  aggregation text not null check (aggregation in ('sum', 'average', 'minimum', 'maximum', 'latest', 'count')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint metrics_user_name_key unique (user_id, name)
);

create table public.metric_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  metric_id uuid not null references public.metrics (id) on delete cascade,
  data_source_id uuid not null references public.data_sources (id) on delete restrict,
  numeric_value numeric,
  text_value text,
  boolean_value boolean,
  recorded_at timestamptz not null default timezone('utc', now()),
  external_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint metric_entries_one_value_check check (
    num_nonnulls(numeric_value, text_value, boolean_value) = 1
  ),
  constraint metric_entries_external_id_check check (
    external_id is null or char_length(trim(external_id)) > 0
  )
);

create index data_sources_user_id_idx on public.data_sources (user_id);
create unique index data_sources_one_manual_per_user_idx
  on public.data_sources (user_id)
  where source_type = 'manual';
create unique index data_sources_external_account_idx
  on public.data_sources (user_id, provider, external_account_id)
  where source_type = 'external' and external_account_id is not null;
create index metrics_user_id_idx on public.metrics (user_id);
create index metrics_user_pillar_idx on public.metrics (user_id, pillar);
create index metric_entries_user_recorded_at_idx on public.metric_entries (user_id, recorded_at desc);
create index metric_entries_metric_recorded_at_idx on public.metric_entries (metric_id, recorded_at desc);
create unique index metric_entries_external_source_id_idx
  on public.metric_entries (user_id, data_source_id, external_id)
  where external_id is not null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create function public.validate_metric_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  metric_user_id uuid;
  metric_data_type text;
  source_user_id uuid;
begin
  select user_id, data_type
    into metric_user_id, metric_data_type
    from public.metrics
    where id = new.metric_id;

  if not found or metric_user_id <> new.user_id then
    raise exception 'La métrica debe pertenecer al mismo usuario que el registro';
  end if;

  select user_id
    into source_user_id
    from public.data_sources
    where id = new.data_source_id;

  if not found or source_user_id <> new.user_id then
    raise exception 'La fuente debe pertenecer al mismo usuario que el registro';
  end if;

  if (metric_data_type = 'numeric' and new.numeric_value is null)
    or (metric_data_type = 'text' and new.text_value is null)
    or (metric_data_type = 'boolean' and new.boolean_value is null) then
    raise exception 'El valor debe coincidir con el tipo de dato de la métrica';
  end if;

  return new;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.data_sources (user_id, name, source_type)
  values (new.id, 'Manual', 'manual')
  on conflict do nothing;

  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger data_sources_set_updated_at
before update on public.data_sources
for each row execute function public.set_updated_at();

create trigger metrics_set_updated_at
before update on public.metrics
for each row execute function public.set_updated_at();

create trigger metric_entries_set_updated_at
before update on public.metric_entries
for each row execute function public.set_updated_at();

create trigger metric_entries_validate
before insert or update on public.metric_entries
for each row execute function public.validate_metric_entry();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.data_sources enable row level security;
alter table public.metrics enable row level security;
alter table public.metric_entries enable row level security;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can delete own profile"
on public.profiles for delete
to authenticated
using ((select auth.uid()) = id);

create policy "Users can read own data sources"
on public.data_sources for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own data sources"
on public.data_sources for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own data sources"
on public.data_sources for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own data sources"
on public.data_sources for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own metrics"
on public.metrics for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own metrics"
on public.metrics for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own metrics"
on public.metrics for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own metrics"
on public.metrics for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own metric entries"
on public.metric_entries for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own metric entries"
on public.metric_entries for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own metric entries"
on public.metric_entries for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own metric entries"
on public.metric_entries for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.data_sources to authenticated;
grant select, insert, update, delete on public.metrics to authenticated;
grant select, insert, update, delete on public.metric_entries to authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.validate_metric_entry() from public;
