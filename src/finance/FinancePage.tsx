import { useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowDownRight, ArrowUpRight, CalendarDays, Eye, EyeOff, Landmark, PiggyBank, Plus, WalletCards } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuth } from '../auth/AuthProvider'
import { useLocation } from 'react-router-dom'
import { currentFinanceMonth, financeDateMonth, financeSummary, formatMoney, fromMinor, toMinor, useFinance, useFinanceMutations, type Account, type Category, type Transaction } from './finance'

const donutColors = ['#60a5fa', '#818cf8', '#38bdf8', '#2dd4bf', '#fbbf24', '#fb7185']

export function FinancePage() {
  const { user } = useAuth()
  const location = useLocation()
  const [month, setMonth] = useState(currentFinanceMonth)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [open, setOpen] = useState(() => (location.state as { openAction?: string } | null)?.openAction === 'transaction')
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending'>('all')
  const query = useFinance(user?.id, month)
  const mutations = useFinanceMutations(user?.id, month)

  if (query.isLoading) return <div className="page"><div className="tasks-state">Cargando finanzas…</div></div>
  if (query.error || !query.data) return <div className="page"><div className="tasks-state tasks-state--error">No se pudieron cargar las finanzas.</div></div>

  const data = query.data
  const summary = financeSummary(data, month)
  const hideAmounts = data.preferences?.hide_amounts ?? false
  const expenses = data.categories.filter((category) => category.is_active && (category.category_type === 'expense' || category.category_type === 'both'))
  const categoryById = new Map(data.categories.map((category) => [category.id, category]))
  const chartData = [...summary.expenseByCategory.entries()].map(([categoryId, amount]) => ({ name: categoryById.get(categoryId)?.name ?? 'Sin categoría', amount })).sort((a, b) => b.amount - a.amount)
  const visibleTransactions = data.transactions.filter((transaction) => financeDateMonth(transaction.occurred_at) === month && (statusFilter === 'all' || transaction.status === statusFilter))

  return <div className="page finance-dashboard">
    <header className="page-header finance-header">
      <div><p className="eyebrow">Pilar personal</p><h1>Finanzas</h1><p className="page-description">Flujo, gasto y presupuesto del mes.</p></div>
      <div className="finance-header-actions">
        <label className="month-picker"><CalendarDays size={17} /><span>Período</span><input aria-label="Período" onChange={(event) => setMonth(event.target.value)} type="month" value={month} /></label>
        <button aria-pressed={hideAmounts} className="secondary-button finance-visibility" onClick={() => mutations.preferences.mutate(!hideAmounts)} type="button">{hideAmounts ? <Eye size={17} /> : <EyeOff size={17} />}{hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}</button>
        <button className="primary-button" onClick={() => { setEditing(null); setOpen(true) }} type="button"><Plus size={18} />Registrar movimiento</button>
      </div>
    </header>

    {open && <TransactionForm accounts={data.accounts.filter((account) => account.is_active)} categories={data.categories.filter((category) => category.is_active)} item={editing ?? undefined} onCancel={() => setOpen(false)} onSave={async (input) => { await mutations.transaction.mutateAsync({ row: editing?.id, input }); setOpen(false) }} />}

    <section aria-label="Indicadores de finanzas" className="finance-kpi-grid">
      <Kpi icon={<WalletCards />} label="Balance total" value={<Money hidden={hideAmounts} value={summary.total} />} detail="Liquidez operativa confirmada" />
      <Kpi icon={<ArrowUpRight />} label="Ingresos del mes" tone="teal" value={<Money hidden={hideAmounts} value={summary.income} />} detail="Solo movimientos confirmados" />
      <Kpi icon={<ArrowDownRight />} label="Gastos del mes" tone="amber" value={<Money hidden={hideAmounts} value={summary.expense} />} detail="Solo movimientos confirmados" />
      <Kpi icon={<Landmark />} label="Resultado neto" tone={summary.net >= 0 ? 'sky' : 'rose'} value={<Money hidden={hideAmounts} value={summary.net} />} detail="Ingresos menos gastos" />
      <Kpi icon={<CalendarDays />} label="Disponible diario" tone="violet" value={summary.dailyAvailable === null ? 'Configurá presupuesto' : <Money hidden={hideAmounts} value={summary.dailyAvailable} />} detail={summary.dailyAvailable === null ? 'Requiere límites por categoría' : `${summary.remainingDays} días restantes`} />
      <Kpi icon={<PiggyBank />} label="Patrimonio neto" tone="slate" value="No disponible" detail="Requiere activos y pasivos" />
    </section>

    <section className="finance-chart-grid">
      <article className="content-card finance-chart-card"><div className="section-heading"><div><p className="eyebrow">Flujo de dinero</p><h2>Resultado mensual</h2></div><span className={summary.net >= 0 ? 'finance-chip finance-chip--good' : 'finance-chip finance-chip--alert'}>{summary.net >= 0 ? 'Positivo' : 'Negativo'}</span></div><div className="finance-flow"><FlowRow label="Ingresos" value={summary.income} hidden={hideAmounts} tone="income" /><FlowRow label="Gastos" value={summary.expense} hidden={hideAmounts} tone="expense" /><div className="finance-flow-total"><span>Resultado neto</span><Money hidden={hideAmounts} value={summary.net} /></div></div></article>
      <article className="content-card finance-chart-card"><div className="section-heading"><div><p className="eyebrow">Gastos confirmados</p><h2>Distribución por categoría</h2></div></div>{chartData.length ? <div className="finance-donut"><ResponsiveContainer height="100%" width="100%"><PieChart><Pie data={chartData} dataKey="amount" innerRadius={58} outerRadius={86} paddingAngle={3}>{chartData.map((entry, index) => <Cell fill={donutColors[index % donutColors.length]} key={entry.name} />)}</Pie><Tooltip formatter={(value) => hideAmounts ? '••••' : formatMoney(Number(value))} /></PieChart></ResponsiveContainer><div className="finance-donut-legend">{chartData.slice(0, 4).map((entry, index) => <div key={entry.name}><i style={{ background: donutColors[index % donutColors.length] }} /><span>{entry.name}</span><Money hidden={hideAmounts} value={entry.amount} /></div>)}</div></div> : <EmptyFinanceState label="Todavía no hay gastos confirmados con presupuesto este mes." />}</article>
    </section>

    <section className="finance-lower-grid">
      <article className="content-card"><div className="section-heading"><div><p className="eyebrow">Control del gasto</p><h2>Presupuesto por categoría</h2></div><span className="section-status">{data.allocations.length} configurados</span></div><BudgetPanel categories={expenses} hidden={hideAmounts} limits={summary.budgetByCategory} spent={summary.expenseByCategory} onSave={(categoryId, limitMinor) => mutations.allocation.mutate({ categoryId, limitMinor })} saving={mutations.allocation.isPending} /></article>
      <article className="content-card"><div className="section-heading"><div><p className="eyebrow">Actividad</p><h2>Movimientos del período</h2></div><div className="finance-filter"><button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')} type="button">Todos</button><button className={statusFilter === 'confirmed' ? 'active' : ''} onClick={() => setStatusFilter('confirmed')} type="button">Confirmados</button><button className={statusFilter === 'pending' ? 'active' : ''} onClick={() => setStatusFilter('pending')} type="button">Pendientes</button></div></div>{visibleTransactions.length ? <div className="finance-transaction-list">{visibleTransactions.map((transaction) => <TransactionRow account={data.accounts.find((item) => item.id === transaction.account_id)} category={transaction.category_id ? categoryById.get(transaction.category_id) : undefined} hidden={hideAmounts} key={transaction.id} onEdit={() => { setEditing(transaction); setOpen(true) }} transaction={transaction} />)}</div> : <EmptyFinanceState label="No hay movimientos para este filtro." />}</article>
    </section>
    {summary.pending.length > 0 && <p className="finance-pending-note"><AlertCircle size={17} />{summary.pending.length} movimiento{summary.pending.length === 1 ? '' : 's'} pendiente{summary.pending.length === 1 ? '' : 's'}: se muestran en actividad, pero no afectan saldos ni presupuesto.</p>}
  </div>
}

