-- Finance dashboard phase one: monetary values are stored as integer minor units.
do $$
begin
  if exists (
    select 1 from public.finance_transactions
    where amount <> round(amount, 2)
  ) then
    raise exception 'No se puede convertir finance_transactions.amount: hay importes con más de dos decimales';
  end if;
end $$;

alter table public.finance_transactions
  alter column amount type bigint using round(amount * 100)::bigint;

alter table public.finance_transactions
  rename column amount to amount_minor;

alter table public.finance_accounts
  add column opening_balance_minor bigint not null default 0,
  add column opening_balance_at date not null default current_date,
  add column balance_role text not null default 'operational'
    check (balance_role in ('operational', 'savings', 'investment', 'liability'));

create table public.finance_budget_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_start date not null check (month_start = date_trunc('month', month_start)::date),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, month_start)
);

create table public.finance_budget_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  budget_period_id uuid not null references public.finance_budget_periods(id) on delete cascade,
  category_id uuid not null references public.finance_categories(id) on delete restrict,
  limit_minor bigint not null check (limit_minor > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (budget_period_id, category_id)
);

create table public.finance_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  hide_amounts boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index finance_budget_periods_user_month_idx on public.finance_budget_periods(user_id, month_start);
create index finance_budget_allocations_user_period_idx on public.finance_budget_allocations(user_id, budget_period_id);
create index finance_transactions_user_month_idx on public.finance_transactions(user_id, occurred_at desc);

create function public.validate_finance_budget_allocation() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  period_user uuid;
  category_user uuid;
  category_kind text;
begin
  select user_id into period_user from public.finance_budget_periods where id = new.budget_period_id;
  select user_id, category_type into category_user, category_kind from public.finance_categories where id = new.category_id;
  if period_user is null or category_user is null or period_user <> new.user_id or category_user <> new.user_id or category_kind not in ('expense', 'both') then
    raise exception 'El presupuesto debe pertenecer al usuario y usar una categoría de gasto';
  end if;
  return new;
end;
$$;

create trigger finance_budget_periods_updated before update on public.finance_budget_periods for each row execute function public.set_updated_at();
create trigger finance_budget_allocations_updated before update on public.finance_budget_allocations for each row execute function public.set_updated_at();
create trigger finance_preferences_updated before update on public.finance_preferences for each row execute function public.set_updated_at();
create trigger finance_budget_allocations_validate before insert or update on public.finance_budget_allocations for each row execute function public.validate_finance_budget_allocation();

alter table public.finance_budget_periods enable row level security;
alter table public.finance_budget_allocations enable row level security;
alter table public.finance_preferences enable row level security;

create policy "Users manage own finance budget periods" on public.finance_budget_periods for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own finance budget allocations" on public.finance_budget_allocations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own finance preferences" on public.finance_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.finance_budget_periods, public.finance_budget_allocations, public.finance_preferences to authenticated;
