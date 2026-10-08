import type { FinanceOrderRow, FinancePosRow } from "@/lib/finance-report-details"
import { dateRangeLabel } from "@/lib/plain-report-pdf"

export type BirdsEyeSalesSlice = {
  sale: number
  received: number
  credit: number
}

export type BirdsEyePayload = {
  periodLabel: string
  dateFrom?: string
  dateTo?: string
  exportedBy?: string
  crm: BirdsEyeSalesSlice
  pos: BirdsEyeSalesSlice
  pswDuties: number
  charges: number
  pettyCash: number
  purchaseLedger: number
  salaries: number
}

type JsDoc = import("jspdf").jsPDF & { lastAutoTable?: { finalY: number } }

const INK: [number, number, number] = [20, 20, 20]
const MUTED: [number, number, number] = [90, 90, 90]
const RULE: [number, number, number] = [40, 40, 40]
const FONT = "times"

function creditOf(total: number, paid: number) {
  return Math.max(0, (Number(total) || 0) - (Number(paid) || 0))
}

function money(n: number) {
  return Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })
}

function salesFromOrders(orders: FinanceOrderRow[]): BirdsEyeSalesSlice {
  const sale = orders.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const received = orders.reduce(
    (s, r) => s + (Number(r.receivedInPeriod) || Number(r.paidTotal) || 0),
    0,
  )
  const credit = orders.reduce((s, r) => s + creditOf(r.total, r.paidTotal), 0)
  return { sale, received, credit }
}

function salesFromPos(rows: FinancePosRow[]): BirdsEyeSalesSlice {
  const sale = rows.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const received = rows.reduce((s, r) => s + (Number(r.paidTotal ?? r.total) || 0), 0)
  const credit = rows.reduce((s, r) => s + creditOf(r.total, r.paidTotal ?? r.total), 0)
  return { sale, received, credit }
}

/** Build totals from Finance overview API JSON. */
export function buildBirdsEyeFromOverview(
  data: {
    periodLabel?: string
    orders?: FinanceOrderRow[]
    posSales?: FinancePosRow[]
    summary?: {
      breakdown?: {
        moneyOut?: {
          importPsw?: number
          importCharges?: number
          pettyCash?: number
          purchaseLedger?: number
          salaries?: number
        }
      }
    }
  },
  opts?: { dateFrom?: string; dateTo?: string; exportedBy?: string },
): BirdsEyePayload {
  const out = data.summary?.breakdown?.moneyOut || {}
  return {
    periodLabel: data.periodLabel || "Selected period",
    dateFrom: opts?.dateFrom,
    dateTo: opts?.dateTo,
    exportedBy: opts?.exportedBy,
    crm: salesFromOrders(Array.isArray(data.orders) ? data.orders : []),
    pos: salesFromPos(Array.isArray(data.posSales) ? data.posSales : []),
    pswDuties: Number(out.importPsw) || 0,
    charges: Number(out.importCharges) || 0,
    pettyCash: Number(out.pettyCash) || 0,
    purchaseLedger: Number(out.purchaseLedger) || 0,
    salaries: Number(out.salaries) || 0,
  }
}

function rangeOf(p: BirdsEyePayload) {
  if (p.dateFrom || p.dateTo) return dateRangeLabel(p.dateFrom || "", p.dateTo || "")
  return p.periodLabel || "Selected period"
}

function totals(p: BirdsEyePayload) {
  const sale = p.crm.sale + p.pos.sale
  const received = p.crm.received + p.pos.received
  const credit = p.crm.credit + p.pos.credit
  const imports = p.pswDuties + p.charges
  const expenses = p.pettyCash + p.purchaseLedger + p.salaries
  return { sale, received, credit, imports, expenses }
}

async function loadLogoBase64(): Promise<string> {
  try {
    const res = await fetch("/logo.png")
    if (!res.ok) return ""
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(blob)
    })
  } catch {
    return ""
  }
}

/**
 * Professional one-page financial summary PDF — black & white, totals only.
 */
