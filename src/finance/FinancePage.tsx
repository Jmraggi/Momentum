import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  financeSummary,
  fromMinor,
  toMinor,
  useFinance,
  useFinanceMutations,
  type Account,
  type Category,
  type Transaction,
} from './finance';

export function FinancePage() {
  const { user } = useAuth();
  const query = useFinance(user?.id);
  const mutations = useFinanceMutations(user?.id);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [open, setOpen] = useState(false);

  if (query.isLoading) return <div className="page"><div className="tasks-state">Cargando finanzas…</div></div>;
  if (query.error || !query.data) return <div className="page"><div className="tasks-state tasks-state--error">No se pudieron cargar las finanzas.</div></div>;

  const summary = financeSummary(query.data);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Pilar personal</p>
          <h1>Finanzas</h1>
          <p className="page-description">Ordená tus movimientos y decisiones.</p>
        </div>
        <button className="primary-button" onClick={() => { setEditing(null); setOpen(true); }} type="button">
          <Plus size={18} />Registrar movimiento
        </button>
      </header>

      {open && (
        <TransactionForm
          accounts={query.data.accounts.filter((account) => account.is_active)}
          categories={query.data.categories.filter((category) => category.is_active)}
          item={editing ?? undefined}
          onCancel={() => setOpen(false)}
          onSave={async (input) => {
            await mutations.transaction.mutateAsync({ row: editing?.id, input });
            setOpen(false);
          }}
        />
      )}

      <section className="weight-summary">
        <Stat label="Saldo total" value={summary.total} />
        <Stat label="Ingresos del mes" value={summary.income} />
        <Stat label="Gastos del mes" value={summary.expense} />
        <Stat label="Balance mensual" value={summary.balance} />
      </section>

      <section className="content-card">
        <h2>Historial</h2>
        {query.data.transactions.length ? (
          <div className="weight-entry-list">
            {query.data.transactions.map((transaction) => (
              <article className="weight-entry" key={transaction.id}>
                <div>
                  <strong>{transaction.transaction_type === 'income' ? '+' : '-'} {fromMinor(toMinor(transaction.amount))}</strong>
                  <p>{transaction.status} · {new Date(transaction.occurred_at).toLocaleDateString('es-AR')}{transaction.notes ? ` · ${transaction.notes}` : ''}</p>
                </div>
                <button className="text-button" onClick={() => { setEditing(transaction); setOpen(true); }} type="button">Editar</button>
              </article>
            ))}
          </div>
        ) : <div className="tasks-state">Todavía no hay movimientos.</div>}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <article className="weight-stat"><p>{label}</p><strong>{fromMinor(value)} ARS</strong></article>;
}

type TransactionInput = Pick<Transaction, 'account_id' | 'category_id' | 'transaction_type' | 'amount' | 'status' | 'occurred_at' | 'notes'>;

function TransactionForm({ accounts, categories, item, onCancel, onSave }: {
  accounts: Account[];
  categories: Category[];
  item?: Transaction;
  onCancel: () => void;
  onSave: (input: TransactionInput) => Promise<void>;
}) {
  const [type, setType] = useState(item?.transaction_type ?? 'expense');
  const [account, setAccount] = useState(item?.account_id ?? accounts[0]?.id ?? '');
  const [category, setCategory] = useState(item?.category_id ?? '');
  const [amount, setAmount] = useState(item ? fromMinor(toMinor(item.amount)) : '');
  const [status, setStatus] = useState(item?.status ?? 'confirmed');
  const [date, setDate] = useState(item ? new Date(item.occurred_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState(item?.notes ?? '');
  const compatible = categories.filter((item) => item.category_type === 'both' || item.category_type === type);
  const categoryValid = compatible.some((item) => item.id === category);

  const changeType = (next: string) => {
    const nextCompatible = categories.filter((item) => item.category_type === 'both' || item.category_type === next);
    setType(next);
    if (!nextCompatible.some((item) => item.id === category)) setCategory('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryValid || !account) return;
    await onSave({
      account_id: account,
      category_id: category,
      transaction_type: type,
      amount: Number(fromMinor(toMinor(amount))),
      status,
      occurred_at: new Date(date).toISOString(),
      notes: notes.trim() || null,
    });
  };

  return (
    <form className="task-form" onSubmit={submit}>
      <div className="task-form-heading"><h2>{item ? 'Editar movimiento' : 'Registrar movimiento'}</h2></div>
      <div className="task-form-grid">
        <label>Tipo
          <select onChange={(event) => changeType(event.target.value)} value={type}>
            <option value="income">Ingreso</option><option value="expense">Gasto</option>
          </select>
        </label>
        <label>Importe<input min="0.01" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} /></label>
        <label>Cuenta
          <select onChange={(event) => setAccount(event.target.value)} required value={account}>
            <option value="">Seleccioná una cuenta</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label>Fecha<input onChange={(event) => setDate(event.target.value)} required type="datetime-local" value={date} /></label>
        <label>Estado
          <select onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="confirmed">Confirmado</option><option value="pending">Pendiente</option>
          </select>
        </label>
        <label>Categoría
          <select disabled={!compatible.length} onChange={(event) => setCategory(event.target.value)} required value={category}>
            <option value="">Seleccioná una categoría</option>
            {compatible.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      </div>
      <label>Nota opcional<textarea onChange={(event) => setNotes(event.target.value)} value={notes} /></label>
      {!compatible.length && (
        <p className="form-error">
          No hay categorías compatibles. <Link to="/finanzas#categorias">Gestioná las categorías</Link> y creá una de {type === 'income' ? 'ingreso' : 'gasto'} antes de guardar.
        </p>
      )}
      {compatible.length > 0 && !categoryValid && <p className="form-error">Seleccioná una categoría compatible.</p>}
      {!account && <p className="form-error">Seleccioná una cuenta antes de guardar.</p>}
      <div className="task-form-actions">
        <button className="secondary-button" onClick={onCancel} type="button">Cancelar</button>
        <button className="primary-button" disabled={!compatible.length || !categoryValid || !account} type="submit">Guardar</button>
      </div>
    </form>
  );
}
