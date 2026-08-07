create table public.finance_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  statement_type text not null check (statement_type in ('bank_account', 'credit_card')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  schema_version text not null,
  source_name text,
  statement_reference text,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  payload_hash text not null check (char_length(payload_hash) = 64),
  statement_fingerprint text not null check (char_length(statement_fingerprint) = 64),
  status text not null default 'reviewing' check (status in ('draft', 'validated', 'reviewing', 'confirming', 'confirmed', 'cancelled', 'failed')),
  total_items integer not null default 0 check (total_items >= 0),
  included_items integer not null default 0 check (included_items >= 0),
  excluded_items integer not null default 0 check (excluded_items >= 0),
  duplicate_items integer not null default 0 check (duplicate_items >= 0),
  review_items integer not null default 0 check (review_items >= 0),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, account_id, payload_hash)
);

create table public.finance_import_batch_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.finance_import_batches(id) on delete cascade,
  source_index integer not null check (source_index >= 0),
  included boolean not null default true,
  occurred_on date not null,
  description_original text not null check (char_length(trim(description_original)) > 0),
  description_normalized text not null check (char_length(trim(description_normalized)) > 0),
  amount_minor bigint not null check (amount_minor > 0),
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  category_id uuid references public.finance_categories(id) on delete set null,
  external_id text,
  transaction_hash text not null check (char_length(transaction_hash) = 64),
  installment_current integer check (installment_current >= 1),
  installment_total integer check (installment_total >= installment_current),
  confidence smallint not null check (confidence between 0 and 100),
  review_required boolean not null default false,
  review_reason text,
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  duplicate_status text not null default 'none' check (duplicate_status in ('none', 'candidate', 'excluded', 'accepted')),
  duplicate_candidate_transaction_id uuid references public.finance_transactions(id) on delete set null,
  reimbursement_status text not null default 'none' check (reimbursement_status in ('none', 'suggested', 'accepted', 'dismissed')),
  reimbursement_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (batch_id, source_index),
  unique (batch_id, transaction_hash),
  check ((review_required and review_reason is not null) or not review_required)
);

alter table public.finance_transactions
  add column import_batch_id uuid references public.finance_import_batches(id) on delete restrict,
  add column import_batch_item_id uuid references public.finance_import_batch_items(id) on delete restrict,
  add column external_id text,
  add column transaction_hash text,
  add column description_original text,
  add column description_normalized text,
  add column installment_current integer check (installment_current >= 1),
  add column installment_total integer check (installment_total >= installment_current),
  add column import_confidence smallint check (import_confidence between 0 and 100),
  add column import_review_required boolean not null default false,
  add column import_review_reason text,
  add column import_warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(import_warnings) = 'array'),
  add constraint finance_transactions_import_source_check check (
    (import_batch_id is null and import_batch_item_id is null)
    or (import_batch_id is not null and import_batch_item_id is not null)
  );

create unique index finance_transactions_external_id_idx on public.finance_transactions(user_id, account_id, external_id) where external_id is not null;
create index finance_transactions_hash_idx on public.finance_transactions(user_id, account_id, transaction_hash) where transaction_hash is not null;
create index finance_transactions_import_batch_idx on public.finance_transactions(import_batch_id);
create index finance_import_batches_user_status_idx on public.finance_import_batches(user_id, status, created_at desc);
create index finance_import_batch_items_batch_idx on public.finance_import_batch_items(batch_id, source_index);

create table public.finance_expense_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_on date not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.finance_expense_group_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expense_group_id uuid not null references public.finance_expense_groups(id) on delete cascade,
  transaction_id uuid not null references public.finance_transactions(id) on delete restrict,
  role text not null check (role in ('original_expense', 'reimbursement', 'adjustment')),
  created_at timestamptz not null default timezone('utc', now()),
  unique(transaction_id)
);

create index finance_expense_groups_user_date_idx on public.finance_expense_groups(user_id, occurred_on desc);
create index finance_expense_group_items_group_idx on public.finance_expense_group_items(expense_group_id);

create function public.validate_finance_import_batch() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare account_user uuid; account_currency text;
begin
  select user_id, currency into account_user, account_currency from public.finance_accounts where id = new.account_id;
  if not found or account_user <> new.user_id or account_currency <> new.currency then raise exception 'La cuenta y la moneda del lote deben pertenecer al usuario y coincidir'; end if;
  return new;
end; $$;

create function public.validate_finance_import_item() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare batch_user uuid; batch_status text; category_user uuid; category_kind text;
begin
  select user_id, status into batch_user, batch_status from public.finance_import_batches where id = new.batch_id;
  if not found or batch_user <> new.user_id or batch_status in ('confirmed', 'cancelled') then raise exception 'El lote no admite cambios'; end if;
  if new.category_id is not null then
    select user_id, category_type into category_user, category_kind from public.finance_categories where id = new.category_id;
    if not found or category_user <> new.user_id or (category_kind <> 'both' and category_kind <> new.transaction_type) then raise exception 'La categoría no corresponde al movimiento importado'; end if;
  end if;
  return new;
