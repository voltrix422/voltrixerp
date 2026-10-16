import type { CashRequest } from "@/lib/finance-cash-requests"
import { cashRequestStatusLabel, paymentMethodLabel } from "@/lib/finance-cash-requests"

function money(n: number) {
  return Number(n) || 0
}

function linesText(r: CashRequest) {
  if (!r.itemBreakdown?.length) return ""
  return r.itemBreakdown.map((l) => `${l.description} (${money(l.amount).toLocaleString()})`).join("; ")
}

export async function downloadCashRequestReportExcel(
  rows: CashRequest[],
  opts: { title?: string; employeeName?: string } = {},
) {
  const ExcelJSMod = await import("exceljs")
  const ExcelJS = ExcelJSMod.default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Voltrix ERP"
  wb.created = new Date()

  const sheet = wb.addWorksheet(opts.employeeName ? "Employee" : "Cash requests", {
    views: [{ state: "frozen", ySplit: 1 }],
  })
  sheet.columns = [
    { header: "Requested on", key: "createdAt", width: 18 },
    { header: "Needed on", key: "neededOn", width: 14 },
    { header: "Employee", key: "name", width: 22 },
    { header: "Department", key: "department", width: 16 },
    { header: "Amount (PKR)", key: "amount", width: 16 },
    { header: "Category", key: "category", width: 16 },
    { header: "Method", key: "method", width: 16 },
    { header: "Purpose", key: "purpose", width: 36 },
    { header: "Cash details", key: "details", width: 40 },
    { header: "Location", key: "location", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Admin notes", key: "adminNotes", width: 28 },
    { header: "Reviewed by", key: "reviewedBy", width: 18 },
  ]

  const header = sheet.getRow(1)
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1FACA6" } }
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
    cell.alignment = { vertical: "middle", wrapText: true }
  })
  header.height = 20

  for (const r of rows) {
    const row = sheet.addRow({
      createdAt: new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" }),
      neededOn: r.neededOn,
      name: r.staffName || r.requesterName,
      department: r.department,
      amount: money(r.amount),
      category: r.category,
      method: paymentMethodLabel(r.paymentMethod),
      purpose: r.purpose,
      details: linesText(r),
      location: r.location,
      status: cashRequestStatusLabel(r.status),
      adminNotes: r.adminNotes,
      reviewedBy: r.reviewedBy,
    })
    row.getCell("amount").numFmt = "#,##0"
    row.alignment = { vertical: "middle", wrapText: true }
  }

  const total = rows.reduce((s, r) => s + money(r.amount), 0)
  const pending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + money(r.amount), 0)
  const approved = rows.filter((r) => r.status === "approved").reduce((s, r) => s + money(r.amount), 0)
  sheet.addRow({})
  const sum = sheet.addRow({
    createdAt: opts.title || "Totals",
    amount: total,
    purpose: `Pending ${pending.toLocaleString()} · Approved ${approved.toLocaleString()} · ${rows.length} requests`,
  })
  sum.font = { bold: true }
  sum.getCell("amount").numFmt = "#,##0"

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const a = document.createElement("a")
  const stamp = new Date().toISOString().slice(0, 10)
  const who = opts.employeeName ? `-${opts.employeeName.replace(/\s+/g, "-").toLowerCase()}` : ""
  a.href = URL.createObjectURL(blob)
  a.download = `voltrix-cash-requests${who}-${stamp}.xlsx`
  a.click()
  URL.revokeObjectURL(a.href)
}
