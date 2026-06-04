export type DailyReportStatus = "draft" | "submitted" | "approved" | "rejected"

export type DailyReportLog = {
  id: string
  timeFrom: string
  timeTo: string
  details: string
  imageUrls: string[]
}

export type DailyReport = {
  id: string
  staffId: string
  staffName?: string
  staffEmail?: string
  staffRole?: string
  staffDepartment?: string
  reportDate: string
  status: DailyReportStatus
  logs: DailyReportLog[]
  employeeNotes: string
  adminNotes: string
  submittedAt: string | null
  submittedBy: string
  reviewedAt: string | null
  reviewedBy: string
  createdAt: string
  updatedAt: string
}

export function todayDateString(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function newDailyLog(): DailyReportLog {
  return {
    id: crypto.randomUUID(),
    timeFrom: "09:00",
    timeTo: "10:00",
    details: "",
    imageUrls: [],
  }
}

export async function fetchDailyReports(params: {
  staffId?: string
  reportDate?: string
  status?: string
  from?: string
  to?: string
}): Promise<DailyReport[]> {
  const q = new URLSearchParams()
  if (params.staffId) q.set("staffId", params.staffId)
  if (params.reportDate) q.set("reportDate", params.reportDate)
  if (params.status) q.set("status", params.status)
  if (params.from) q.set("from", params.from)
  if (params.to) q.set("to", params.to)
  const res = await fetch(`/api/hrm/daily-reports?${q}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load daily reports")
  return res.json()
}

export async function saveDailyReport(payload: {
  staffId: string
  reportDate: string
  logs: DailyReportLog[]
  employeeNotes?: string
  status: "draft" | "submitted"
  submittedBy?: string
}): Promise<DailyReport> {
  const res = await fetch("/api/hrm/daily-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || "Failed to save daily report")
  return data
}

export async function reviewDailyReport(payload: {
  id: string
  status: "approved" | "rejected"
  adminNotes?: string
  reviewedBy: string
}): Promise<DailyReport> {
  const res = await fetch("/api/hrm/daily-reports", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || "Failed to review daily report")
  return data
}

export function dailyReportStatusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "Sent to admin"
    case "approved":
      return "Reviewed"
    case "rejected":
      return "Needs revision"
    default:
      return "Draft"
  }
}

export function formatReportDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}
