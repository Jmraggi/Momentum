alter table public.metrics add column slug text;

update public.metrics
set slug = 'body_weight'
where name = 'Peso corporal' and pillar = 'health' and slug is null;

alter table public.metrics add constraint metrics_user_slug_key unique (user_id, slug);
