export type SalaryAdjustment = {
  id: string
  type: "add" | "deduct"
  amount: string
  label: string
}

export type StaffPayLine = {
  id: string
  label: string
  amount: number
  enabled: boolean
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

export function normalizeStaffPayLines(raw: unknown): StaffPayLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
      const label = String(row.label ?? "").trim()
      const amount = Math.max(0, Number(row.amount) || 0)
      const id = String(row.id || `line-${index}-${label || "item"}`)
      return {
        id,
        label: label || `Item ${index + 1}`,
        amount,
        enabled: row.enabled !== false,
      }
    })
    .filter(line => line.amount > 0 || line.label.trim().length > 0)
}

/** Tax deducted only when the profile toggle is on and amount > 0. */
export function effectiveStaffTaxAmount(options: {
  taxAmount?: number | null
  taxEnabled?: boolean | null
}): number {
  if (!options.taxEnabled) return 0
  return Math.max(0, Number(options.taxAmount) || 0)
}

/** EOBI deducted only when the profile toggle is on and amount > 0. */
export function effectiveStaffEobiAmount(options: {
  eobiAmount?: number | null
  eobiEnabled?: boolean | null
}): number {
  if (!options.eobiEnabled) return 0
  return Math.max(0, Number(options.eobiAmount) || 0)
}

export function effectiveStaffMedicalAmount(options: {
  medicalAllowance?: number | null
  medicalEnabled?: boolean | null
}): number {
  if (!options.medicalEnabled) return 0
  return Math.max(0, Number(options.medicalAllowance) || 0)
}

/** Basic salary if set; otherwise fall back to contract salary. */
export function resolveBasicSalary(contractSalary: number, basicSalary?: number | null): number {
  const basic = Math.max(0, Number(basicSalary) || 0)
  if (basic > 0.004) return basic
  return Math.max(0, Number(contractSalary) || 0)
}

export type StaffCompensationProfile = {
  salary?: number | null
  basicSalary?: number | null
  medicalAllowance?: number | null
  medicalEnabled?: boolean | null
  taxAmount?: number | null
  taxEnabled?: boolean | null
  eobiAmount?: number | null
  eobiEnabled?: boolean | null
  customAllowances?: StaffPayLine[] | unknown
  customDeductions?: StaffPayLine[] | unknown
}

export type StaffCompensationBreakdown = {
  contractSalary: number
  basicSalary: number
  medicalAllowance: number
  medicalApplied: number
  taxAmount: number
  taxApplied: number
  eobiAmount: number
  eobiApplied: number
  customAllowances: StaffPayLine[]
  customDeductions: StaffPayLine[]
  customAllowancesTotal: number
  customDeductionsTotal: number
  grossPay: number
  totalDeductions: number
  netPayable: number
}

export function formatMoneyAmount(currency: string, amount: number): string {
  return `${currency} ${Number(amount || 0).toLocaleString()}`
}

export function computeStaffCompensation(
  profile: StaffCompensationProfile,
): StaffCompensationBreakdown {
  const contractSalary = Math.max(0, Number(profile.salary) || 0)
  const basicSalary = resolveBasicSalary(contractSalary, profile.basicSalary)
  const medicalAllowance = Math.max(0, Number(profile.medicalAllowance) || 0)
  const medicalApplied = effectiveStaffMedicalAmount({
    medicalAllowance,
    medicalEnabled: profile.medicalEnabled,
  })
  const taxAmount = Math.max(0, Number(profile.taxAmount) || 0)
  const taxApplied = effectiveStaffTaxAmount({
    taxAmount,
    taxEnabled: profile.taxEnabled,
  })
  const eobiAmount = Math.max(0, Number(profile.eobiAmount) || 0)
  const eobiApplied = effectiveStaffEobiAmount({
    eobiAmount,
    eobiEnabled: profile.eobiEnabled,
  })
  const customAllowances = normalizeStaffPayLines(profile.customAllowances)
  const customDeductions = normalizeStaffPayLines(profile.customDeductions)
  const customAllowancesTotal = customAllowances
    .filter(line => line.enabled)
    .reduce((sum, line) => sum + line.amount, 0)
  const customDeductionsTotal = customDeductions
    .filter(line => line.enabled)
    .reduce((sum, line) => sum + line.amount, 0)
  const grossPay = basicSalary + medicalApplied + customAllowancesTotal
  const totalDeductions = taxApplied + eobiApplied + customDeductionsTotal
  const netPayable = Math.max(0, grossPay - totalDeductions)

  return {
    contractSalary,
    basicSalary,
    medicalAllowance,
    medicalApplied,
    taxAmount,
    taxApplied,
    eobiAmount,
    eobiApplied,
    customAllowances,
    customDeductions,
    customAllowancesTotal,
    customDeductionsTotal,
    grossPay,
    totalDeductions,
    netPayable,
  }
}

export function amountFromSalaryAdjustments(
  adjustments: unknown,
  matchers: string[],
): number {
  if (!Array.isArray(adjustments)) return 0
  const keys = matchers.map((m) => m.trim().toLowerCase()).filter(Boolean)
  for (const raw of adjustments) {
    if (!raw || typeof raw !== "object") continue
    const adj = raw as Record<string, unknown>
    const id = String(adj.id || "").trim().toLowerCase()
    const label = String(adj.label || "").trim().toLowerCase()
    if (!keys.some((k) => id === k || label === k)) continue
    if (String(adj.type || "add").toLowerCase() === "deduct") continue
    return Math.max(0, Number(adj.amount) || 0)
  }
  return 0
}