function Money({ hidden, value }: { hidden: boolean; value: number }) { return <span aria-label={hidden ? 'Importe oculto' : formatMoney(value)}>{hidden ? '••••' : formatMoney(value)}</span> }
function Kpi({ detail, icon, label, tone = 'blue', value }: { detail: string; icon: React.ReactNode; label: string; tone?: string; value: React.ReactNode }) { return <article className={`finance-kpi finance-kpi--${tone}`}><span className="finance-kpi-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article> }
function FlowRow({ hidden, label, tone, value }: { hidden: boolean; label: string; tone: string; value: number }) { return <div className={`finance-flow-row finance-flow-row--${tone}`}><span>{label}</span><Money hidden={hidden} value={value} /></div> }
function EmptyFinanceState({ label }: { label: string }) { return <div className="finance-empty">{label}</div> }

function BudgetPanel({ categories, hidden, limits, spent, onSave, saving }: { categories: Category[]; hidden: boolean; limits: Map<string, number>; spent: Map<string, number>; onSave: (categoryId: string, limitMinor: number) => void; saving: boolean }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  if (!categories.length) return <EmptyFinanceState label="Creá categorías de gasto antes de configurar presupuestos." />
  const startEditing = (category: Category) => { setEditing(category.id); setAmount(limits.has(category.id) ? fromMinor(limits.get(category.id) ?? 0) : '') }
  return <div className="budget-list">{categories.map((category) => {
    const limit = limits.get(category.id)
    const used = spent.get(category.id) ?? 0
    const percent = limit ? Math.round((used / limit) * 100) : null
    const state = percent === null ? 'Sin presupuesto' : percent > 100 ? 'Excedido' : percent >= 80 ? 'Atención' : 'En rango'
    return <div className="budget-item" key={category.id}><div className="budget-item-heading"><strong>{category.name}</strong><span className={`budget-state budget-state--${state === 'En rango' ? 'good' : state === 'Atención' ? 'warn' : state === 'Excedido' ? 'bad' : 'none'}`}>{state}</span></div>{editing === category.id ? <form className="budget-form" onSubmit={(event) => { event.preventDefault(); const minor = toMinor(amount); if (Number.isFinite(minor) && minor > 0) { onSave(category.id, minor); setEditing(null) } }}><input aria-label={`Límite para ${category.name}`} autoFocus inputMode="decimal" min="0.01" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} /><button disabled={saving} type="submit">Guardar</button><button onClick={() => setEditing(null)} type="button">Cancelar</button></form> : <><div className="budget-values"><Money hidden={hidden} value={used} /><span>de</span>{limit ? <Money hidden={hidden} value={limit} /> : <span>Sin límite</span>}<button className="text-button" onClick={() => startEditing(category)} type="button">{limit ? 'Editar' : 'Definir'}</button></div><div aria-label={`${category.name}: ${state}${percent === null ? '' : `, ${percent}% consumido`}`} className="budget-progress"><i style={{ width: `${Math.min(percent ?? 0, 100)}%` }} /></div>{percent !== null && <small>{percent}% consumido</small>}</>}</div>
  })}</div>
}

