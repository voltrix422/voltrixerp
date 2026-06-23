export type SalaryAdvanceStatus = "outstanding" | "recovered" | "cancelled"

export type SalaryAdvance = {
  id: string
  staffId: string
  amount: number
  currency: string
  reason: string
  notes: string
  status: SalaryAdvanceStatus
  givenBy: string
  givenAt: string
  recoveredAt?: string | null
  recoveredInMonth?: string | null
  proofUrl?: string | null
  proofName?: string | null
}

export type SalaryAdvanceSummary = {
  staffId: string
  outstanding: number
  currency: string
}

export async function fetchSalaryAdvances(staffId?: string): Promise<SalaryAdvance[]> {
  const q = staffId ? `?staffId=${encodeURIComponent(staffId)}` : ""
  const res = await fetch(`/api/hrm/salary-advances${q}`)
  if (!res.ok) throw new Error("Failed to load salary advances")
  return res.json()
}

export async function fetchSalaryAdvanceSummary(): Promise<SalaryAdvanceSummary[]> {
  const res = await fetch("/api/hrm/salary-advances?summary=1")
  if (!res.ok) throw new Error("Failed to load advance summary")
  return res.json()
}

export async function createSalaryAdvance(data: {
  staffId: string
  amount: number
  currency?: string
  reason: string
  notes?: string
  givenBy: string
  proofUrl?: string
  proofName?: string
}): Promise<SalaryAdvance> {
  const res = await fetch("/api/hrm/salary-advances", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload?.error || "Failed to record salary advance")
  return payload
}

export async function cancelSalaryAdvance(id: string, cancelledBy: string): Promise<SalaryAdvance> {
  const res = await fetch("/api/hrm/salary-advances", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action: "cancel", cancelledBy }),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload?.error || "Failed to cancel advance")
  return payload
}

export async function recoverSalaryAdvances(data: {
  staffId: string
  month: string
  recoveredBy: string
}): Promise<{ recoveredCount: number; recoveredTotal: number }> {
  const res = await fetch("/api/hrm/salary-advances", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, action: "recover" }),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload?.error || "Failed to recover advances")
  return payload
}

export function sumOutstandingAdvances(advances: SalaryAdvance[]) {
  return advances
    .filter((a) => a.status === "outstanding")
    .reduce((sum, a) => sum + a.amount, 0)
}
