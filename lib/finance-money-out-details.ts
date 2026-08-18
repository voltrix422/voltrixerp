import { parseOrderCashbackPayments } from "@/lib/finance-overview"
import { isCrmErpOrderForPaymentStats } from "@/lib/order-payment-stats"

export type MoneyOutDetailLine = {
  id: string
  label: string
  sublabel?: string
  amount: number
  date?: string
}

function inRange(d: Date, start: Date, end: Date) {
  return d >= start && d <= end
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })
}

export function buildSupplierAdvanceDetails(
  accounts: Array<{
    id: string
    personName: string
    purpose: string
    createdAt: Date
    transactions: unknown
  }>,
  start: Date,
  end: Date,
): MoneyOutDetailLine[] {
  const lines: MoneyOutDetailLine[] = []

  for (const account of accounts) {
    const txns = Array.isArray(account.transactions)
      ? (account.transactions as {
          id?: string
          type?: string
          amount?: number
          date?: string
          createdAt?: string
          description?: string
        }[])
      : []

    for (const [i, t] of txns.entries()) {
      if (t.type !== "deposit") continue
      const amount = Number(t.amount) || 0
      if (amount <= 0) continue
      const dateIso = t.date || t.createdAt || account.createdAt.toISOString()
      const d = new Date(dateIso)
      if (!inRange(d, start, end)) continue

      const desc = String(t.description || "").trim()
      lines.push({
        id: `${account.id}-${t.id || i}`,
        label: account.personName || "Advance account",
        sublabel: desc || account.purpose || undefined,
        amount,
        date: fmtDate(dateIso),
      })
    }
  }

  return lines.sort((a, b) => b.amount - a.amount)
}

type CrmOrderRow = {
  id: string
  orderNumber: string
  clientName: string
  createdAt: Date
  source?: string | null
  notes?: string | null
  branchId?: string | null
  returnPayments?: unknown
  cashbackPayments?: unknown
}

function crmOrders(orders: CrmOrderRow[]) {
  return orders.filter(row =>
    isCrmErpOrderForPaymentStats({
      source: row.source,
      notes: row.notes,
      branchId: row.branchId,
    }),
  )
}

export function buildClientRefundDetails(
  orders: CrmOrderRow[],
  start: Date,
  end: Date,
): MoneyOutDetailLine[] {
  const lines: MoneyOutDetailLine[] = []

  for (const row of crmOrders(orders)) {
    const returnPayments = Array.isArray(row.returnPayments)
      ? (row.returnPayments as { id?: string; amount?: number; date?: string; createdAt?: string; method?: string }[])
      : []

    for (const [i, rp] of returnPayments.entries()) {
      const amount = Number(rp.amount) || 0
      if (amount <= 0) continue
      const dateIso = rp.date || rp.createdAt || row.createdAt.toISOString()
      const d = new Date(dateIso)
      if (!inRange(d, start, end)) continue

      lines.push({
        id: `ref-${row.id}-${rp.id || i}`,
        label: row.orderNumber,
        sublabel: row.clientName,
        amount,
        date: fmtDate(dateIso),
      })
    }
  }

  return lines.sort((a, b) => b.amount - a.amount)
}

export function buildCashbackDetails(
  orders: CrmOrderRow[],
  start: Date,
  end: Date,
): MoneyOutDetailLine[] {
  const lines: MoneyOutDetailLine[] = []

  for (const row of crmOrders(orders)) {
    const cashbackPayments = parseOrderCashbackPayments(row.cashbackPayments)
    for (const cb of cashbackPayments) {
      const amount = Number(cb.amount) || 0
      if (amount <= 0) continue
      const dateIso = cb.date || row.createdAt.toISOString()
      const d = new Date(dateIso)
      if (!inRange(d, start, end)) continue

      lines.push({
        id: `cb-${row.id}-${cb.id}`,
        label: row.orderNumber,
        sublabel: `${row.clientName}${cb.source === "other" ? " · bonus" : ""}`,
        amount,
        date: fmtDate(dateIso),
      })
    }
  }

  return lines.sort((a, b) => b.amount - a.amount)
}

export type MoneyOutDetailsPayload = {
  supplierAdvances: MoneyOutDetailLine[]
  clientRefunds: MoneyOutDetailLine[]
  cashback: MoneyOutDetailLine[]
}

/** Map breakdown row labels to detail lists for hover tooltips. */
export const MONEY_OUT_DETAIL_KEYS: Record<string, keyof MoneyOutDetailsPayload> = {
  "Supplier advances": "supplierAdvances",
  "Client refunds (returns)": "clientRefunds",
  Cashback: "cashback",
}
