create or replace function public.confirm_finance_import_batch(p_batch_id uuid) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare batch_row public.finance_import_batches%rowtype; item_row public.finance_import_batch_items%rowtype; inserted_count integer := 0; transaction_id uuid;
begin
  select * into batch_row from public.finance_import_batches where id = p_batch_id for update;
  if not found or batch_row.user_id <> auth.uid() then raise exception 'Lote no encontrado'; end if;
  if batch_row.status = 'confirmed' then return 0; end if;
  if batch_row.status not in ('reviewing', 'validated', 'failed') then raise exception 'El lote no está listo para confirmar'; end if;
  if exists (select 1 from public.finance_import_batch_items where batch_id = p_batch_id and included and duplicate_status = 'candidate') then raise exception 'Hay posibles duplicados sin resolver'; end if;
  update public.finance_import_batches set status = 'confirming', failure_reason = null where id = p_batch_id;
  for item_row in select * from public.finance_import_batch_items where batch_id = p_batch_id and included order by source_index loop
    if item_row.external_id is not null and exists (select 1 from public.finance_transactions where user_id = batch_row.user_id and account_id = batch_row.account_id and external_id = item_row.external_id) then raise exception 'Ya existe un movimiento con el identificador externo %', item_row.external_id; end if;
    insert into public.finance_transactions (user_id, account_id, category_id, transaction_type, amount_minor, status, occurred_at, notes, import_batch_id, import_batch_item_id, external_id, transaction_hash, description_original, description_normalized, installment_current, installment_total, import_confidence, import_review_required, import_review_reason, import_warnings)
    values (batch_row.user_id, batch_row.account_id, item_row.category_id, item_row.transaction_type, item_row.amount_minor, case when item_row.category_id is null or item_row.review_required then 'pending' else 'confirmed' end, item_row.occurred_on::timestamptz, item_row.description_original, batch_row.id, item_row.id, item_row.external_id, item_row.transaction_hash, item_row.description_original, item_row.description_normalized, item_row.installment_current, item_row.installment_total, item_row.confidence, item_row.review_required, item_row.review_reason, item_row.warnings) returning id into transaction_id;
    inserted_count := inserted_count + 1;
  end loop;
  update public.finance_import_batches set status = 'confirmed', confirmed_at = timezone('utc', now()), included_items = inserted_count where id = p_batch_id;
  return inserted_count;
end; $$;
