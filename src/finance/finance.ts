import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type Account = Database['public']['Tables']['finance_accounts']['Row']
export type Category = Database['public']['Tables']['finance_categories']['Row']
export type Transaction = Database['public']['Tables']['finance_transactions']['Row']
export type BudgetPeriod = Database['public']['Tables']['finance_budget_periods']['Row']
export type BudgetAllocation = Database['public']['Tables']['finance_budget_allocations']['Row']
export type FinancePreferences = Database['public']['Tables']['finance_preferences']['Row']

type FinanceData = { accounts: Account[]; categories: Category[]; transactions: Transaction[]; period: BudgetPeriod | null; allocations: BudgetAllocation[]; preferences: FinancePreferences | null }

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
  current.filter((transaction) => transaction.transaction_type === 'expense' && transaction.category_id && budgetByCategory.has(transaction.category_id)).forEach((transaction) => {
    const categoryId = transaction.category_id!
    expenseByCategory.set(categoryId, (expenseByCategory.get(categoryId) ?? 0) + transaction.amount_minor)
  })
  const budgetTotal = [...budgetByCategory.values()].reduce((totalLimit, limit) => totalLimit + limit, 0)
  const budgetSpent = [...expenseByCategory.values()].reduce((totalSpent, amount) => totalSpent + amount, 0)
  const today = new Date()
  const isCurrent = month === currentFinanceMonth()
  const remainingDays = isCurrent ? new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1 : 0
  const pending = data.transactions.filter((transaction) => transaction.status === 'pending' && isMonth(transaction.occurred_at, month))
  return { income, expense, net: income - expense, total, balances, budgetByCategory, expenseByCategory, budgetTotal, budgetSpent, dailyAvailable: budgetTotal > 0 && remainingDays > 0 ? Math.floor((budgetTotal - budgetSpent) / remainingDays) : null, pending, remainingDays, isCurrent }
}

export function useFinance(userId: string | undefined, month: string) {
  return useQuery({
    queryKey: financeKey(userId ?? '', month),
    enabled: Boolean(userId),
    retry: false,
    queryFn: async (): Promise<FinanceData> => {
      const [accounts, categories, transactions, period, preferences] = await Promise.all([
        supabase.from('finance_accounts').select('*').eq('user_id', userId!).order('name'),
        supabase.from('finance_categories').select('*').eq('user_id', userId!).order('name'),
        supabase.from('finance_transactions').select('*').eq('user_id', userId!).order('occurred_at', { ascending: false }),
        supabase.from('finance_budget_periods').select('*').eq('user_id', userId!).eq('month_start', financeMonthStart(month)).maybeSingle(),
        supabase.from('finance_preferences').select('*').eq('user_id', userId!).maybeSingle(),
      ])
      const budgetPeriod = optional(period)
      const allocations = budgetPeriod
        ? need(await supabase.from('finance_budget_allocations').select('*').eq('user_id', userId!).eq('budget_period_id', budgetPeriod.id))
        : []
      return { accounts: need(accounts), categories: need(categories), transactions: need(transactions), period: budgetPeriod, allocations, preferences: optional(preferences) }
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
  return { transaction, allocation, preferences }
}
