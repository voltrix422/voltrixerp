import type { FinanceOrderRow, FinancePosRow } from "@/lib/finance-report-details"
import type { FinanceSalesReportOptions } from "@/lib/generate-finance-sales-report-pdf"
import { dateRangeLabel } from "@/lib/plain-report-pdf"

function creditOf(total: number, paid: number) {
  return Math.max(0, (Number(total) || 0) - (Number(paid) || 0))
}

function itemsLine(items: FinanceOrderRow["items"] | FinancePosRow["items"]) {
  if (!items?.length) return ""
  return items
    .map((i) => {
      const qty = i.qty > 0 ? `${i.qty}× ` : ""
      return `${qty}${i.description || "Item"}`
    })
    .join("; ")
}

function paintHeader(row: { eachCell: (cb: (cell: any) => void) => void; height?: number }) {
  row.eachCell((cell: any) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1FACA6" },
    }
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
    cell.alignment = { vertical: "middle", wrapText: true }
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF0F766E" } },
    }
  })
  row.height = 20
}

function moneyCell(cell: any) {
  cell.numFmt = '#,##0'
  cell.alignment = { horizontal: "right", vertical: "middle" }
}

/** Clean Finance sales Excel — CRM / POS separate sheets + combined totals. */
export async function downloadFinanceSalesReportExcel(
  orders: FinanceOrderRow[],
  posSales: FinancePosRow[],
  opts: FinanceSalesReportOptions,
) {
  if (!opts.includeCrm && !opts.includePos) {
    throw new Error("Select at least one source (CRM or POS).")
  }

  const ExcelJSMod = await import("exceljs")
  const ExcelJS = ExcelJSMod.default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Voltrix ERP"
  wb.created = new Date()

  const crm = opts.includeCrm ? orders : []
  const pos = opts.includePos ? posSales : []

  const crmTotal = crm.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const crmReceived = crm.reduce(
    (s, r) => s + (Number(r.receivedInPeriod) || Number(r.paidTotal) || 0),
    0,
  )
  const crmCredit = crm.reduce((s, r) => s + creditOf(r.total, r.paidTotal), 0)

  const posTotal = pos.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const posReceived = pos.reduce((s, r) => s + (Number(r.paidTotal ?? r.total) || 0), 0)
  const posCredit = pos.reduce((s, r) => s + creditOf(r.total, r.paidTotal ?? r.total), 0)

  const combinedSale = crmTotal + posTotal
  const combinedReceived = crmReceived + posReceived
  const combinedCredit = crmCredit + posCredit

  const range =
    opts.dateFrom || opts.dateTo
      ? dateRangeLabel(opts.dateFrom || "", opts.dateTo || "")
      : opts.periodLabel || "Selected period"
  const sources = [
    opts.includeCrm ? "CRM" : null,
    opts.includePos ? "POS" : null,
  ]
    .filter(Boolean)
    .join(" + ")

  // ——— Combined sheet ———
  const summary = wb.addWorksheet("Combined", {
    properties: { tabColor: { argb: "FF1FACA6" } },
  })
  const brand = summary.addRow(["VOLTRIX — Sales cash report"])
  brand.font = { bold: true, size: 16, color: { argb: "FF134E4A" } }
  summary.addRow([`Period: ${range}`])
  summary.addRow([
    `Sources: ${sources}${opts.exportedBy ? ` · ${opts.exportedBy}` : ""} · ${new Date().toLocaleString("en-PK")}`,
  ])
  summary.addRow([])

  paintHeader(summary.addRow(["Metric", "Amount (PKR)"]))

  const addMetric = (label: string, value: number, highlight = false) => {
    const row = summary.addRow([label, value])
    moneyCell(row.getCell(2))
    if (highlight) {
      row.eachCell((cell: any) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8F7F6" },
        }
        cell.font = { bold: true, size: 12, color: { argb: "FF0D7370" } }
      })
      row.height = 22
    }
  }

  if (opts.includeCrm) {
    summary.addRow(["CRM orders"]).font = { bold: true, size: 11 }
    addMetric("CRM · sale value", crmTotal)
    addMetric("CRM · received", crmReceived)
    addMetric("CRM · credit / outstanding", crmCredit)
    addMetric("CRM · order count", crm.length)
    summary.addRow([])
  }
  if (opts.includePos) {
    summary.addRow(["POS sales"]).font = { bold: true, size: 11 }
    addMetric("POS · sale value", posTotal)
    addMetric("POS · received", posReceived)
    addMetric("POS · credit / outstanding", posCredit)
    addMetric("POS · sale count", pos.length)
    summary.addRow([])
  }

  summary.addRow(["COMBINED TOTALS"]).font = {
    bold: true,
    size: 12,
    color: { argb: "FF0D7370" },
  }
  addMetric("Combined · sale value", combinedSale, true)
  addMetric("Combined · received", combinedReceived, true)
  addMetric("Combined · credit", combinedCredit, true)

  summary.getColumn(1).width = 36
  summary.getColumn(2).width = 22

  // ——— CRM sheet ———
  if (opts.includeCrm) {
    const ws = wb.addWorksheet("CRM orders", {
      properties: { tabColor: { argb: "FF0EA5E9" } },
    })
    const title = ws.addRow(["CRM client orders — sale / received / credit"])
    title.font = { bold: true, size: 13, color: { argb: "FF134E4A" } }
    ws.addRow([`Period: ${range}`])
    ws.addRow([])
    paintHeader(
      ws.addRow([
        "Date",
        "Order",
        "Client",
        "Status",
        "Created by",
        "Items",
        "Total (PKR)",
        "Received (PKR)",
        "Credit (PKR)",
      ]),
    )
    for (const r of crm) {
      const received = Number(r.receivedInPeriod) || Number(r.paidTotal) || 0
      const credit = creditOf(r.total, r.paidTotal)
      const row = ws.addRow([
        r.date || "",
        r.orderNumber || "",
        r.clientName || "",
        String(r.status || "").replace(/_/g, " "),
        r.createdBy || "",
        itemsLine(r.items),
        Number(r.total) || 0,
        received,
        credit,
      ])
      moneyCell(row.getCell(7))
      moneyCell(row.getCell(8))
      moneyCell(row.getCell(9))
    }
    const foot = ws.addRow([
      "",
      "",
      `${crm.length} orders`,
      "",
      "",
      "TOTAL",
      crmTotal,
      crmReceived,
      crmCredit,
    ])
    foot.font = { bold: true }
    moneyCell(foot.getCell(7))
    moneyCell(foot.getCell(8))
    moneyCell(foot.getCell(9))
    foot.eachCell((cell: any) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F7F6" },
      }
    })
    ;[12, 16, 28, 14, 16, 40, 14, 14, 14].forEach((w, i) => {
      ws.getColumn(i + 1).width = w
    })
    ws.views = [{ state: "frozen", ySplit: 4 }]
  }

  // ——— POS sheet ———
  if (opts.includePos) {
    const ws = wb.addWorksheet("POS sales", {
      properties: { tabColor: { argb: "FFF59E0B" } },
    })
    const title = ws.addRow(["POS sales — sale / received / credit"])
    title.font = { bold: true, size: 13, color: { argb: "FF134E4A" } }
    ws.addRow([`Period: ${range}`])
    ws.addRow([])
    paintHeader(
      ws.addRow([
        "Date",
        "Sale no.",
        "Customer",
        "Kind",
        "Cashier",
        "Method",
        "Items",
        "Total (PKR)",
        "Received (PKR)",
        "Credit (PKR)",
      ]),
    )
    for (const r of pos) {
      const received = Number(r.paidTotal ?? r.total) || 0
      const credit = creditOf(r.total, r.paidTotal ?? r.total)
      const row = ws.addRow([
        r.date || "",
        r.number || "",
        r.customer || "",
        r.kind || "POS",
        r.cashier || "",
        r.method || "",
        itemsLine(r.items),
        Number(r.total) || 0,
        received,
        credit,
      ])
      moneyCell(row.getCell(8))
      moneyCell(row.getCell(9))
      moneyCell(row.getCell(10))
    }
    const foot = ws.addRow([
      "",
      "",
      `${pos.length} sales`,
      "",
      "",
      "",
      "TOTAL",
      posTotal,
      posReceived,
      posCredit,
    ])
    foot.font = { bold: true }
    moneyCell(foot.getCell(8))
    moneyCell(foot.getCell(9))
    moneyCell(foot.getCell(10))
    foot.eachCell((cell: any) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F7F6" },
      }
    })
    ;[12, 16, 24, 14, 16, 12, 36, 14, 14, 14].forEach((w, i) => {
      ws.getColumn(i + 1).width = w
    })
    ws.views = [{ state: "frozen", ySplit: 4 }]
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const from = opts.dateFrom || "period"
  const to = opts.dateTo || "period"
  const slug = [opts.includeCrm ? "crm" : "", opts.includePos ? "pos" : ""].filter(Boolean).join("-")
  a.download = `sales-cash-${slug}-${from}-to-${to}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
