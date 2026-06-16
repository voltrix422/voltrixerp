import { escCsvCell } from "@/lib/crm-excel-export"

export type StaffExportRow = {
  id: string
  name: string
  role: string
  department: string
  email?: string
  phone?: string
  address?: string
  salary?: number
  currency?: string
  join_date?: string
  status?: string
  notes?: string
  points?: number
  warnings?: { level: number; message: string; date: string; pointsAtWarning?: number }[]
  last_reset?: string
  created_by?: string
  created_at?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_title?: string
  erp_user_id?: string | null
  documents?: { name: string }[]
}

function downloadCsv(filename: string, csvBody: string) {
  if (typeof document === "undefined") return
  const blob = new Blob(["\ufeff" + csvBody], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function formatDate(iso?: string) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("en-PK")
  } catch {
    return iso
  }
}

function formatWarnings(
  warnings?: StaffExportRow["warnings"]
): { count: number; detail: string } {
  if (!warnings?.length) return { count: 0, detail: "" }
  const detail = warnings
    .map((w) => `L${w.level}: ${w.message} (${formatDate(w.date)}, ${w.pointsAtWarning ?? "—"} pts)`)
    .join("; ")
  return { count: warnings.length, detail }
}

function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  return [
    headers.map((h) => escCsvCell(h)).join(","),
    ...rows.map((r) => r.map((c) => escCsvCell(c)).join(",")),
  ].join("\r\n")
}

function exportMetaHeader(exportedBy?: string) {
  if (!exportedBy?.trim()) return ""
  const when = new Date().toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })
  return `${escCsvCell("Exported by")},${escCsvCell(exportedBy.trim())}\r\n${escCsvCell("Export time")},${escCsvCell(when)}\r\n\r\n`
}

export function downloadStaffExcel(staff: StaffExportRow[], exportedBy?: string): number {
  const headers = [
    "ID",
    "Name",
    "Role",
    "Department",
    "Status",
    "Points",
    "Email",
    "Phone",
    "Address",
    "Salary",
    "Currency",
    "Join Date",
    "Bank Name",
    "Bank Account #",
    "Bank Account Title",
    "Notes",
    "Warnings",
    "Warning Details",
    "Last Points Reset",
    "Documents",
    "ERP User ID",
    "Created By",
    "Created Date",
  ]

  const rows = staff.map((s) => {
    const { count, detail } = formatWarnings(s.warnings)
    return [
      s.id,
      s.name,
      s.role,
      s.department,
      s.status ?? "",
      s.points ?? 100,
      s.email ?? "",
      s.phone ?? "",
      s.address ?? "",
      s.salary ?? 0,
      s.currency ?? "",
      formatDate(s.join_date),
      s.bank_name ?? "",
      s.bank_account_number ?? "",
      s.bank_account_title ?? "",
      s.notes ?? "",
      count,
      detail,
      formatDate(s.last_reset),
      s.documents?.length ?? 0,
      s.erp_user_id ?? "",
      s.created_by ?? "",
      formatDate(s.created_at),
    ]
  })

  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`staff-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  return staff.length
}
