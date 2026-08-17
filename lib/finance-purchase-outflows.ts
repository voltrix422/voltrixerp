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

export function purchaseLedgerPaidInPeriod(
  entries: Array<{ payments: unknown; createdAt: Date; amountPaid?: number }>,
  start: Date,
  end: Date,
): number {
  let sum = 0
  for (const entry of entries) {
    const inPeriod = sumJsonPaymentsInPeriod(entry.payments, start, end, entry.createdAt)
    if (inPeriod <= 0) continue
    const amountPaid = Number(entry.amountPaid) || 0
    if (amountPaid <= 0) {
      sum += inPeriod
      continue
    }
    const allLogged = sumAllJsonPayments(entry.payments, entry.createdAt)
    if (allLogged > amountPaid + 0.01) {
      sum += inPeriod * (amountPaid / allLogged)
    } else {
      sum += inPeriod
    }
  }
  return sum
}
