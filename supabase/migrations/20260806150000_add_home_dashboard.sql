alter table public.profiles add column display_name text;
alter table public.profiles add constraint profiles_display_name_check check (display_name is null or char_length(trim(display_name)) between 1 and 80);

create table public.daily_focuses (
  user_id uuid not null references public.profiles(id) on delete cascade,
  focus_date date not null,
  task_id uuid references public.tasks(id) on delete set null,
  selection_source text not null check (selection_source in ('manual', 'suggestion')),
  selected_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, focus_date)
);

create function public.validate_daily_focus_task_owner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare task_owner uuid;
begin
  if new.task_id is not null then
    select user_id into task_owner from public.tasks where id = new.task_id;
    if task_owner is null or task_owner <> new.user_id then
      raise exception 'El foco debe pertenecer a una tarea del mismo usuario';
    end if;
  end if;
  return new;
end;
$$;

create trigger daily_focuses_validate_task_owner
before insert or update on public.daily_focuses
for each row execute function public.validate_daily_focus_task_owner();

alter table public.daily_focuses enable row level security;
create policy "Users manage own daily focuses" on public.daily_focuses for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.daily_focuses to authenticated;
revoke all on function public.validate_daily_focus_task_owner() from public;

create index daily_focuses_user_date_idx on public.daily_focuses(user_id, focus_date desc);
