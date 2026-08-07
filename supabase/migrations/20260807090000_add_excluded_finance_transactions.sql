alter table public.finance_transactions drop constraint finance_transactions_status_check;
alter table public.finance_transactions add constraint finance_transactions_status_check check (status in ('pending', 'confirmed', 'excluded'));
