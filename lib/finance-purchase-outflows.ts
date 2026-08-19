import { isRentLedgerDbRow } from "@/lib/purchase-ledger"

/** Sum payment rows by payment date within a finance overview period. */
export function sumJsonPaymentsInPeriod(
  payments: unknown,
  start: Date,
  end: Date,
  fallback: Date,
): number {
  if (!Array.isArray(payments)) return 0
  let sum = 0
  for (const raw of payments) {
    if (!raw || typeof raw !== "object") continue
    const p = raw as { amount?: number; date?: string; paymentDate?: string }
    const amount = Number(p.amount) || 0
    if (amount <= 0) continue
    const d = new Date(p.date || p.paymentDate || fallback)
    if (d >= start && d <= end) sum += amount
  }
  return sum
}

function sumAllJsonPayments(payments: unknown, fallback: Date): number {
  if (!Array.isArray(payments)) return 0
  let sum = 0
  for (const raw of payments) {
    if (!raw || typeof raw !== "object") continue
    const amount = Number((raw as { amount?: number }).amount) || 0
    if (amount > 0) sum += amount
  }
  return sum
}

export type PurchaseLedgerPaidSplit = {
  purchases: number
  rents: number
  combined: number
}

type PurchaseLedgerOutflowRow = {
  payments: unknown
  createdAt: Date
  amountPaid?: number
  purchaseScopeId?: string
  transactionType?: string | null
  items?: unknown
  supplierGroups?: unknown
  productName?: string | null
}

function entryPaidInPeriod(
  entry: Pick<PurchaseLedgerOutflowRow, "payments" | "createdAt" | "amountPaid">,
  start: Date,
  end: Date,
): number {
  const inPeriod = sumJsonPaymentsInPeriod(entry.payments, start, end, entry.createdAt)
  if (inPeriod <= 0) return 0
  const amountPaid = Number(entry.amountPaid) || 0
  if (amountPaid <= 0) return inPeriod
  const allLogged = sumAllJsonPayments(entry.payments, entry.createdAt)
  if (allLogged > amountPaid + 0.01) {
    return inPeriod * (amountPaid / allLogged)
  }
  return inPeriod
}

export function purchaseLedgerPaidSplitInPeriod(
  entries: PurchaseLedgerOutflowRow[],
  start: Date,
  end: Date,
  options?: { purchaseScopeId?: string },
): PurchaseLedgerPaidSplit {
  const scopeId = (options?.purchaseScopeId ?? "P1").trim().toUpperCase()
  let purchases = 0
  let rents = 0
  for (const entry of entries) {
    const sid = String(entry.purchaseScopeId ?? "P1").trim().toUpperCase()
    if (scopeId && sid !== scopeId) continue
    const paid = entryPaidInPeriod(entry, start, end)
    if (paid <= 0) continue
    if (isRentLedgerDbRow(entry)) rents += paid
    else purchases += paid
  }
  return { purchases, rents, combined: purchases + rents }
}

export function purchaseLedgerPaidInPeriod(
  entries: PurchaseLedgerOutflowRow[],
  start: Date,
  end: Date,
  options?: { purchaseScopeId?: string },
): number {
  return purchaseLedgerPaidSplitInPeriod(entries, start, end, options).combined
}
