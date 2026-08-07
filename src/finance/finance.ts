import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type Account = Database['public']['Tables']['finance_accounts']['Row']
export type Category = Database['public']['Tables']['finance_categories']['Row']
export type Transaction = Database['public']['Tables']['finance_transactions']['Row']
export type BudgetPeriod = Database['public']['Tables']['finance_budget_periods']['Row']
export type BudgetAllocation = Database['public']['Tables']['finance_budget_allocations']['Row']
export type FinancePreferences = Database['public']['Tables']['finance_preferences']['Row']
export type FinanceImportBatch = Database['public']['Tables']['finance_import_batches']['Row']
export type FinanceImportBatchItem = Database['public']['Tables']['finance_import_batch_items']['Row']
export type ExpenseGroup = Database['public']['Tables']['finance_expense_groups']['Row']
export type CardInstallment = Database['public']['Tables']['finance_card_installments']['Row']

type FinanceData = { accounts: Account[]; categories: Category[]; transactions: Transaction[]; period: BudgetPeriod | null; allocations: BudgetAllocation[]; preferences: FinancePreferences | null; cardInstallments: CardInstallment[] }

const need = <T,>(result: { data: T | null; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error('Sin respuesta.')
  return result.data
}
const optional = <T,>(result: { data: T | null; error: { message: string } | null }): T | null => {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export const financeKey = (userId: string, month: string) => ['finance', userId, month] as const
export const financeMonthStart = (month: string) => `${month}-01`
export const financeDateMonth = (value: Date | string) => {
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit' }).formatToParts(new Date(value))
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}
export const currentFinanceMonth = () => financeDateMonth(new Date())

export function toMinor(value: number | string): number {
  const normalized = String(value).trim().replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return Number.NaN
  const [whole, decimal = ''] = normalized.split('.')
  return Number(whole) * 100 + Number(`${decimal}00`.slice(0, 2))
}

export const fromMinor = (value: number) => (value / 100).toFixed(2)
export const formatMoney = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(value / 100)

const isMonth = (value: string, month: string) => financeDateMonth(value) === month
const sum = (rows: Transaction[], type: string) => rows.filter((row) => row.transaction_type === type).reduce((total, row) => total + row.amount_minor, 0)

export function financeSummary(data: FinanceData, month: string) {
  const confirmed = data.transactions.filter((transaction) => transaction.status === 'confirmed')
  const current = confirmed.filter((transaction) => isMonth(transaction.occurred_at, month))
  const income = sum(current, 'income')
  const expense = sum(current, 'expense')
  const balances = new Map(data.accounts.map((account) => {
    const accountTransactions = confirmed.filter((transaction) => transaction.account_id === account.id)
    return [account.id, account.opening_balance_minor + sum(accountTransactions, 'income') - sum(accountTransactions, 'expense')]
  }))
  const total = data.accounts.filter((account) => account.is_active && account.balance_role === 'operational').reduce((totalBalance, account) => totalBalance + (balances.get(account.id) ?? 0), 0)
  const budgetByCategory = new Map(data.allocations.map((allocation) => [allocation.category_id, allocation.limit_minor]))
  const expenseByCategory = new Map<string, number>()
  const allExpenseByCategory = new Map<string, number>()
  current.filter((transaction) => transaction.transaction_type === 'expense' && transaction.category_id).forEach((transaction) => {
    const categoryId = transaction.category_id!
    allExpenseByCategory.set(categoryId, (allExpenseByCategory.get(categoryId) ?? 0) + transaction.amount_minor)
    if (budgetByCategory.has(categoryId)) expenseByCategory.set(categoryId, (expenseByCategory.get(categoryId) ?? 0) + transaction.amount_minor)
  })
  const budgetTotal = [...budgetByCategory.values()].reduce((totalLimit, limit) => totalLimit + limit, 0)
  const budgetSpent = [...expenseByCategory.values()].reduce((totalSpent, amount) => totalSpent + amount, 0)
  const today = new Date()
  const isCurrent = month === currentFinanceMonth()
  const remainingDays = isCurrent ? new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1 : 0
  const pending = data.transactions.filter((transaction) => transaction.status === 'pending' && isMonth(transaction.occurred_at, month))
  return { income, expense, net: income - expense, total, balances, budgetByCategory, expenseByCategory, allExpenseByCategory, budgetTotal, budgetSpent, dailyAvailable: budgetTotal > 0 && remainingDays > 0 ? Math.floor((budgetTotal - budgetSpent) / remainingDays) : null, pending, remainingDays, isCurrent }
}

export function useFinance(userId: string | undefined, month: string) {
  return useQuery({
    queryKey: financeKey(userId ?? '', month),
    enabled: Boolean(userId),
    retry: false,
    queryFn: async (): Promise<FinanceData> => {
      const [accounts, categories, transactions, period, preferences, cardInstallments] = await Promise.all([
        supabase.from('finance_accounts').select('*').eq('user_id', userId!).order('name'),
        supabase.from('finance_categories').select('*').eq('user_id', userId!).order('name'),
        supabase.from('finance_transactions').select('*').eq('user_id', userId!).order('occurred_at', { ascending: false }),
        supabase.from('finance_budget_periods').select('*').eq('user_id', userId!).eq('month_start', financeMonthStart(month)).maybeSingle(),
        supabase.from('finance_preferences').select('*').eq('user_id', userId!).maybeSingle(),
        supabase.from('finance_card_installments').select('*').eq('user_id', userId!).eq('status', 'active').order('due_on'),
      ])
      const budgetPeriod = optional(period)
      const allocations = budgetPeriod
        ? need(await supabase.from('finance_budget_allocations').select('*').eq('user_id', userId!).eq('budget_period_id', budgetPeriod.id))
        : []
      return { accounts: need(accounts), categories: need(categories), transactions: need(transactions), period: budgetPeriod, allocations, preferences: optional(preferences), cardInstallments: need(cardInstallments) }
    },
  })
}

export function useFinanceMutations(userId: string | undefined, month: string) {
  const client = useQueryClient()
  const invalidate = async () => { if (userId) await client.invalidateQueries({ queryKey: ['finance', userId] }) }
  const transaction = useMutation({
    retry: false,
    mutationFn: async ({ row, input }: { row?: string; input: Pick<Transaction, 'account_id' | 'category_id' | 'transaction_type' | 'amount_minor' | 'status' | 'occurred_at' | 'notes'> }) => row
      ? need(await supabase.from('finance_transactions').update(input).eq('id', row).eq('user_id', userId!).select().single())
      : need(await supabase.from('finance_transactions').insert({ ...input, user_id: userId! }).select().single()),
    onSuccess: invalidate,
  })
  const deleteTransaction = useMutation({
    retry: false,
    mutationFn: async (id: string) => { const result = await supabase.from('finance_transactions').delete().eq('id', id).eq('user_id', userId!); if (result.error) throw new Error(result.error.message) },
    onSuccess: invalidate,
  })
  const allocation = useMutation({
    retry: false,
    mutationFn: async ({ categoryId, limitMinor }: { categoryId: string; limitMinor: number }) => {
      const period = optional(await supabase.from('finance_budget_periods').select('*').eq('user_id', userId!).eq('month_start', financeMonthStart(month)).maybeSingle())
      const budgetPeriod = period ?? need<BudgetPeriod>(await supabase.from('finance_budget_periods').insert({ user_id: userId!, month_start: financeMonthStart(month) }).select().single())
      return need(await supabase.from('finance_budget_allocations').upsert({ user_id: userId!, budget_period_id: budgetPeriod.id, category_id: categoryId, limit_minor: limitMinor }, { onConflict: 'budget_period_id,category_id' }).select().single())
    },
    onSuccess: invalidate,
  })
  const preferences = useMutation({
    retry: false,
    mutationFn: async (hideAmounts: boolean) => need(await supabase.from('finance_preferences').upsert({ user_id: userId!, hide_amounts: hideAmounts }).select().single()),
    onSuccess: invalidate,
  })
  const category = useMutation({
    retry: false,
    mutationFn: async ({ name, categoryType }: { name: string; categoryType: 'income' | 'expense' | 'both' }) => need(await supabase.from('finance_categories').insert({ user_id: userId!, name: name.trim(), category_type: categoryType }).select().single()),
    onSuccess: invalidate,
  })
  const card = useMutation({
    retry: false,
    mutationFn: async (name: string) => need(await supabase.from('finance_accounts').insert({ user_id: userId!, name: name.trim(), account_type: 'credit_card', currency: 'ARS', balance_role: 'liability' }).select().single()),
    onSuccess: invalidate,
  })
  const updateCard = useMutation({
    retry: false,
    mutationFn: async ({ id, name }: { id: string; name: string }) => need(await supabase.from('finance_accounts').update({ name: name.trim() }).eq('id', id).eq('user_id', userId!).select().single()),
    onSuccess: invalidate,
  })
  const cardInstallment = useMutation({
    retry: false,
    mutationFn: async (input: Omit<Database['public']['Tables']['finance_card_installments']['Insert'], 'user_id'>) => need(await supabase.from('finance_card_installments').insert({ ...input, user_id: userId! }).select().single()),
    onSuccess: invalidate,
  })
  const updateCardInstallment = useMutation({
    retry: false,
    mutationFn: async ({ id, input }: { id: string; input: Database['public']['Tables']['finance_card_installments']['Update'] }) => need(await supabase.from('finance_card_installments').update(input).eq('id', id).eq('user_id', userId!).select().single()),
    onSuccess: invalidate,
  })
  const deleteCardInstallment = useMutation({
    retry: false,
    mutationFn: async (id: string) => { const result = await supabase.from('finance_card_installments').delete().eq('id', id).eq('user_id', userId!); if (result.error) throw new Error(result.error.message) },
    onSuccess: invalidate,
  })
  return { transaction, deleteTransaction, allocation, preferences, category, card, updateCard, cardInstallment, updateCardInstallment, deleteCardInstallment }
}

export const financeImportKey = (userId: string, batchId?: string) => batchId ? ['finance-import-batch', userId, batchId] as const : ['finance-imports', userId] as const

export function useFinanceImportMutations(userId: string | undefined) {
  const client = useQueryClient()
  const invalidate = async (batchId?: string) => {
    if (!userId) return
    await Promise.all([client.invalidateQueries({ queryKey: ['finance-imports', userId] }), client.invalidateQueries({ queryKey: ['finance-import-batch', userId, batchId] })])
  }
  const createBatch = useMutation({
    retry: false,
    mutationFn: async (input: Omit<Database['public']['Tables']['finance_import_batches']['Insert'], 'user_id'>) => {
      const inserted = await supabase.from('finance_import_batches').insert({ ...input, user_id: userId! }).select().maybeSingle()
      if (!inserted.error && inserted.data) return inserted.data
      if (inserted.error?.code !== '23505') throw new Error(inserted.error?.message ?? 'No se pudo crear el lote.')
      const existing = await supabase.from('finance_import_batches').select('*').eq('user_id', userId!).eq('account_id', input.account_id).eq('payload_hash', input.payload_hash).single()
      return need(existing)
    },
    onSuccess: (batch) => invalidate(batch.id),
  })
  const replaceItems = useMutation({
    retry: false,
    mutationFn: async ({ batchId, items }: { batchId: string; items: Omit<Database['public']['Tables']['finance_import_batch_items']['Insert'], 'user_id' | 'batch_id'>[] }) => {
      const existing = await supabase.from('finance_import_batches').select('status').eq('id', batchId).eq('user_id', userId!).single()
      const status = need(existing).status
      if (status === 'confirmed' || status === 'cancelled') throw new Error('Este lote ya no puede modificarse.')
      const deleted = await supabase.from('finance_import_batch_items').delete().eq('batch_id', batchId).eq('user_id', userId!)
      if (deleted.error) throw new Error(deleted.error.message)
      if (items.length) return need(await supabase.from('finance_import_batch_items').insert(items.map((item) => ({ ...item, batch_id: batchId, user_id: userId! }))).select())
      return []
    },
    onSuccess: (_, variables) => invalidate(variables.batchId),
  })
  const updateItem = useMutation({
    retry: false,
    mutationFn: async ({ id, input }: { id: string; input: Database['public']['Tables']['finance_import_batch_items']['Update'] }) => need<FinanceImportBatchItem>(await supabase.from('finance_import_batch_items').update(input).eq('id', id).eq('user_id', userId!).select().single()),
    onSuccess: (_, variables) => invalidate(variables.id),
  })
  const cancelBatch = useMutation({
    retry: false,
    mutationFn: async (id: string) => need<FinanceImportBatch>(await supabase.from('finance_import_batches').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId!).select().single()),
    onSuccess: (_, id) => invalidate(id),
  })
  const reopenBatch = useMutation({
    retry: false,
    mutationFn: async (id: string) => need<FinanceImportBatch>(await supabase.from('finance_import_batches').update({ status: 'reviewing', cancelled_at: null, failure_reason: null }).eq('id', id).eq('user_id', userId!).select().single()),
    onSuccess: (_, id) => invalidate(id),
  })
  const confirmBatch = useMutation({
    retry: false,
    mutationFn: async (id: string) => need(await supabase.rpc('confirm_finance_import_batch', { p_batch_id: id })),
    onSuccess: async () => { if (userId) await Promise.all([client.invalidateQueries({ queryKey: ['finance', userId] }), invalidate()]) },
  })
  const createExpenseGroup = useMutation({
    retry: false,
    mutationFn: async ({ group, items }: { group: Omit<Database['public']['Tables']['finance_expense_groups']['Insert'], 'user_id'>; items: { transaction_id: string; role: 'original_expense' | 'reimbursement' | 'adjustment' }[] }) => {
      const created = need<ExpenseGroup>(await supabase.from('finance_expense_groups').insert({ ...group, user_id: userId! }).select().single())
      if (!created) throw new Error('No se pudo crear el grupo.')
      if (items.length) need(await supabase.from('finance_expense_group_items').insert(items.map((item) => ({ ...item, user_id: userId!, expense_group_id: created.id }))).select())
      return created
    },
    onSuccess: () => { if (userId) client.invalidateQueries({ queryKey: ['finance', userId] }) },
  })
  return { createBatch, replaceItems, updateItem, cancelBatch, reopenBatch, confirmBatch, createExpenseGroup }
}
