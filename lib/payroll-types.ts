import type { SalarySlipAdjustment } from "@/lib/generate-salary-slip-pdf"

export type SavedSalarySlip = {
  id: string
  userId: string | null
  staffName: string
  staffRole: string
  staffDepartment: string
  staffCategory: string
  month: string
  baseSalary: number
  currency: string
  adjustments: SalarySlipAdjustment[]
  netSalary: number
  generatedDate: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountTitle?: string
}

export function fmtPayroll(n: number, currency = "PKR") {
  return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function netFromPayrollParts(
  base: number,
  extraAdd: number,
  adjustments: SalarySlipAdjustment[],
) {
  let net = base + extraAdd
  for (const adj of adjustments) {
    const n = Number(adj.amount) || 0
    net += adj.type === "deduct" ? -n : n
  }
  return Math.max(0, net)
}

export async function saveSalarySlip(payload: Record<string, unknown>): Promise<SavedSalarySlip> {
  const res = await fetch("/api/hrm/salary-slips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (res.status === 409) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Slip already exists for this month")
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Failed to save salary slip")
  }
  return res.json()
}

export async function fetchSalarySlips(params: {
  staffCategory: string
  month: string
}): Promise<SavedSalarySlip[]> {
  const q = new URLSearchParams({
    staffCategory: params.staffCategory,
    month: params.month,
  })
  const res = await fetch(`/api/hrm/salary-slips?${q}`)
  if (!res.ok) throw new Error("Failed to load salary slips")
  const data = await res.json()
  return Array.isArray(data) ? data : []
}
