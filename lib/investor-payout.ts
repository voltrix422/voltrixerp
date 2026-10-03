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

/** Annual ROI% scaled to the selected period. */
export function investorPayoutDue(investment: number, roiPercent: number, period: InvestorRoiPeriod): number {
  const months = investorPeriodMonths(period)
  const inv = Number(investment) || 0
  const roi = Number(roiPercent) || 0
  return Math.round(inv * (roi / 100) * (months / 12))
}

/** End date of the ROI term (investedAt + period months, inclusive calendar). */
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

export function investorRoiRangeLabel(investedAt: string, period: InvestorRoiPeriod): string {
  const from = formatInvestorDay(investedAt)
  const to = formatInvestorDay(investorRoiEndDate(investedAt, period))
  if (from === "—" || to === "—") return investorRoiPeriodLabel(period)
  return `${from} – ${to}`
}

export function formatInvestorRs(value: number): string {
  const n = Math.round(Number(value) || 0)
  return `Rs. ${n.toLocaleString("en-PK")}`
}

export function formatInvestorCrore(value: number): string {
  const crore = (Number(value) || 0) / 10_000_000
  return `${crore.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} Cr`
}
