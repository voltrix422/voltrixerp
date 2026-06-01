export type KpiUnit = "currency" | "count" | "percent"
export type KpiPeriodType = "weekly" | "monthly"
export type SettlementStatus = "draft" | "submitted" | "approved" | "rejected"

export type KpiTemplate = {
  id: string
  name: string
  description: string
  unit: KpiUnit
  defaultTarget: number
  defaultWeight: number
  periodType: KpiPeriodType
  active: boolean
  sortOrder: number
  createdBy: string
  createdAt: string
}

export type StaffKpi = {
  id: string
  staffId: string
  templateId: string | null
  name: string
  unit: KpiUnit
  targetValue: number
  weight: number
  periodType: KpiPeriodType
  active: boolean
  notes: string
  assignedBy: string
  approvedActual: number
  lastApprovedPeriod: string
  createdAt: string
}

export type SettlementEntry = {
  staffKpiId: string
  name: string
  target: number
  actual: number
  weight: number
  unit: KpiUnit
}

export type KpiSettlement = {
  id: string
  staffId: string
  staffName?: string
  staffEmail?: string
  staffRole?: string
  staffDepartment?: string
  periodType: KpiPeriodType
  periodStart: string
  periodEnd: string
  status: SettlementStatus
  entries: SettlementEntry[]
  weightedScore: number | null
  employeeNotes: string
  adminNotes: string
  submittedAt: string | null
  submittedBy: string
  reviewedAt: string | null
  reviewedBy: string
  createdAt: string
  updatedAt: string
}

export function computeWeightedScore(entries: SettlementEntry[]): number {
  if (!entries.length) return 0
  let score = 0
  for (const e of entries) {
    const w = e.weight || 0
    if (w <= 0) continue
    const target = e.target > 0 ? e.target : 1
    const pct = Math.min(100, (e.actual / target) * 100)
    score += pct * (w / 100)
  }
  return Math.round(score * 100) / 100
}

/** Sunday–Saturday week containing `date`. */
export function weekBounds(date = new Date()): { periodStart: string; periodEnd: string } {
  const d = new Date(date)
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (x: Date) => x.toISOString().slice(0, 10)
  return { periodStart: fmt(start), periodEnd: fmt(end) }
}

export function formatKpiValue(value: number, unit: KpiUnit): string {
  if (unit === "currency") {
    return `Rs ${value.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
  }
  if (unit === "percent") return `${value}%`
  return value.toLocaleString("en-PK", { maximumFractionDigits: 0 })
}

export async function fetchKpiTemplates(): Promise<KpiTemplate[]> {
  const res = await fetch("/api/hrm/kpi-templates", { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load KPI templates")
  return res.json()
}

export async function saveKpiTemplate(
  data: Partial<KpiTemplate> & { name: string }
): Promise<KpiTemplate> {
  const res = await fetch("/api/hrm/kpi-templates", {
    method: data.id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Failed to save template")
  return json
}

export async function deleteKpiTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/hrm/kpi-templates?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete template")
}

export async function fetchStaffKpis(staffId: string): Promise<StaffKpi[]> {
  const res = await fetch(`/api/hrm/staff-kpis?staffId=${encodeURIComponent(staffId)}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load staff KPIs")
  return res.json()
}

export async function assignStaffKpi(body: {
  staffId: string
  templateId?: string | null
  name: string
  unit?: KpiUnit
  targetValue: number
  weight: number
  periodType?: KpiPeriodType
  notes?: string
  assignedBy?: string
}): Promise<StaffKpi> {
  const res = await fetch("/api/hrm/staff-kpis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Failed to assign KPI")
  return json
}

export async function updateStaffKpi(
  id: string,
  data: Partial<Pick<StaffKpi, "targetValue" | "weight" | "active" | "notes" | "name">>
): Promise<StaffKpi> {
  const res = await fetch("/api/hrm/staff-kpis", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Failed to update KPI")
  return json
}

export async function deleteStaffKpi(id: string): Promise<void> {
  const res = await fetch(`/api/hrm/staff-kpis?id=${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to remove KPI")
}

export async function fetchSettlements(params: {
  staffId?: string
  periodStart?: string
  periodEnd?: string
  status?: SettlementStatus
}): Promise<KpiSettlement[]> {
  const sp = new URLSearchParams()
  if (params.staffId) sp.set("staffId", params.staffId)
  if (params.periodStart) sp.set("periodStart", params.periodStart)
  if (params.periodEnd) sp.set("periodEnd", params.periodEnd)
  if (params.status) sp.set("status", params.status)
  const res = await fetch(`/api/hrm/kpi-settlements?${sp}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load settlements")
  return res.json()
}

export async function fetchPendingSettlements(): Promise<KpiSettlement[]> {
  return fetchSettlements({ status: "submitted" })
}

export async function linkStaffToUser(staffId: string, erpUserId: string | null): Promise<void> {
  const res = await fetch("/api/hrm/staff/link-user", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staffId, erpUserId }),
  })
  if (!res.ok) throw new Error("Failed to link user to profile")
}

export async function saveSettlement(body: {
  id?: string
  staffId: string
  periodStart: string
  periodEnd: string
  periodType?: KpiPeriodType
  entries: SettlementEntry[]
  employeeNotes?: string
  status?: SettlementStatus
  submittedBy?: string
  revise?: boolean
}): Promise<KpiSettlement> {
  const res = await fetch("/api/hrm/kpi-settlements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Failed to save settlement")
  return json
}

export async function reviewSettlement(body: {
  id: string
  status: "approved" | "rejected"
  adminNotes?: string
  reviewedBy?: string
}): Promise<KpiSettlement> {
  const res = await fetch("/api/hrm/kpi-settlements", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Failed to review settlement")
  return json
}

export async function fetchStaffProfile(params: {
  email?: string
  userId?: string
}): Promise<{
  id: string
  name: string
  email: string
  role?: string
  department?: string
  erpUserId?: string | null
} | null> {
  const sp = new URLSearchParams()
  if (params.email) sp.set("email", params.email)
  if (params.userId) sp.set("userId", params.userId)
  const res = await fetch(`/api/hrm/staff/by-email?${sp}`, { cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to lookup staff")
  return res.json()
}

export async function fetchStaffByEmail(email: string) {
  return fetchStaffProfile({ email })
}
