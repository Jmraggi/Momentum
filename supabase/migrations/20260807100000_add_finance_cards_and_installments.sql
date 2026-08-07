alter table public.finance_accounts drop constraint finance_accounts_account_type_check;
alter table public.finance_accounts add constraint finance_accounts_account_type_check check (account_type in ('cash', 'bank', 'digital_wallet', 'savings', 'credit_card', 'other'));

create table public.finance_card_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  description text not null check (char_length(trim(description)) > 0),
  installment_amount_minor bigint not null check (installment_amount_minor > 0),
  current_installment integer not null check (current_installment >= 1),
  total_installments integer not null check (total_installments >= current_installment),
  due_on date not null,
  status text not null default 'active' check (status in ('active', 'paid', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index finance_card_installments_user_due_idx on public.finance_card_installments(user_id, due_on) where status = 'active';

create function public.validate_finance_card_installment() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare account_user uuid; account_type_value text;
begin
  select user_id, account_type into account_user, account_type_value from public.finance_accounts where id = new.account_id;
  if not found or account_user <> new.user_id or account_type_value <> 'credit_card' then raise exception 'La cuota debe pertenecer a una tarjeta del usuario'; end if;
  return new;
end; $$;
create trigger finance_card_installments_updated before update on public.finance_card_installments for each row execute function public.set_updated_at();
create trigger finance_card_installments_validate before insert or update on public.finance_card_installments for each row execute function public.validate_finance_card_installment();
alter table public.finance_card_installments enable row level security;
create policy "Users manage own finance card installments" on public.finance_card_installments for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.finance_card_installments to authenticated;
