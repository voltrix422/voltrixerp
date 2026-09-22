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

export function investorRoiPeriodLabel(period: InvestorRoiPeriod): string {
  return INVESTOR_ROI_PERIODS.find((p) => p.id === period)?.label || "Annual"
}

/** Annual ROI% scaled to the selected period. */
export function investorPayoutDue(investment: number, roiPercent: number, period: InvestorRoiPeriod): number {
  const months = INVESTOR_ROI_PERIODS.find((p) => p.id === period)?.months ?? 12
  const inv = Number(investment) || 0
  const roi = Number(roiPercent) || 0
  return Math.round(inv * (roi / 100) * (months / 12))
}

export function formatInvestorRs(value: number): string {
  const n = Math.round(Number(value) || 0)
  return `Rs. ${n.toLocaleString("en-PK")}`
}

export function formatInvestorCrore(value: number): string {
  const crore = (Number(value) || 0) / 10_000_000
  return `${crore.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} Cr`
}
