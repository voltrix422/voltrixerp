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

/** Payroll bank transfer list — staff name + bank fields only. */
export function downloadStaffBankDetailsExcel(staff: StaffExportRow[], exportedBy?: string): number {
  const withBank = staff.filter(
    (s) => s.bank_name?.trim() || s.bank_account_number?.trim() || s.bank_account_title?.trim(),
  )

  const headers = [
    "Staff Name",
    "Department",
    "Role",
    "Salary",
    "Currency",
    "Bank Name",
    "Account Number",
    "Account Title",
  ]

  const rows = withBank.map((s) => [
    s.name,
    s.department,
    s.role,
    s.salary ?? 0,
    s.currency ?? "PKR",
    s.bank_name ?? "",
    s.bank_account_number ?? "",
    s.bank_account_title ?? "",
  ])

  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`staff-bank-accounts-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  return withBank.length
}

export function staffBankDetailsCopyText(s: StaffExportRow): string {
  return [
    `Staff: ${s.name}`,
    `Bank: ${s.bank_name?.trim() || "—"}`,
    `Account #: ${s.bank_account_number?.trim() || "—"}`,
    `Account title: ${s.bank_account_title?.trim() || "—"}`,
  ].join("\n")
}

export function allStaffBankDetailsCopyText(staff: StaffExportRow[]): string {
  const withBank = staff.filter(
    (s) => s.bank_name?.trim() || s.bank_account_number?.trim() || s.bank_account_title?.trim(),
  )
  return withBank.map((s, i) => `${i + 1}. ${staffBankDetailsCopyText(s)}`).join("\n\n")
}

export type MakeSalariesExportRow = {
  staffName: string
  role: string
  department: string
  bankName: string
  bankAccountTitle: string
  bankAccountNumber: string
  periodFrom: string
  periodTo: string
  payPeriodText: string
  contractSalary: number
  payableSalary: number
  incentive: number
  commission: number
  advanceDeduction: number
  netSalary: number
  currency: string
}

/** Payroll sheet for bank transfers — only rows passed in (caller filters excluded staff). */
export function downloadMakeSalariesExcel(
  month: string,
  rows: MakeSalariesExportRow[],
  exportedBy?: string,
): number {
  const monthLabel = (() => {
    const [y, m] = month.split("-").map(Number)
    if (!y || !m) return month
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
  })()

  const preamble = [
    `${escCsvCell("Payroll month")},${escCsvCell(monthLabel)}`,
    `${escCsvCell("Employees")},${escCsvCell(rows.length)}`,
    `${escCsvCell("Total net")},${escCsvCell(rows.reduce((s, r) => s + r.netSalary, 0))}`,
    "",
  ].join("\r\n")

  const headers = [
    "Employee",
    "Role",
    "Department",
    "Bank Name",
    "Account Title",
    "Account Number",
    "Period From",
    "Period To",
    "Pay Period",
    "Contract Salary",
    "Payable Salary",
    "Incentive",
    "Commission",
    "Advance Deduction",
    "Net Salary",
    "Currency",
  ]

  const dataRows = rows.map((r) => [
    r.staffName,
    r.role,
    r.department,
    r.bankName,
    r.bankAccountTitle,
    r.bankAccountNumber,
    r.periodFrom,
    r.periodTo,
    r.payPeriodText,
    r.contractSalary,
    r.payableSalary,
    r.incentive || 0,
    r.commission || 0,
    r.advanceDeduction,
    r.netSalary,
    r.currency,
  ])

  const csv = preamble + exportMetaHeader(exportedBy) + rowsToCsv(headers, dataRows)
  downloadCsv(`salary-payroll-${month}.csv`, csv)
  return rows.length
}
