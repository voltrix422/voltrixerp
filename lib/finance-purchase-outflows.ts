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

export function purchaseLedgerPaidInPeriod(
  entries: Array<{ payments: unknown; createdAt: Date }>,
  start: Date,
  end: Date,
): number {
  let sum = 0
  for (const entry of entries) {
    sum += sumJsonPaymentsInPeriod(entry.payments, start, end, entry.createdAt)
  }
  return sum
}
