create table public.projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0), description text,
  status text not null default 'planned' check (status in ('planned','active','paused','completed','archived')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  start_date date, due_date date, progress_mode text not null default 'tasks' check (progress_mode = 'tasks'),
  created_at timestamptz not null default timezone('utc',now()), updated_at timestamptz not null default timezone('utc',now()),
  constraint projects_dates_check check (due_date is null or start_date is null or due_date >= start_date)
);
create index projects_user_status_idx on public.projects(user_id,status);
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create function public.delete_project_tasks() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin delete from public.tasks where user_id=old.user_id and linked_entity_type='project' and linked_entity_id=old.id; return old; end; $$;
create trigger projects_delete_tasks before delete on public.projects for each row execute function public.delete_project_tasks();
alter table public.projects enable row level security;
create policy "Users can manage own projects" on public.projects for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.projects to authenticated;
