import type { MoneyOutDetailLine } from "@/lib/finance-money-out-details"
import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"

export type OperatingExpensesReportOptions = {
  periodLabel: string
  dateFrom?: string
  dateTo?: string
  exportedBy?: string
  includePettyCash?: boolean
  includePurchaseLedger?: boolean
  includeSalaries?: boolean
}

export type OperatingExpensesPayload = {
  pettyCash: MoneyOutDetailLine[]
  purchaseLedgerPurchases: MoneyOutDetailLine[]
  purchaseLedgerRents: MoneyOutDetailLine[]
  salaries: MoneyOutDetailLine[]
}

function sum(lines: MoneyOutDetailLine[]) {
  return lines.reduce((s, r) => s + (Number(r.amount) || 0), 0)
}

function rangeLabel(opts: OperatingExpensesReportOptions) {
  if (opts.dateFrom || opts.dateTo) {
    return dateRangeLabel(opts.dateFrom || "", opts.dateTo || "")
  }
  return opts.periodLabel || "Selected period"
}

function resolveIncludes(opts: OperatingExpensesReportOptions) {
  return {
    petty: opts.includePettyCash !== false,
    ledger: opts.includePurchaseLedger !== false,
    salaries: opts.includeSalaries !== false,
  }
}

function buildBuckets(data: OperatingExpensesPayload, opts: OperatingExpensesReportOptions) {
  const inc = resolveIncludes(opts)
  const petty = inc.petty ? data.pettyCash || [] : []
  const purchases = inc.ledger ? data.purchaseLedgerPurchases || [] : []
  const rents = inc.ledger ? data.purchaseLedgerRents || [] : []
  const salaries = inc.salaries ? data.salaries || [] : []
  const ledger = [...purchases, ...rents].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))

  const pettyTotal = sum(petty)
  const purchasesTotal = sum(purchases)
  const rentsTotal = sum(rents)
  const ledgerTotal = purchasesTotal + rentsTotal
  const salariesTotal = sum(salaries)
  const combined = pettyTotal + ledgerTotal + salariesTotal

  return {
    inc,
    petty,
    purchases,
    rents,
    ledger,
    salaries,
    pettyTotal,
    purchasesTotal,
    rentsTotal,
    ledgerTotal,
    salariesTotal,
    combined,
  }
}

function detailRows(lines: MoneyOutDetailLine[]): (string | number)[][] {
  if (!lines.length) return [["—", "No lines in this period", "", ""]]
  return lines.map((r) => [
    r.date || "—",
    r.label || "—",
    r.sublabel || "—",
    pkr(Number(r.amount) || 0),
  ])
}

function detailCols() {
  return [
    { header: "Date", width: 22 },
    { header: "Name / ref", width: 36 },
    { header: "Detail", width: 55, small: true },
    { header: "Amount", align: "right" as const, width: 28 },
  ]
}

