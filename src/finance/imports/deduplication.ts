import type { Transaction } from '../finance'
import { normalizeDescription } from './importSchema'

export type DuplicateMatch = { transaction: Transaction; reason: string }

export function findDuplicate(transaction: Pick<Transaction, 'account_id' | 'transaction_type' | 'amount_minor'> & { occurred_on: string; description_normalized: string; external_id: string | null }, existing: Transaction[]): DuplicateMatch | null {
  const sameAccount = existing.filter((row) => row.account_id === transaction.account_id)
  if (transaction.external_id) {
    const external = sameAccount.find((row) => row.external_id === transaction.external_id)
    if (external) return { transaction: external, reason: 'Coincide el identificador externo.' }
  }
  const candidate = sameAccount.find((row) => {
    const days = Math.abs(new Date(row.occurred_at).getTime() - new Date(`${transaction.occurred_on}T00:00:00Z`).getTime()) / 86_400_000
    const description = normalizeDescription(row.description_normalized ?? row.description_original ?? row.notes ?? '')
    return row.transaction_type === transaction.transaction_type && row.amount_minor === transaction.amount_minor && days <= 2 && description === normalizeDescription(transaction.description_normalized)
  })
  return candidate ? { transaction: candidate, reason: 'Coinciden cuenta, tipo, importe, fecha cercana y descripción.' } : null
}
