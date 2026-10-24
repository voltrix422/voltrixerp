import type { FinanceOrderRow } from "@/lib/finance-report-details"

function creditOf(total: number, paid: number) {
  return Math.max(0, (Number(total) || 0) - (Number(paid) || 0))
}

export function crmRowCredit(r: FinanceOrderRow) {
  if (typeof r.creditOutstanding === "number") return Math.max(0, Number(r.creditOutstanding) || 0)
  return creditOf(r.total, r.paidTotal)
}

export function isCrmReturnedRow(r: FinanceOrderRow) {
  return String(r.status || "").toLowerCase() === "returned"
}

export type CrmSalesSplit = {
  active: FinanceOrderRow[]
  returned: FinanceOrderRow[]
  activeTotal: number
  activeReceived: number
  activeCredit: number
  activeCashback: number
  activeCount: number
  /** value − received − credit on active orders (≈ cashback when period is clean). */
  activeCheck: number
  returnedCount: number
  returnedReceived: number
  returnedRefunds: number
  returnedCashback: number
  allCashback: number
}

/** Split CRM sales rows so main totals exclude returns; cashback/refunds stay visible. */
export function splitCrmSalesRows(orders: FinanceOrderRow[]): CrmSalesSplit {
  const active: FinanceOrderRow[] = []
  const returned: FinanceOrderRow[] = []
  for (const r of orders) {
    if (isCrmReturnedRow(r)) returned.push(r)
    else active.push(r)
  }

  const sum = (rows: FinanceOrderRow[], pick: (r: FinanceOrderRow) => number) =>
    rows.reduce((s, r) => s + (pick(r) || 0), 0)

  const activeTotal = sum(active, (r) => Number(r.total) || 0)
  const activeReceived = sum(active, (r) => Number(r.receivedInPeriod) || 0)
  const activeCredit = sum(active, crmRowCredit)
  const activeCashback = sum(active, (r) => Number(r.cashbackInPeriod) || 0)
  const returnedReceived = sum(returned, (r) => Number(r.receivedInPeriod) || 0)
  const returnedRefunds = sum(returned, (r) => Number(r.refundsInPeriod) || 0)
  const returnedCashback = sum(returned, (r) => Number(r.cashbackInPeriod) || 0)
  const allCashback = activeCashback + returnedCashback

  return {
    active,
    returned,
    activeTotal,
    activeReceived,
    activeCredit,
    activeCashback,
    activeCount: active.length,
    activeCheck: activeTotal - activeReceived - activeCredit,
    returnedCount: returned.length,
    returnedReceived,
    returnedRefunds,
    returnedCashback,
    allCashback,
  }
}
