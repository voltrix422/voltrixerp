import type { MoneyOutDetailLine } from "@/lib/finance-money-out-details"

/** Matches finance record categories used by the loan center. */
export const LOAN_CATEGORIES = ["Loan", "Loan Given", "Loan Repayment", "Loan Recovery"] as const

export const LOAN_IN_CATEGORIES = new Set(["Loan", "Loan Recovery"])
export const LOAN_OUT_CATEGORIES = new Set(["Loan Given", "Loan Repayment"])

export function isLoanCategory(category: string): boolean {
  return (LOAN_CATEGORIES as readonly string[]).includes(category)
}

/** Legacy loans stored the person inside the title, e.g. "Syed Tauseef Raza Loan 1". */
export function loanPersonName(r: { loan_person?: string | null; title: string }): string {
  const explicit = (r.loan_person || "").trim()
  if (explicit) return explicit
  const cleaned = r.title.replace(/\s*[-—–:]?\s*Loan(\s*(received|given|returned|\d+))?\s*$/i, "").trim()
  return cleaned || r.title.trim()
}

export type LoanFinanceRecord = {
  id: string
  title: string
  amount: number
  category: string
  tag?: string | null
  notes?: string | null
  createdAt: Date | string
  loan_person?: string | null
}

export type LoanSnapshot = {
  receivedInPeriod: number
  recoveredInPeriod: number
  givenInPeriod: number
  repaidInPeriod: number
  moneyIn: number
  moneyOut: number
  weOwe: number
  theyOwe: number
  peopleCount: number
}

function inRange(d: Date, start: Date, end: Date) {
  return d >= start && d <= end
}

export function summarizeLoans(
  records: LoanFinanceRecord[],
  start: Date,
  end: Date,
): LoanSnapshot {
  let receivedInPeriod = 0
  let recoveredInPeriod = 0
  let givenInPeriod = 0
  let repaidInPeriod = 0
  let receivedAll = 0
  let recoveredAll = 0
  let givenAll = 0
  let repaidAll = 0
  const people = new Set<string>()

  for (const r of records) {
    if (!isLoanCategory(r.category)) continue
    const name = loanPersonName(r)
    if (name) people.add(name.toLowerCase())
    const amount = Number(r.amount) || 0
    if (r.category === "Loan") receivedAll += amount
    else if (r.category === "Loan Recovery") recoveredAll += amount
    else if (r.category === "Loan Given") givenAll += amount
    else if (r.category === "Loan Repayment") repaidAll += amount

    const d = new Date(r.createdAt)
    if (!inRange(d, start, end)) continue
    if (r.category === "Loan") receivedInPeriod += amount
    else if (r.category === "Loan Recovery") recoveredInPeriod += amount
    else if (r.category === "Loan Given") givenInPeriod += amount
    else if (r.category === "Loan Repayment") repaidInPeriod += amount
  }

  return {
    receivedInPeriod,
    recoveredInPeriod,
    givenInPeriod,
    repaidInPeriod,
    moneyIn: receivedInPeriod + recoveredInPeriod,
    moneyOut: givenInPeriod + repaidInPeriod,
    weOwe: Math.max(0, receivedAll - repaidAll),
    theyOwe: Math.max(0, givenAll - recoveredAll),
    peopleCount: people.size,
  }
}

function fmtDate(iso: Date | string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })
}

const OUT_LABEL: Record<string, string> = {
  "Loan Given": "Loan given",
  "Loan Repayment": "Returned by us",
}

export function buildLoanOutDetails(
  records: LoanFinanceRecord[],
  start: Date,
  end: Date,
): MoneyOutDetailLine[] {
  const lines: MoneyOutDetailLine[] = []
  for (const r of records) {
    if (!LOAN_OUT_CATEGORIES.has(r.category)) continue
    const d = new Date(r.createdAt)
    if (!inRange(d, start, end)) continue
    const amount = Number(r.amount) || 0
    if (amount <= 0) continue
    const person = loanPersonName(r)
    const tag = (r.tag || "").trim()
    lines.push({
      id: r.id,
      label: person || r.title,
      sublabel: [OUT_LABEL[r.category] ?? r.category, tag || r.notes].filter(Boolean).join(" · ") || undefined,
      amount,
      date: fmtDate(r.createdAt),
      href: "/finance?tab=manage&section=finance",
    })
  }
  return lines.sort((a, b) => b.amount - a.amount)
}
