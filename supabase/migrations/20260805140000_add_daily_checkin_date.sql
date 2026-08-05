alter table public.metric_entries add column check_in_date date;

alter table public.metric_entries
  add constraint metric_entries_user_metric_check_in_date_key unique (user_id, metric_id, check_in_date);
