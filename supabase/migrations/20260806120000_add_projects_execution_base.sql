-- Base de ejecucion para Proyectos: las tareas siguen siendo transversales.
alter table public.projects
  add column completed_at timestamptz;

alter table public.tasks
  drop constraint tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check check (status in ('pending', 'in_progress', 'blocked', 'completed', 'cancelled')),
  add column manual_order bigint not null default 0,
  add column start_at timestamptz,
  add column energy_required text check (energy_required in ('low', 'medium', 'high')),
  add column focus_mode text check (focus_mode in ('deep', 'light', 'admin'));

create index tasks_project_status_order_idx
  on public.tasks (user_id, linked_entity_type, linked_entity_id, status, manual_order, created_at)
  where linked_entity_type = 'project';

create index projects_user_completed_at_idx
  on public.projects (user_id, completed_at desc)
  where completed_at is not null;

create function public.validate_project_task_owner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare project_user uuid;
begin
  if new.linked_entity_type = 'project' then
    select user_id into project_user from public.projects where id = new.linked_entity_id;
    if project_user is null or project_user <> new.user_id then
      raise exception 'La tarea debe estar vinculada a un proyecto del mismo usuario';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_validate_project_owner
before insert or update on public.tasks
for each row execute function public.validate_project_task_owner();

revoke all on function public.validate_project_task_owner() from public;
