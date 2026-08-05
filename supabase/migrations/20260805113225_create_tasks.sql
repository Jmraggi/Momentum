create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  pillar text check (pillar in ('health', 'finance', 'projects', 'habits')),
  linked_entity_type text check (linked_entity_type in ('project', 'habit', 'health', 'finance', 'objective')),
  linked_entity_id uuid,
  is_urgent boolean not null default false,
  is_important boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  due_at timestamptz,
  scheduled_at timestamptz,
  estimated_duration_minutes integer check (estimated_duration_minutes > 0),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tasks_linked_entity_check check (
    (linked_entity_type is null and linked_entity_id is null)
    or (linked_entity_type is not null and linked_entity_id is not null)
  )
);

create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_user_due_at_idx on public.tasks (user_id, due_at) where due_at is not null;
create index tasks_user_scheduled_at_idx on public.tasks (user_id, scheduled_at) where scheduled_at is not null;
create index tasks_user_priority_idx on public.tasks (user_id, is_important desc, is_urgent desc);
create index tasks_linked_entity_idx on public.tasks (user_id, linked_entity_type, linked_entity_id) where linked_entity_id is not null;

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "Users can read own tasks"
on public.tasks for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own tasks"
on public.tasks for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own tasks"
on public.tasks for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own tasks"
on public.tasks for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.tasks to authenticated;