/** Operating expenses PDF — petty cash + purchase ledger + salaries (no advances). */
export async function downloadFinanceOperatingExpensesPdf(
  data: OperatingExpensesPayload,
  opts: OperatingExpensesReportOptions,
) {
  const b = buildBuckets(data, opts)
  if (!b.inc.petty && !b.inc.ledger && !b.inc.salaries) {
    throw new Error("Select at least one expense source.")
  }

  const range = rangeLabel(opts)
  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const sources = [
    b.inc.petty ? "Petty cash (approved)" : null,
    b.inc.ledger ? "Purchase ledger" : null,
    b.inc.salaries ? "Salaries" : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const overviewRows: (string | number)[][] = []
  if (b.inc.petty) {
    overviewRows.push(["Petty cash (approved)", pkr(b.pettyTotal)])
    overviewRows.push(["  · lines", String(b.petty.length)])
  }
  if (b.inc.ledger) {
    overviewRows.push(["Purchase ledger · purchases", pkr(b.purchasesTotal)])
    overviewRows.push(["Purchase ledger · rents", pkr(b.rentsTotal)])
    overviewRows.push(["Purchase ledger · total", pkr(b.ledgerTotal)])
    overviewRows.push(["  · payment lines", String(b.ledger.length)])
  }
  if (b.inc.salaries) {
    overviewRows.push(["Salaries (payroll)", pkr(b.salariesTotal)])
    overviewRows.push(["  · slips / records", String(b.salaries.length)])
  }
  overviewRows.push(["Combined operating expenses", pkr(b.combined)])

  const tables: PlainTable[] = [
    {
      title: "Overview",
      columns: [
        { header: "Metric", width: 90 },
        { header: "Amount", align: "right", width: 50 },
      ],
      rows: overviewRows,
    },
  ]

  if (b.inc.petty) {
    tables.push({
      title: "Petty cash (approved)",
      sectionStart: "Petty cash",
      columns: detailCols(),
      rows: detailRows(b.petty),
      foot: b.petty.length ? ["", "", String(b.petty.length), pkr(b.pettyTotal)] : undefined,
    })
  }

  if (b.inc.ledger) {
    tables.push({
      title: "Purchase ledger · purchases",
      sectionStart: "Purchase ledger",
      columns: detailCols(),
      rows: detailRows(b.purchases),
      foot: b.purchases.length
        ? ["", "", String(b.purchases.length), pkr(b.purchasesTotal)]
        : undefined,
    })
    tables.push({
      title: "Purchase ledger · rents",
      columns: detailCols(),
      rows: detailRows(b.rents),
      foot: b.rents.length ? ["", "", String(b.rents.length), pkr(b.rentsTotal)] : undefined,
    })
  }

  if (b.inc.salaries) {
    tables.push({
      title: "Salaries (payroll)",
      sectionStart: "Salaries",
      columns: detailCols(),
      rows: detailRows(b.salaries),
      foot: b.salaries.length
        ? ["", "", String(b.salaries.length), pkr(b.salariesTotal)]
        : undefined,
    })
  }

  await downloadPlainReportPdf({
    title: "Operating expenses",
    subtitle: `${sources} · advances excluded`,
    meta: [
      range,
      `${opts.exportedBy ? `${opts.exportedBy} · ` : ""}Generated  ${generated}  (Pakistan time)`,
    ],
    filename: `operating-expenses-${new Date().toISOString().slice(0, 10)}.pdf`,
    compact: true,
    landscape: true,
    tables,
    closingBanner: {
      title: "Combined operating expenses",
      lines: [
        ...(b.inc.petty
          ? [{ label: "Petty cash (approved)", value: pkr(b.pettyTotal) }]
          : []),
        ...(b.inc.ledger
          ? [{ label: "Purchase ledger", value: pkr(b.ledgerTotal) }]
          : []),
        ...(b.inc.salaries
          ? [{ label: "Salaries (payroll)", value: pkr(b.salariesTotal) }]
          : []),
        { label: "Combined · operating expenses", value: pkr(b.combined) },
      ],
    },
  })
}

function paintHeader(row: { eachCell: (cb: (cell: any) => void) => void; height?: number }) {
  row.eachCell((cell: any) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1FACA6" } }
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
    cell.alignment = { vertical: "middle", wrapText: true }
    cell.border = { bottom: { style: "thin", color: { argb: "FF0F766E" } } }
  })
  row.height = 20
}

function moneyCell(cell: any) {
  cell.numFmt = "#,##0"
  cell.alignment = { horizontal: "right", vertical: "middle" }
}

function highlightRow(row: any) {
  row.eachCell((cell: any) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F7F6" } }
    cell.font = { bold: true, size: 11, color: { argb: "FF0D7370" } }
  })
  row.height = 22
}

function addDetailSheet(
  wb: any,
  name: string,
  tabColor: string,
  title: string,
  lines: MoneyOutDetailLine[],
  total: number,
) {
  const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: tabColor } } })
  ws.addRow([title]).font = { bold: true, size: 13, color: { argb: "FF134E4A" } }
  ws.addRow([])
  paintHeader(ws.addRow(["Date", "Name / ref", "Detail", "Amount (PKR)"]))
  for (const r of lines) {
    const row = ws.addRow([
      r.date || "",
      r.label || "",
      r.sublabel || "",
      Number(r.amount) || 0,
    ])
    moneyCell(row.getCell(4))
  }
  if (!lines.length) {
    ws.addRow(["", "No lines in this period", "", ""])
  }
  const foot = ws.addRow(["", "", `TOTAL (${lines.length})`, total])
  foot.font = { bold: true }
  moneyCell(foot.getCell(4))
  highlightRow(foot)
  ;[14, 28, 42, 16].forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
  ws.views = [{ state: "frozen", ySplit: 3 }]
  return ws
}

