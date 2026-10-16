export const CASH_REQUEST_CATEGORIES = [
  "Travel",
  "Fuel",
  "Client meeting",
  "Site work",
  "Supplies",
  "Utilities",
  "Other",
] as const

export const CASH_REQUEST_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "bank", label: "Bank transfer" },
] as const

export type CashRequestStatus = "pending" | "approved" | "rejected"

export type CashRequestLine = {
  id: string
  description: string
  amount: number
}

export type CashRequest = {
  id: string
  staffId: string | null
  userId: string
  requesterName: string
  requesterEmail: string
  department: string
  amount: number
  currency: string
  neededOn: string
  purpose: string
  category: string
  paymentMethod: string
  bankName: string
  bankAccountNumber: string
  bankAccountTitle: string
  location: string
  itemBreakdown: CashRequestLine[]
  notes: string
  attachmentUrl: string
  attachmentName: string
  status: CashRequestStatus
  adminNotes: string
  adminAttachmentUrl: string
  adminAttachmentName: string
  reviewedBy: string
  reviewedByUserId: string | null
  reviewedAt: string | null
  financeRecordId: string | null
  createdAt: string
  updatedAt: string
  staffName?: string
}

export type CashRequestPayload = {
  staffId?: string | null
  userId: string
  requesterName: string
  requesterEmail?: string
  department?: string
  amount: number
  currency?: string
  neededOn: string
  purpose: string
  category: string
  paymentMethod: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountTitle?: string
  location?: string
  itemBreakdown: CashRequestLine[]
  notes?: string
  attachmentUrl?: string
  attachmentName?: string
}

export function karachiToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
}

export function addIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days))
  return dt.toISOString().slice(0, 10)
}

export function earliestNeededOn(from = karachiToday()): string {
  return addIsoDays(from, 1)
}

export function newCashLine(): CashRequestLine {
  return { id: crypto.randomUUID(), description: "", amount: 0 }
}

export function cashRequestStatusLabel(status: string) {
  if (status === "approved") return "Approved"
  if (status === "rejected") return "Rejected"
  return "Pending"
}

export function paymentMethodLabel(method: string) {
  return method === "bank" ? "Bank transfer" : "Cash"
}

export function sanitizeCashText(value: string, max = 120) {
  const text = String(value || "").trim()
  if (!text) return ""
  const lower = text.toLowerCase()
  if (
    lower.includes("fill every cash detail") ||
    lower.includes("send request to admin") ||
    lower.includes("attachment (optional)") ||
    lower.includes("how should admin pay")
  ) {
    return ""
  }
  if (text.length > max) return text.slice(0, max).trim()
  return text
}

export async function fetchCashRequests(params: {
  staffId?: string
  userId?: string
  status?: string
  neededOn?: string
  today?: boolean
  mine?: boolean
} = {}): Promise<CashRequest[]> {
  const q = new URLSearchParams()
  if (params.staffId) q.set("staffId", params.staffId)
  if (params.userId) q.set("userId", params.userId)
  if (params.status) q.set("status", params.status)
  if (params.neededOn) q.set("neededOn", params.neededOn)
  if (params.today) q.set("today", "1")
  if (params.mine) q.set("mine", "1")
  const res = await fetch(`/api/finance/cash-requests?${q.toString()}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load cash requests")
  return res.json()
}

export async function createCashRequest(payload: CashRequestPayload): Promise<CashRequest> {
  const res = await fetch("/api/finance/cash-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || "Failed to submit cash request")
  return data
}

export async function reviewCashRequest(input: {
  id: string
  action: "approve" | "reject"
  reviewedBy: string
  reviewedByUserId?: string
  adminNotes?: string
  actorRole?: string
  adminAttachmentUrl?: string
  adminAttachmentName?: string
}): Promise<CashRequest> {
  const res = await fetch("/api/finance/cash-requests", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || "Failed to update cash request")
  return data
}
