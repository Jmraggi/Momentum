alter table public.tasks
  drop constraint tasks_linked_entity_check,
  drop constraint tasks_linked_entity_type_check;

alter table public.tasks
  add constraint tasks_linked_entity_type_check
    check (linked_entity_type in ('manual', 'project', 'habit', 'health', 'finance', 'objective')),
  add constraint tasks_linked_entity_check
    check (
      (linked_entity_type is null and linked_entity_id is null)
      or (linked_entity_type = 'manual' and linked_entity_id is null)
      or (linked_entity_type in ('project', 'habit', 'health', 'finance', 'objective') and linked_entity_id is not null)
    );
