export type SalesJobTitle = "field_sales_officer" | "rsm" | "sales_manager"

export interface SalesAgentProfile {
  id: string
  name: string
  email: string
  role: string
  managerId?: string | null
  managerName?: string
  location: string
  jobTitle: SalesJobTitle
  baseSalary: number
  commissionPercent: number
  modules: string[]
  createdAt: string
  stats?: {
    clients: number
    quotations: number
    quotationsValue: number
    orders: number
    ordersValue: number
    pendingOrders: number
    deliveredOrders: number
    totalSales: number
    commissionEarned: number
    commissionPending: number
  }
}

export interface CompensationHistoryRow {
  id: string
  userId: string
  baseSalary: number
  commissionPercent: number
  effectiveFrom: string
  note: string
  createdBy: string
  createdAt: string
}

export interface CommissionSummary {
  agentId: string
  agentName: string
  baseSalary: number
  currentCommissionPercent: number
  deliveredOrderCount: number
  totalSales: number
  commissionEarned: number
  orders: Array<{
    id: string
    orderNumber: string
    clientName: string
    total: number
    status: string
    createdAt: string
    commissionPercent?: number
    commissionAmount?: number
  }>
}

export const JOB_TITLE_LABELS: Record<SalesJobTitle, string> = {
  field_sales_officer: "Field Sales Officer",
  rsm: "Regional Sales Manager (RSM)",
  sales_manager: "Sales Manager",
}

export async function fetchSalesAgents(params?: {
  managerId?: string
  withStats?: boolean
}): Promise<SalesAgentProfile[]> {
  const sp = new URLSearchParams()
  if (params?.managerId) sp.set("managerId", params.managerId)
  if (params?.withStats) sp.set("stats", "1")
  const q = sp.toString() ? `?${sp}` : ""
  const res = await fetch(`/api/sales/agents${q}`)
  if (!res.ok) throw new Error("Failed to load sales agents")
  return res.json()
}

export async function createSalesAgent(data: {
  name: string
  email: string
  password: string
  managerId?: string
  location?: string
  jobTitle?: SalesJobTitle
  baseSalary?: number
  commissionPercent?: number
}): Promise<SalesAgentProfile> {
  const res = await fetch("/api/sales/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const payload = await res.json()
  if (!res.ok) throw new Error(payload?.error || "Failed to create sales agent")
  return payload
}

export async function updateSalesAgent(
  id: string,
  data: Partial<{
    name: string
    email: string
    password: string
    managerId: string | null
    location: string
    jobTitle: SalesJobTitle
    baseSalary: number
    commissionPercent: number
    compensationNote: string
    updatedBy: string
  }>
): Promise<SalesAgentProfile> {
  const res = await fetch("/api/sales/agents", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  })
  const payload = await res.json()
  if (!res.ok) throw new Error(payload?.error || "Failed to update sales agent")
  return payload
}

export async function fetchCompensationHistory(userId: string): Promise<CompensationHistoryRow[]> {
  const res = await fetch(`/api/sales/agents/compensation?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) throw new Error("Failed to load compensation history")
  return res.json()
}

export async function fetchCommissionSummary(params: {
  agentId?: string
  from?: string
  to?: string
}): Promise<CommissionSummary[]> {
  const sp = new URLSearchParams()
  if (params.agentId) sp.set("agentId", params.agentId)
  if (params.from) sp.set("from", params.from)
  if (params.to) sp.set("to", params.to)
  const res = await fetch(`/api/sales/commissions?${sp}`)
  if (!res.ok) throw new Error("Failed to load commission summary")
  return res.json()
}