export async function downloadDashboardBirdsEyePdf(payload: BirdsEyePayload) {
  const t = totals(payload)
  const range = rangeOf(payload)
  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }) as JsDoc
  const logo = await loadLogoBase64()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const m = 16
  const usable = pageW - m * 2

  // ——— Header ———
  if (logo) {
    try {
      doc.addImage(logo, "PNG", m, 12, 14, 14)
    } catch {
      /* text-only */
    }
  }
  const textX = logo ? m + 18 : m
  doc.setTextColor(...INK)
  doc.setFont(FONT, "bold")
  doc.setFontSize(11)
  doc.text("VOLTRIX BATTERIES PVT. LTD.", textX, 17)
  doc.setFont(FONT, "normal")
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text("Financial summary", textX, 22.5)

  doc.setFont(FONT, "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(`Period: ${range}`, pageW - m, 17, { align: "right" })
  doc.text(
    `${payload.exportedBy ? `${payload.exportedBy} · ` : ""}${generated}`,
    pageW - m,
    22.5,
    { align: "right" },
  )

  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.6)
  doc.line(m, 28, pageW - m, 28)

  let y = 34

  const tableOpts = {
    theme: "plain" as const,
    styles: {
      font: FONT,
      fontSize: 9.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      textColor: INK,
      lineColor: RULE,
      lineWidth: 0.15,
      valign: "middle" as const,
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold" as const,
      fontSize: 8.5,
      textColor: INK,
      fillColor: [255, 255, 255] as [number, number, number],
      lineWidth: 0.35,
    },
    bodyStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
    },
    margin: { left: m, right: m },
    tableWidth: usable,
  }

  const section = (title: string) => {
    doc.setFont(FONT, "bold")
    doc.setFontSize(10.5)
    doc.setTextColor(...INK)
    doc.text(title, m, y)
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.35)
    doc.line(m, y + 1.6, pageW - m, y + 1.6)
    y += 6
  }

  // ——— Sales ———
  section("Sales")
  autoTable(doc, {
    ...tableOpts,
    startY: y,
    head: [["", "Sale (PKR)", "Received (PKR)", "Credit (PKR)"]],
    body: [
      ["CRM", money(payload.crm.sale), money(payload.crm.received), money(payload.crm.credit)],
      ["POS", money(payload.pos.sale), money(payload.pos.received), money(payload.pos.credit)],
      [
        { content: "Total", styles: { fontStyle: "bold" } },
        { content: money(t.sale), styles: { fontStyle: "bold", halign: "right" } },
        { content: money(t.received), styles: { fontStyle: "bold", halign: "right" } },
        { content: money(t.credit), styles: { fontStyle: "bold", halign: "right" } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: usable * 0.28, halign: "left" },
      1: { cellWidth: usable * 0.24, halign: "right" },
      2: { cellWidth: usable * 0.24, halign: "right" },
      3: { cellWidth: usable * 0.24, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 2) {
        data.cell.styles.lineWidth = { top: 0.4, bottom: 0.4, left: 0, right: 0 }
      }
    },
  })
  y = (doc.lastAutoTable?.finalY || y) + 8

  // ——— Imports ———
  section("Imported purchases")
  autoTable(doc, {
    ...tableOpts,
    startY: y,
    head: [["", "Amount (PKR)"]],
    body: [
      ["PSW duties", money(payload.pswDuties)],
      ["Charges", money(payload.charges)],
      [
        { content: "Total", styles: { fontStyle: "bold" } },
        { content: money(t.imports), styles: { fontStyle: "bold", halign: "right" } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: usable * 0.62, halign: "left" },
      1: { cellWidth: usable * 0.38, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 2) {
        data.cell.styles.lineWidth = { top: 0.4, bottom: 0.4, left: 0, right: 0 }
      }
    },
  })
  y = (doc.lastAutoTable?.finalY || y) + 8

  // ——— Expenses ———
  section("Operating expenses")
  autoTable(doc, {
    ...tableOpts,
    startY: y,
    head: [["", "Amount (PKR)"]],
    body: [
      ["Petty cash", money(payload.pettyCash)],
      ["Purchase ledger", money(payload.purchaseLedger)],
      ["Salaries", money(payload.salaries)],
      [
        { content: "Total", styles: { fontStyle: "bold" } },
        { content: money(t.expenses), styles: { fontStyle: "bold", halign: "right" } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: usable * 0.62, halign: "left" },
      1: { cellWidth: usable * 0.38, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 3) {
        data.cell.styles.lineWidth = { top: 0.4, bottom: 0.4, left: 0, right: 0 }
      }
    },
  })

  // ——— Footer ———
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.3)
  doc.line(m, pageH - 12, pageW - m, pageH - 12)
  doc.setFont(FONT, "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text("Voltrix Batteries Pvt. Ltd.", m, pageH - 7)
  doc.text("Page 1 of 1", pageW - m, pageH - 7, { align: "right" })

  doc.save(`financial-summary-${new Date().toISOString().slice(0, 10)}.pdf`)
}

/** Single-sheet financial summary Excel — clean, totals only. */
export async function downloadDashboardBirdsEyeExcel(payload: BirdsEyePayload) {
  const t = totals(payload)
  const range = rangeOf(payload)
  const ExcelJSMod = await import("exceljs")
  const ExcelJS = ExcelJSMod.default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Voltrix ERP"
  wb.created = new Date()

  const ws = wb.addWorksheet("Summary")

  const moneyCell = (cell: any) => {
    cell.numFmt = "#,##0"
    cell.alignment = { horizontal: "right", vertical: "middle" }
  }
  const headerRow = (row: any) => {
    row.eachCell((cell: any) => {
      cell.font = { bold: true, size: 10, color: { argb: "FF1A1A1A" } }
      cell.alignment = { vertical: "middle" }
      cell.border = { bottom: { style: "thin", color: { argb: "FF333333" } } }
    })
    row.height = 18
  }
  const totalRow = (row: any) => {
    row.eachCell((cell: any) => {
      cell.font = { bold: true, size: 11, color: { argb: "FF1A1A1A" } }
      cell.border = {
        top: { style: "thin", color: { argb: "FF333333" } },
        bottom: { style: "medium", color: { argb: "FF333333" } },
      }
    })
    row.height = 20
  }
  const sectionTitle = (title: string) => {
    const row = ws.addRow([title])
    row.font = { bold: true, size: 11, color: { argb: "FF1A1A1A" } }
    row.height = 18
  }

  ws.addRow(["VOLTRIX BATTERIES PVT. LTD."]).font = {
    bold: true,
    size: 14,
    color: { argb: "FF1A1A1A" },
  }
  ws.addRow(["Financial summary"]).font = { size: 11, color: { argb: "FF555555" } }
  ws.addRow([`Period: ${range}`]).font = { size: 10, color: { argb: "FF555555" } }
  ws.addRow([
    `${payload.exportedBy ? `${payload.exportedBy} · ` : ""}${new Date().toLocaleString("en-PK")}`,
  ]).font = { size: 9, color: { argb: "FF777777" } }
  ws.addRow([])

  sectionTitle("Sales")
  headerRow(ws.addRow(["", "Sale (PKR)", "Received (PKR)", "Credit (PKR)"]))
  const crm = ws.addRow(["CRM", payload.crm.sale, payload.crm.received, payload.crm.credit])
  moneyCell(crm.getCell(2))
  moneyCell(crm.getCell(3))
  moneyCell(crm.getCell(4))
  const pos = ws.addRow(["POS", payload.pos.sale, payload.pos.received, payload.pos.credit])
  moneyCell(pos.getCell(2))
  moneyCell(pos.getCell(3))
  moneyCell(pos.getCell(4))
  const saleTot = ws.addRow(["Total", t.sale, t.received, t.credit])
  moneyCell(saleTot.getCell(2))
  moneyCell(saleTot.getCell(3))
  moneyCell(saleTot.getCell(4))
  totalRow(saleTot)

  ws.addRow([])
  sectionTitle("Imported purchases")
  headerRow(ws.addRow(["", "Amount (PKR)"]))
  const psw = ws.addRow(["PSW duties", payload.pswDuties])
  moneyCell(psw.getCell(2))
  const chg = ws.addRow(["Charges", payload.charges])
  moneyCell(chg.getCell(2))
  const impTot = ws.addRow(["Total", t.imports])
  moneyCell(impTot.getCell(2))
  totalRow(impTot)

  ws.addRow([])
  sectionTitle("Operating expenses")
  headerRow(ws.addRow(["", "Amount (PKR)"]))
  const pc = ws.addRow(["Petty cash", payload.pettyCash])
  moneyCell(pc.getCell(2))
  const pl = ws.addRow(["Purchase ledger", payload.purchaseLedger])
  moneyCell(pl.getCell(2))
  const sal = ws.addRow(["Salaries", payload.salaries])
  moneyCell(sal.getCell(2))
  const expTot = ws.addRow(["Total", t.expenses])
  moneyCell(expTot.getCell(2))
  totalRow(expTot)

  ws.getColumn(1).width = 22
  ws.getColumn(2).width = 18
  ws.getColumn(3).width = 18
  ws.getColumn(4).width = 18

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `financial-summary-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
