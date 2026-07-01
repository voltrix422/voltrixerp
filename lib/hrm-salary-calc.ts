export type SalaryAdjustment = {
  id: string
  type: "add" | "deduct"
  amount: string
  label: string
}

export function daysInCalendarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function formatShortDate(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

/** Pro-rate monthly salary for an inclusive date range. */
export function calculateProRatedSalary(
  monthlySalary: number,
  fromDate: string,
  toDate: string,
): {
  amount: number
  daysWorked: number
  description: string
} {
  const from = new Date(fromDate + "T12:00:00")
  const to = new Date(toDate + "T12:00:00")
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return { amount: 0, daysWorked: 0, description: "" }
  }

  let amount = 0
  let daysWorked = 0
  const cursor = new Date(from)

  while (cursor <= to) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const dim = daysInCalendarMonth(year, month + 1)
    const monthEnd = new Date(year, month, dim, 12)
    const monthStart = new Date(year, month, 1, 12)
    const rangeStart = cursor > monthStart ? cursor : monthStart
    const rangeEnd = to < monthEnd ? to : monthEnd
    const days = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1
    amount += Math.round((monthlySalary / dim) * days)
    daysWorked += days
    cursor.setTime(new Date(year, month + 1, 1, 12).getTime())
  }

  return {
    amount,
    daysWorked,
    description: `${daysWorked} day${daysWorked === 1 ? "" : "s"} (${formatShortDate(fromDate)} – ${formatShortDate(toDate)})`,
  }
}

export function monthDateBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split("-").map(Number)
  const last = daysInCalendarMonth(year, mon)
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  }
}

export function adjustmentSignedTotal(adjustments: SalaryAdjustment[]): number {
  return adjustments.reduce((sum, adj) => {
    const n = Number(adj.amount) || 0
    return sum + (adj.type === "add" ? n : -n)
  }, 0)
}

export function computeNetSalary(baseSalary: number, adjustments: SalaryAdjustment[]): number {
  return Math.max(0, baseSalary + adjustmentSignedTotal(adjustments))
}

export function buildEffectiveSalaryAdjustments(
  manual: SalaryAdjustment[],
  options: { deductAdvance: boolean; outstandingAdvance: number },
): SalaryAdjustment[] {
  const list = [...manual]
  if (options.deductAdvance && options.outstandingAdvance > 0.004) {
    list.push({
      id: "advance-deduction",
      type: "deduct",
      amount: String(options.outstandingAdvance),
      label: "Salary advance recovery",
    })
  }
  return list
}

export function periodStartForJoinDate(month: string, joinDate?: string): string {
  const { from } = monthDateBounds(month)
  const join = joinDate?.slice(0, 10)
  if (join && join > from) return join
  return from
}

export function computeBatchSalaryFigures(
  monthlySalary: number,
  periodFrom: string,
  periodTo: string,
  outstandingAdvance: number,
) {
  const bounds = { from: periodFrom, to: periodTo }
  const fullMonth = monthDateBounds(periodFrom.slice(0, 7))
  const isFullMonth = periodFrom === fullMonth.from && periodTo === fullMonth.to
  const proRate = isFullMonth
    ? { amount: monthlySalary, daysWorked: 0, description: "Full month" }
    : calculateProRatedSalary(monthlySalary, periodFrom, periodTo)
  const adjustments = buildEffectiveSalaryAdjustments([], {
    deductAdvance: outstandingAdvance > 0,
    outstandingAdvance,
  })
  const netSalary = computeNetSalary(proRate.amount, adjustments)
  return {
    baseSalary: proRate.amount,
    adjustments,
    netSalary,
    proRateDescription: proRate.description,
    payPeriodText: isFullMonth
      ? new Date(periodFrom.slice(0, 7) + "-01").toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : `${formatShortDate(periodFrom)} – ${formatShortDate(periodTo)}`,
  }
}

export function payPeriodLabel(
  month: string,
  mode: "full_month" | "custom_range",
  fromDate?: string,
  toDate?: string,
): string {
  if (mode === "custom_range" && fromDate && toDate) {
    return `${formatShortDate(fromDate)} – ${formatShortDate(toDate)}`
  }
  try {
    return new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })
  } catch {
    return month
  }
}
