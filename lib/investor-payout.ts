export type InvestorRoiPeriod = "3m" | "6m" | "annual"

export const INVESTOR_ROI_PERIODS: { id: InvestorRoiPeriod; label: string; months: number }[] = [
  { id: "3m", label: "3 months", months: 3 },
  { id: "6m", label: "6 months", months: 6 },
  { id: "annual", label: "Annual", months: 12 },
]

export function normalizeInvestorRoiPeriod(raw: unknown): InvestorRoiPeriod {
  const v = String(raw || "").trim().toLowerCase()
  if (v === "3m" || v === "3" || v === "quarter") return "3m"
  if (v === "6m" || v === "6" || v === "half") return "6m"
  return "annual"
}

export function normalizeInvestorInvestedAt(raw: unknown): string {
  const v = String(raw || "").trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return ""
}

export function investorRoiPeriodLabel(period: InvestorRoiPeriod): string {
  return INVESTOR_ROI_PERIODS.find((p) => p.id === period)?.label || "Annual"
}

export function investorPeriodMonths(period: InvestorRoiPeriod): number {
  return INVESTOR_ROI_PERIODS.find((p) => p.id === period)?.months ?? 12
}

/** Calendar months (fractional) between two ISO dates. */
export function monthsBetweenInvestDates(from: string, to: string): number {
  const a = normalizeInvestorInvestedAt(from)
  const b = normalizeInvestorInvestedAt(to)
  if (!a || !b) return 0
  const d0 = new Date(`${a}T12:00:00`)
  const d1 = new Date(`${b}T12:00:00`)
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime()) || d1 <= d0) return 0
  const years = d1.getFullYear() - d0.getFullYear()
  const months = d1.getMonth() - d0.getMonth()
  const days = d1.getDate() - d0.getDate()
  return Math.max(0, years * 12 + months + days / 30)
}

/** End date of a preset term from investedAt. */
export function investorRoiEndDate(investedAt: string, period: InvestorRoiPeriod): string {
  const start = normalizeInvestorInvestedAt(investedAt)
  if (!start) return ""
  const d = new Date(`${start}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  d.setMonth(d.getMonth() + investorPeriodMonths(period))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function formatInvestorDay(iso: string): string {
  const v = normalizeInvestorInvestedAt(iso)
  if (!v) return "—"
  return new Date(`${v}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Resolve from/to dates: custom until wins; else from + preset term. */
export function resolveInvestorTermDates(
  investedAt: string,
  period: InvestorRoiPeriod,
  investedUntil?: string,
): { from: string; to: string; months: number } {
  const from = normalizeInvestorInvestedAt(investedAt)
  let to = normalizeInvestorInvestedAt(investedUntil)
  if (!to && from) to = investorRoiEndDate(from, period)
  const months =
    from && to ? monthsBetweenInvestDates(from, to) : investorPeriodMonths(period)
  return { from, to, months }
}

/** Annual ROI% scaled to the actual date range (or preset term if no dates). */
export function investorPayoutDue(
  investment: number,
  roiPercent: number,
  period: InvestorRoiPeriod,
  investedAt?: string,
  investedUntil?: string,
): number {
  const inv = Number(investment) || 0
  const roi = Number(roiPercent) || 0
  const { months } = resolveInvestorTermDates(investedAt || "", period, investedUntil)
  const m = months > 0 ? months : investorPeriodMonths(period)
  return Math.round(inv * (roi / 100) * (m / 12))
}

export function investorRoiRangeLabel(
  investedAt: string,
  period: InvestorRoiPeriod,
  investedUntil?: string,
): string {
  const { from, to } = resolveInvestorTermDates(investedAt, period, investedUntil)
  const a = formatInvestorDay(from)
  const b = formatInvestorDay(to)
  if (a === "—" || b === "—") return investorRoiPeriodLabel(period)
  return `${a} – ${b}`
}

export function investorPayoutSummary(opts: {
  investment: number
  roiPercent: number
  period: InvestorRoiPeriod
  investedAt?: string
  investedUntil?: string
}) {
  const { from, to, months } = resolveInvestorTermDates(
    opts.investedAt || "",
    opts.period,
    opts.investedUntil,
  )
  const due = investorPayoutDue(
    opts.investment,
    opts.roiPercent,
    opts.period,
    opts.investedAt,
    opts.investedUntil,
  )
  const m = months > 0 ? months : investorPeriodMonths(opts.period)
  const rangeLabel = investorRoiRangeLabel(opts.investedAt || "", opts.period, opts.investedUntil)
  const monthsLabel =
    Math.abs(m - Math.round(m)) < 0.05
      ? `${Math.round(m)} month${Math.round(m) === 1 ? "" : "s"}`
      : `${m.toLocaleString("en-PK", { maximumFractionDigits: 1 })} months`
  return {
    due,
    from,
    to,
    months: m,
    monthsLabel,
    rangeLabel,
    configured: Number(opts.investment) > 0 && Number(opts.roiPercent) > 0,
  }
}

export function formatInvestorRs(value: number): string {
  const n = Math.round(Number(value) || 0)
  return `Rs. ${n.toLocaleString("en-PK")}`
}

export function formatInvestorCrore(value: number): string {
  const crore = (Number(value) || 0) / 10_000_000
  return `${crore.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} Cr`
}
