import type { FinanceOrderRow, FinancePosRow } from "@/lib/finance-report-details"
import { dateRangeLabel, downloadPlainReportPdf, pkr } from "@/lib/plain-report-pdf"

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

function creditOf(total: number, paid: number) {
  return Math.max(0, (Number(total) || 0) - (Number(paid) || 0))
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

/** Build bird's-eye totals from Finance overview API JSON. */
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

/** One-page bird's-eye PDF — big totals only. */
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

  await downloadPlainReportPdf({
    title: "Bird's-eye overview",
    subtitle: "Sales · Imports · Operating expenses",
    meta: [
      range,
      `${payload.exportedBy ? `${payload.exportedBy} · ` : ""}Generated  ${generated}  (Pakistan time)`,
    ],
    filename: `birds-eye-${new Date().toISOString().slice(0, 10)}.pdf`,
    compact: true,
    landscape: false,
    tables: [
      {
        title: "Sales",
        columns: [
          { header: "Source", width: 70 },
          { header: "Sale", align: "right", width: 40 },
          { header: "Received", align: "right", width: 40 },
          { header: "Credit", align: "right", width: 40 },
        ],
        rows: [
          ["CRM orders", pkr(payload.crm.sale), pkr(payload.crm.received), pkr(payload.crm.credit)],
          ["POS sales", pkr(payload.pos.sale), pkr(payload.pos.received), pkr(payload.pos.credit)],
          ["Combined", pkr(t.sale), pkr(t.received), pkr(t.credit)],
        ],
      },
      {
        title: "Imported purchases",
        columns: [
          { header: "Item", width: 100 },
          { header: "Amount", align: "right", width: 50 },
        ],
        rows: [
          ["PSW / customs duties", pkr(payload.pswDuties)],
          ["Landing & other charges", pkr(payload.charges)],
          ["Combined · PSW + charges", pkr(t.imports)],
        ],
      },
      {
        title: "Operating expenses",
        columns: [
          { header: "Item", width: 100 },
          { header: "Amount", align: "right", width: 50 },
        ],
        rows: [
          ["Petty cash (approved)", pkr(payload.pettyCash)],
          ["Purchase ledger", pkr(payload.purchaseLedger)],
          ["Salaries (payroll)", pkr(payload.salaries)],
          ["Combined · expenses", pkr(t.expenses)],
        ],
      },
    ],
    closingBanner: {
      title: "At a glance",
      lines: [
        { label: "Sales · received", value: pkr(t.received) },
        { label: "Sales · credit", value: pkr(t.credit) },
        { label: "Imports · PSW + charges", value: pkr(t.imports) },
        { label: "Operating expenses", value: pkr(t.expenses) },
      ],
    },
  })
}

/** Single-sheet bird's-eye Excel — big totals only. */
export async function downloadDashboardBirdsEyeExcel(payload: BirdsEyePayload) {
  const t = totals(payload)
  const range = rangeOf(payload)
  const ExcelJSMod = await import("exceljs")
  const ExcelJS = ExcelJSMod.default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Voltrix ERP"
  wb.created = new Date()

  const ws = wb.addWorksheet("Bird's eye", {
    properties: { tabColor: { argb: "FF1FACA6" } },
  })

  const paintHeader = (row: { eachCell: (cb: (cell: any) => void) => void; height?: number }) => {
    row.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1FACA6" } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
      cell.alignment = { vertical: "middle" }
    })
    row.height = 22
  }
  const money = (cell: any) => {
    cell.numFmt = "#,##0"
    cell.alignment = { horizontal: "right", vertical: "middle" }
  }
  const section = (title: string) => {
    const row = ws.addRow([title])
    row.font = { bold: true, size: 12, color: { argb: "FF134E4A" } }
    row.height = 20
  }
  const highlight = (row: any) => {
    row.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F7F6" } }
      cell.font = { bold: true, size: 12, color: { argb: "FF0D7370" } }
    })
    row.height = 24
  }

  ws.addRow(["VOLTRIX — Bird's-eye overview"]).font = {
    bold: true,
    size: 18,
    color: { argb: "FF134E4A" },
  }
  ws.addRow([`Period: ${range}`])
  ws.addRow([
    `${payload.exportedBy ? `${payload.exportedBy} · ` : ""}${new Date().toLocaleString("en-PK")} · summary only (no line detail)`,
  ])
  ws.addRow([])

  section("SALES")
  paintHeader(ws.addRow(["Source", "Sale (PKR)", "Received (PKR)", "Credit (PKR)"]))
  const crmRow = ws.addRow(["CRM orders", payload.crm.sale, payload.crm.received, payload.crm.credit])
  money(crmRow.getCell(2))
  money(crmRow.getCell(3))
  money(crmRow.getCell(4))
  const posRow = ws.addRow(["POS sales", payload.pos.sale, payload.pos.received, payload.pos.credit])
  money(posRow.getCell(2))
  money(posRow.getCell(3))
  money(posRow.getCell(4))
  const saleTot = ws.addRow(["COMBINED", t.sale, t.received, t.credit])
  money(saleTot.getCell(2))
  money(saleTot.getCell(3))
  money(saleTot.getCell(4))
  highlight(saleTot)

  ws.addRow([])
  section("IMPORTED PURCHASES")
  paintHeader(ws.addRow(["Item", "Amount (PKR)"]))
  const psw = ws.addRow(["PSW / customs duties", payload.pswDuties])
  money(psw.getCell(2))
  const chg = ws.addRow(["Landing & other charges", payload.charges])
  money(chg.getCell(2))
  const impTot = ws.addRow(["COMBINED · PSW + charges", t.imports])
  money(impTot.getCell(2))
  highlight(impTot)

  ws.addRow([])
  section("OPERATING EXPENSES")
  paintHeader(ws.addRow(["Item", "Amount (PKR)"]))
  const pc = ws.addRow(["Petty cash (approved)", payload.pettyCash])
  money(pc.getCell(2))
  const pl = ws.addRow(["Purchase ledger", payload.purchaseLedger])
  money(pl.getCell(2))
  const sal = ws.addRow(["Salaries (payroll)", payload.salaries])
  money(sal.getCell(2))
  const expTot = ws.addRow(["COMBINED · expenses", t.expenses])
  money(expTot.getCell(2))
  highlight(expTot)

  ws.addRow([])
  section("AT A GLANCE")
  paintHeader(ws.addRow(["Metric", "Amount (PKR)"]))
  for (const [label, value] of [
    ["Sales · received", t.received],
    ["Sales · credit", t.credit],
    ["Imports · PSW + charges", t.imports],
    ["Operating expenses", t.expenses],
  ] as [string, number][]) {
    const row = ws.addRow([label, value])
    money(row.getCell(2))
    highlight(row)
  }

  ws.getColumn(1).width = 36
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
  a.download = `birds-eye-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