export function buildEffectiveSalaryAdjustments(
  manual: SalaryAdjustment[],
  options: {
    deductAdvance: boolean
    outstandingAdvance: number
    taxAmount?: number
    taxEnabled?: boolean
    eobiAmount?: number
    eobiEnabled?: boolean
    medicalAllowance?: number
    medicalEnabled?: boolean
    customAllowances?: StaffPayLine[] | unknown
    customDeductions?: StaffPayLine[] | unknown
    incentive?: number
    commission?: number
  },
): SalaryAdjustment[] {
  const list = [...manual]

  const medicalAmount = effectiveStaffMedicalAmount({
    medicalAllowance: options.medicalAllowance,
    medicalEnabled: options.medicalEnabled,
  })
  const hasMedical = list.some(
    adj =>
      adj.id === "medical-allowance" ||
      adj.label.trim().toLowerCase() === "medical allowance" ||
      adj.label.trim().toLowerCase() === "medical",
  )
  if (medicalAmount > 0.004 && !hasMedical) {
    list.push({
      id: "medical-allowance",
      type: "add",
      amount: String(medicalAmount),
      label: "Medical Allowance",
    })
  }

  for (const line of normalizeStaffPayLines(options.customAllowances)) {
    if (!line.enabled || line.amount <= 0.004) continue
    const id = `custom-allowance-${line.id}`
    if (list.some(adj => adj.id === id)) continue
    list.push({
      id,
      type: "add",
      amount: String(line.amount),
      label: line.label || "Allowance",
    })
  }

  const incentive = Math.max(0, Number(options.incentive) || 0)
  const hasIncentive = list.some(
    adj =>
      adj.id === "incentive" ||
      adj.label.trim().toLowerCase() === "incentive",
  )
  if (incentive > 0.004 && !hasIncentive) {
    list.push({
      id: "incentive",
      type: "add",
      amount: String(Math.round(incentive)),
      label: "Incentive",
    })
  }

  const commission = Math.max(0, Number(options.commission) || 0)
  const hasCommission = list.some(
    adj =>
      adj.id === "commission" ||
      adj.label.trim().toLowerCase() === "commission",
  )
  if (commission > 0.004 && !hasCommission) {
    list.push({
      id: "commission",
      type: "add",
      amount: String(Math.round(commission)),
      label: "Commission",
    })
  }

  const taxAmount = effectiveStaffTaxAmount({
    taxAmount: options.taxAmount,
    taxEnabled: options.taxEnabled,
  })
  const hasTax = list.some(
    adj => adj.id === "tax-deduction" || adj.label.trim().toLowerCase() === "tax",
  )
  if (taxAmount > 0.004 && !hasTax) {
    list.push({
      id: "tax-deduction",
      type: "deduct",
      amount: String(taxAmount),
      label: "Tax",
    })
  }

  const eobiAmount = effectiveStaffEobiAmount({
    eobiAmount: options.eobiAmount,
    eobiEnabled: options.eobiEnabled,
  })
  const hasEobi = list.some(
    adj => adj.id === "eobi-deduction" || adj.label.trim().toLowerCase() === "eobi",
  )
  if (eobiAmount > 0.004 && !hasEobi) {
    list.push({
      id: "eobi-deduction",
      type: "deduct",
      amount: String(eobiAmount),
      label: "EOBI",
    })
  }

  for (const line of normalizeStaffPayLines(options.customDeductions)) {
    if (!line.enabled || line.amount <= 0.004) continue
    const id = `custom-deduction-${line.id}`
    if (list.some(adj => adj.id === id)) continue
    list.push({
      id,
      type: "deduct",
      amount: String(line.amount),
      label: line.label || "Deduction",
    })
  }

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
  taxAmount = 0,
  taxEnabled = true,
  eobiAmount = 0,
  eobiEnabled = false,
  medicalAllowance = 0,
  medicalEnabled = false,
  customAllowances: StaffPayLine[] | unknown = [],
  customDeductions: StaffPayLine[] | unknown = [],
  basicSalary = 0,
  incentive = 0,
  commission = 0,
) {
  const payableBase = resolveBasicSalary(monthlySalary, basicSalary)
  const fullMonth = monthDateBounds(periodFrom.slice(0, 7))
  const isFullMonth = periodFrom === fullMonth.from && periodTo === fullMonth.to
  const proRate = isFullMonth
    ? { amount: payableBase, daysWorked: 0, description: "Full month" }
    : calculateProRatedSalary(payableBase, periodFrom, periodTo)
  const adjustments = buildEffectiveSalaryAdjustments([], {
    deductAdvance: outstandingAdvance > 0,
    outstandingAdvance,
    taxAmount,
    taxEnabled,
    eobiAmount,
    eobiEnabled,
    medicalAllowance,
    medicalEnabled,
    customAllowances,
    customDeductions,
    incentive,
    commission,
  })
  const netSalary = computeNetSalary(proRate.amount, adjustments)
  return {
    baseSalary: proRate.amount,
    adjustments,
    netSalary,
    incentive: Math.max(0, Math.round(Number(incentive) || 0)),
    commission: Math.max(0, Math.round(Number(commission) || 0)),
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