/** Operating expenses Excel — Combined + Petty / Ledger / Salaries sheets (no advances). */
export async function downloadFinanceOperatingExpensesExcel(
  data: OperatingExpensesPayload,
  opts: OperatingExpensesReportOptions,
) {
  const b = buildBuckets(data, opts)
  if (!b.inc.petty && !b.inc.ledger && !b.inc.salaries) {
    throw new Error("Select at least one expense source.")
  }

  const ExcelJSMod = await import("exceljs")
  const ExcelJS = ExcelJSMod.default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Voltrix ERP"
  wb.created = new Date()

  const range = rangeLabel(opts)
  const sources = [
    b.inc.petty ? "Petty cash" : null,
    b.inc.ledger ? "Purchase ledger" : null,
    b.inc.salaries ? "Salaries" : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const combined = wb.addWorksheet("Combined", {
    properties: { tabColor: { argb: "FF1FACA6" } },
  })
  combined.addRow(["VOLTRIX — Operating expenses"]).font = {
    bold: true,
    size: 16,
    color: { argb: "FF134E4A" },
  }
  combined.addRow([`Period: ${range}`])
  combined.addRow([
    `Sources: ${sources} · advances excluded${opts.exportedBy ? ` · ${opts.exportedBy}` : ""} · ${new Date().toLocaleString("en-PK")}`,
  ])
  combined.addRow([])
  paintHeader(combined.addRow(["Metric", "Amount (PKR)"]))

  const addMetric = (label: string, value: number, highlight = false) => {
    const row = combined.addRow([label, value])
    moneyCell(row.getCell(2))
    if (highlight) highlightRow(row)
    return row
  }

  if (b.inc.petty) {
    addMetric("Petty cash (approved)", b.pettyTotal)
    combined.addRow(["  · lines", b.petty.length])
  }
  if (b.inc.ledger) {
    addMetric("Purchase ledger · purchases", b.purchasesTotal)
    addMetric("Purchase ledger · rents", b.rentsTotal)
    addMetric("Purchase ledger · total", b.ledgerTotal)
    combined.addRow(["  · payment lines", b.ledger.length])
  }
  if (b.inc.salaries) {
    addMetric("Salaries (payroll)", b.salariesTotal)
    combined.addRow(["  · slips / records", b.salaries.length])
  }

  combined.addRow([])
  combined.addRow(["COMBINED TOTALS"]).font = {
    bold: true,
    size: 12,
    color: { argb: "FF0D7370" },
  }
  if (b.inc.petty) addMetric("Petty cash (approved)", b.pettyTotal, true)
  if (b.inc.ledger) addMetric("Purchase ledger", b.ledgerTotal, true)
  if (b.inc.salaries) addMetric("Salaries (payroll)", b.salariesTotal, true)
  addMetric("Combined · operating expenses", b.combined, true)

  combined.getColumn(1).width = 40
  combined.getColumn(2).width = 18

  if (b.inc.petty) {
    addDetailSheet(
      wb,
      "Petty cash",
      "FFF59E0B",
      "Petty cash (approved) — expense receipts",
      b.petty,
      b.pettyTotal,
    )
  }
  if (b.inc.ledger) {
    addDetailSheet(
      wb,
      "Ledger purchases",
      "FF0EA5E9",
      "Purchase ledger — purchases (payments in period)",
      b.purchases,
      b.purchasesTotal,
    )
    addDetailSheet(
      wb,
      "Ledger rents",
      "FF6366F1",
      "Purchase ledger — rents (payments in period)",
      b.rents,
      b.rentsTotal,
    )
  }
  if (b.inc.salaries) {
    addDetailSheet(
      wb,
      "Salaries",
      "FFEC4899",
      "Salaries (payroll) — advances excluded",
      b.salaries,
      b.salariesTotal,
    )
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `operating-expenses-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