end; $$;

create function public.validate_finance_expense_group_item() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare group_user uuid; group_currency text; transaction_user uuid; transaction_type text; account_currency text;
begin
  select user_id, currency into group_user, group_currency from public.finance_expense_groups where id = new.expense_group_id;
  select t.user_id, t.transaction_type, a.currency into transaction_user, transaction_type, account_currency from public.finance_transactions t join public.finance_accounts a on a.id = t.account_id where t.id = new.transaction_id;
  if group_user is null or transaction_user is null or group_user <> new.user_id or transaction_user <> new.user_id or group_currency <> account_currency then raise exception 'El grupo y movimiento deben pertenecer al usuario y tener la misma moneda'; end if;
  if (new.role = 'original_expense' and transaction_type <> 'expense') or (new.role = 'reimbursement' and transaction_type <> 'income') then raise exception 'El rol no coincide con el tipo de movimiento'; end if;
  return new;
end; $$;

create function public.confirm_finance_import_batch(p_batch_id uuid) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare batch_row public.finance_import_batches%rowtype; item_row public.finance_import_batch_items%rowtype; inserted_count integer := 0; transaction_id uuid;
begin
  select * into batch_row from public.finance_import_batches where id = p_batch_id for update;
  if not found or batch_row.user_id <> auth.uid() then raise exception 'Lote no encontrado'; end if;
  if batch_row.status = 'confirmed' then return 0; end if;
  if batch_row.status not in ('reviewing', 'validated', 'failed') then raise exception 'El lote no está listo para confirmar'; end if;
  if exists (select 1 from public.finance_import_batch_items where batch_id = p_batch_id and included and (category_id is null or review_required or duplicate_status = 'candidate')) then raise exception 'Hay movimientos que requieren revisión'; end if;
  update public.finance_import_batches set status = 'confirming', failure_reason = null where id = p_batch_id;
  for item_row in select * from public.finance_import_batch_items where batch_id = p_batch_id and included order by source_index loop
    if item_row.external_id is not null and exists (select 1 from public.finance_transactions where user_id = batch_row.user_id and account_id = batch_row.account_id and external_id = item_row.external_id) then raise exception 'Ya existe un movimiento con el identificador externo %', item_row.external_id; end if;
    insert into public.finance_transactions (user_id, account_id, category_id, transaction_type, amount_minor, status, occurred_at, notes, import_batch_id, import_batch_item_id, external_id, transaction_hash, description_original, description_normalized, installment_current, installment_total, import_confidence, import_review_required, import_review_reason, import_warnings)
    values (batch_row.user_id, batch_row.account_id, item_row.category_id, item_row.transaction_type, item_row.amount_minor, 'confirmed', item_row.occurred_on::timestamptz, item_row.description_original, batch_row.id, item_row.id, item_row.external_id, item_row.transaction_hash, item_row.description_original, item_row.description_normalized, item_row.installment_current, item_row.installment_total, item_row.confidence, item_row.review_required, item_row.review_reason, item_row.warnings) returning id into transaction_id;
    inserted_count := inserted_count + 1;
  end loop;
  update public.finance_import_batches set status = 'confirmed', confirmed_at = timezone('utc', now()), included_items = inserted_count where id = p_batch_id;
  return inserted_count;
exception when others then
  update public.finance_import_batches set status = 'failed', failure_reason = sqlerrm where id = p_batch_id and user_id = auth.uid();
  raise;
end; $$;

create trigger finance_import_batches_updated before update on public.finance_import_batches for each row execute function public.set_updated_at();
create trigger finance_import_batch_items_updated before update on public.finance_import_batch_items for each row execute function public.set_updated_at();
create trigger finance_expense_groups_updated before update on public.finance_expense_groups for each row execute function public.set_updated_at();
create trigger finance_import_batches_validate before insert or update on public.finance_import_batches for each row execute function public.validate_finance_import_batch();
create trigger finance_import_batch_items_validate before insert or update on public.finance_import_batch_items for each row execute function public.validate_finance_import_item();
create trigger finance_expense_group_items_validate before insert or update on public.finance_expense_group_items for each row execute function public.validate_finance_expense_group_item();

alter table public.finance_import_batches enable row level security;
alter table public.finance_import_batch_items enable row level security;
alter table public.finance_expense_groups enable row level security;
alter table public.finance_expense_group_items enable row level security;
create policy "Users manage own finance import batches" on public.finance_import_batches for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own finance import batch items" on public.finance_import_batch_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own finance expense groups" on public.finance_expense_groups for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own finance expense group items" on public.finance_expense_group_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.finance_import_batches, public.finance_import_batch_items, public.finance_expense_groups, public.finance_expense_group_items to authenticated;
grant execute on function public.confirm_finance_import_batch(uuid) to authenticated;