function TransactionRow({ account, category, hidden, onEdit, transaction }: { account?: Account; category?: Category; hidden: boolean; onEdit: () => void; transaction: Transaction }) { return <article className="finance-transaction"><div><strong className={transaction.transaction_type === 'income' ? 'transaction-income' : 'transaction-expense'}>{transaction.transaction_type === 'income' ? '+' : '−'} <Money hidden={hidden} value={transaction.amount_minor} /></strong><p>{category?.name ?? 'Sin categoría'} · {account?.name ?? 'Cuenta eliminada'} · {new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(transaction.occurred_at))}</p>{transaction.notes && <small>{transaction.notes}</small>}</div><div className="finance-transaction-actions"><span className={transaction.status === 'confirmed' ? 'finance-chip finance-chip--good' : 'finance-chip finance-chip--pending'}>{transaction.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}</span><button className="text-button" onClick={onEdit} type="button">Editar</button></div></article> }

type TransactionInput = Pick<Transaction, 'account_id' | 'category_id' | 'transaction_type' | 'amount_minor' | 'status' | 'occurred_at' | 'notes'>
function TransactionForm({ accounts, categories, item, onCancel, onSave }: { accounts: Account[]; categories: Category[]; item?: Transaction; onCancel: () => void; onSave: (input: TransactionInput) => Promise<void> }) {
  const [type, setType] = useState(item?.transaction_type ?? 'expense')
  const [account, setAccount] = useState(item?.account_id ?? accounts[0]?.id ?? '')
  const [category, setCategory] = useState(item?.category_id ?? '')
  const [amount, setAmount] = useState(item ? fromMinor(item.amount_minor) : '')
  const [status, setStatus] = useState(item?.status ?? 'confirmed')
  const [date, setDate] = useState(item ? new Date(item.occurred_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState(item?.notes ?? '')
  const compatible = useMemo(() => categories.filter((entry) => entry.category_type === 'both' || entry.category_type === type), [categories, type])
  const categoryValid = compatible.some((entry) => entry.id === category)
  const submit = async (event: FormEvent) => { event.preventDefault(); const amountMinor = toMinor(amount); if (!categoryValid || !account || !Number.isFinite(amountMinor) || amountMinor <= 0) return; await onSave({ account_id: account, category_id: category, transaction_type: type, amount_minor: amountMinor, status, occurred_at: new Date(date).toISOString(), notes: notes.trim() || null }) }
  return <form className="task-form" onSubmit={submit}><div className="task-form-heading"><h2>{item ? 'Editar movimiento' : 'Registrar movimiento'}</h2></div><div className="task-form-grid"><label>Tipo<select onChange={(event) => { setType(event.target.value); if (!categories.some((entry) => entry.id === category && (entry.category_type === 'both' || entry.category_type === event.target.value))) setCategory('') }} value={type}><option value="income">Ingreso</option><option value="expense">Gasto</option></select></label><label>Importe<input inputMode="decimal" min="0.01" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} /></label><label>Cuenta<select onChange={(event) => setAccount(event.target.value)} required value={account}><option value="">Seleccioná una cuenta</option>{accounts.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>Fecha<input onChange={(event) => setDate(event.target.value)} required type="datetime-local" value={date} /></label><label>Estado<select onChange={(event) => setStatus(event.target.value)} value={status}><option value="confirmed">Confirmado</option><option value="pending">Pendiente</option></select></label><label>Categoría<select disabled={!compatible.length} onChange={(event) => setCategory(event.target.value)} required value={category}><option value="">Seleccioná una categoría</option>{compatible.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></div><label>Nota opcional<textarea onChange={(event) => setNotes(event.target.value)} value={notes} /></label>{!categoryValid && <p className="form-error">Seleccioná una categoría compatible.</p>}<div className="task-form-actions"><button className="secondary-button" onClick={onCancel} type="button">Cancelar</button><button className="primary-button" disabled={!categoryValid || !account} type="submit">Guardar</button></div></form>
}
