import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export type FinanceReportPayload = {
  range: { from: string; to: string }
  currency: string
  summary: Record<string, number>
  expensesByCategory: { category: string; amount: number }[]
  paymentMethods: { method: string; amount: number }[]
  orderPayments?: Array<{
    orderNumber: string
    clientName: string
    date: string
    method: string
    amount: number
    recordedBy: string
    orderStatus: string
    orderTotal: number
  }>
  deliveredOrders: Array<{
    orderNumber: string
    clientName: string
    date: string
    status: string
    total: number
    cashReceived: number
  }>
  expenseLines: Array<{
    date: string
    title: string
    category: string
    amount: number
    createdBy: string
  }>
  pettyAllocations: Array<{
    date: string
    employeeName: string
    allocatedBy?: string
    amount: number
    status: string
    purpose: string
    payoutMethod?: string
  }>
  pettySpend: Array<{
    date: string
    employeeName?: string
    description: string
    amount: number
    status: string
  }>
  purchases: Array<{
    poNumber: string
    type: string
    date: string
    status: string
    supplier?: string
    value: number
    paidInPeriod: number
    createdInPeriod?: boolean
  }>
  importShipments: Array<{
    shipmentNumber: string
    supplierName: string
    date: string
    status: string
    landedPkr: number
    paidInPeriod: number
  }>
  purchaseLedger?: Array<{
    ledgerNumber: string
    date: string
    supplierName: string
    productName: string
    category: string
    transactionType: string
    totalAmount: number
    amountPaid: number
    amountDue: number
    createdBy: string
  }>
  generatedAt?: string
}

type JsDoc = jsPDF & { lastAutoTable?: { finalY: number } }

const TEAL: [number, number, number] = [31, 172, 166]
const TEAL_DARK: [number, number, number] = [22, 140, 136]
const SLATE: [number, number, number] = [51, 65, 85]
const MARGIN = 12

function fmt(n: number) {
  return `Rs ${(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function num(n: number) {
  return Number(n ?? 0)
}

function safeText(s: string | null | undefined, max = 48) {
  const t = String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
  if (!t) return "—"
  // Helvetica cannot render Urdu/Arabic; keep a readable placeholder
  if (/[\u0600-\u06FF]/.test(t)) {
    const latin = t.replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g, "…").trim()
    return (latin || "Urdu note").slice(0, max)
  }
  return t.slice(0, max)
}

async function loadImageBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return ""
    const blob = await res.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(blob)
    })
  } catch {
    return ""
  }
}

function ensureSpace(doc: JsDoc, y: number, need = 40): number {
  const pageH = doc.internal.pageSize.getHeight()
  if (y > pageH - need) {
    doc.addPage()
    return 18
  }
  return y
}

function sectionTitle(doc: JsDoc, title: string, y: number) {
  y = ensureSpace(doc, y, 28)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...SLATE)
  doc.text(title, MARGIN, y)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.7)
  doc.line(MARGIN, y + 1.8, MARGIN + Math.min(42, title.length * 2.2), y + 1.8)
  return y + 6
}

function kpiRow(
  doc: JsDoc,
  y: number,
  items: { label: string; value: string }[],
) {
  const pageW = doc.internal.pageSize.getWidth()
  const gap = 3
  const cardW = (pageW - MARGIN * 2 - gap * (items.length - 1)) / items.length
  items.forEach((item, i) => {
    const x = MARGIN + i * (cardW + gap)
    doc.setFillColor(248, 250, 250)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(x, y, cardW, 16, 1.5, 1.5, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text(item.label.toUpperCase(), x + 3, y + 5)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(...SLATE)
    doc.text(item.value, x + 3, y + 11.5)
  })
  return y + 20
}

function tableOpts(startY: number) {
  return {
    startY,
    theme: "striped" as const,
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: SLATE as [number, number, number],
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.1,
      overflow: "linebreak" as const,
    },
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontStyle: "bold" as const,
      fontSize: 7.5,
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: [248, 250, 250] as [number, number, number] },
    margin: { left: MARGIN, right: MARGIN },
  }
}

function afterTable(doc: JsDoc) {
  return (doc.lastAutoTable?.finalY || 40) + 8
}

export async function downloadFinanceReportPDF(
  data: FinanceReportPayload,
  generatedBy = "Admin",
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsDoc
  const pageW = doc.internal.pageSize.getWidth()
  const s = data.summary
  const localPurchases = (data.purchases || []).filter((p) => p.type !== "imported")
  const importedPurchases = (data.purchases || []).filter((p) => p.type === "imported")

  // Header
  doc.setFillColor(...TEAL_DARK)
  doc.rect(0, 0, pageW, 34, "F")
  const logo = await loadImageBase64("/logo.png")
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGIN, 7, 18, 18)
    } catch {
      /* ignore */
    }
  }
  const textX = logo ? MARGIN + 22 : MARGIN
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("VOLTRIX — Finance Report", textX, 13)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.text(`Period: ${data.range.from}  →  ${data.range.to}`, textX, 20)
  doc.text(
    `Generated ${new Date(data.generatedAt || Date.now()).toLocaleString("en-PK")} · ${generatedBy}`,
    textX,
    26,
  )
  doc.setFontSize(7.5)
  doc.text("Confidential — Admin only", pageW - MARGIN, 13, { align: "right" })

  let y = 42
  y = sectionTitle(doc, "Executive summary", y)
  y = kpiRow(doc, y, [
    { label: "Money in", value: fmt(s.moneyIn) },
    { label: "Money out", value: fmt(s.moneyOut) },
    { label: "Net cash flow", value: fmt(s.netCashFlow) },
  ])

  autoTable(doc, {
    ...tableOpts(y),
    theme: "grid",
    head: [["Metric", "Amount / Count"]],
    body: [
      ["Orders created (excl. draft/cancelled)", `${s.allOrdersCount || 0} · ${fmt(s.allOrdersValue)}`],
      ["Orders delivered in period", `${s.deliveredCount || 0} · ${fmt(s.deliveredRevenue)}`],
      ["Cash received on orders (approved)", `${s.orderPaymentsCount || 0} payments · ${fmt(s.cashReceived)}`],
      ["POS sales", `${s.posCount || 0} · ${fmt(s.posSalesTotal)}`],
      ["Finance expenses / records", fmt(s.expensesTotal)],
      ["Petty cash allocated", `${s.pettyAllocationsCount || 0} · ${fmt(s.pettyAllocated)}`],
      ["Petty cash spent (approved)", fmt(s.pettyApprovedSpent)],
      ["Local / trade purchases (value)", `${s.localPoCount || 0} · ${fmt(s.localPoValue)}`],
      ["Local / trade purchases paid", fmt(s.localPaid)],
      ["Imported PO purchases (value)", `${s.importedPoCount || 0} · ${fmt(s.importedPoValue)}`],
      ["Imported PO paid", fmt(s.importedPaid)],
      ["Import shipments landed", fmt(s.importShipmentsLanded)],
      ["Import shipments paid", fmt(s.importShipmentsPaid)],
      ["Purchase total (local + imported + shipments)", fmt(s.purchaseTotalValue)],
      ["Purchase ledger total / paid", `${fmt(s.ledgerTotal)} / ${fmt(s.ledgerSpend)}`],
      ["Money in", fmt(s.moneyIn)],
      ["Money out", fmt(s.moneyOut)],
      ["Net cash flow", fmt(s.netCashFlow)],
    ],
    columnStyles: { 1: { halign: "right" } },
  })
  y = afterTable(doc)

  // Payment methods
  if ((data.paymentMethods || []).length > 0) {
    y = sectionTitle(doc, "Cash received by payment method", y)
    autoTable(doc, {
      ...tableOpts(y),
      head: [["Method", "Amount"]],
      body: (data.paymentMethods || []).map((r) => [safeText(r.method, 30), fmt(r.amount)]),
      columnStyles: { 1: { halign: "right" } },
    })
    y = afterTable(doc)
  }

  // Order payments (cash added to orders)
  y = sectionTitle(doc, "Order cash received (approved payments in period)", y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`Total cash received on orders: ${fmt(s.cashReceived)}`, MARGIN, y)
  y += 4
  if ((data.orderPayments || []).length > 0) {
    autoTable(doc, {
      ...tableOpts(y),
      head: [["Date", "Order", "Client", "Method", "By", "Order total", "Received"]],
      body: (data.orderPayments || []).map((p) => [
        p.date,
        p.orderNumber,
        safeText(p.clientName, 22),
        safeText(p.method, 14),
        safeText(p.recordedBy, 12),
        fmt(p.orderTotal),
        fmt(p.amount),
      ]),
      columnStyles: { 5: { halign: "right" }, 6: { halign: "right" } },
    })
    y = afterTable(doc)
  } else {
    doc.setTextColor(...SLATE)
    doc.text("No approved order payments in this period.", MARGIN, y + 4)
    y += 12
  }

  // Delivered orders
  if ((data.deliveredOrders || []).length > 0) {
    y = sectionTitle(doc, "Delivered orders", y)
    autoTable(doc, {
      ...tableOpts(y),
      head: [["Order", "Client", "Date", "Order total", "Cash on order"]],
      body: data.deliveredOrders.map((o) => [
        o.orderNumber,
        safeText(o.clientName, 26),
        o.date,
        fmt(o.total),
        fmt(o.cashReceived),
      ]),
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
    })
    y = afterTable(doc)
  }

  // Petty cash allocations only
  y = sectionTitle(doc, "Petty cash allocated", y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Total allocated: ${fmt(s.pettyAllocated)} · ${(data.pettyAllocations || []).length} allocation(s)`,
    MARGIN,
    y,
  )
  y += 4
  if ((data.pettyAllocations || []).length > 0) {
    autoTable(doc, {
      ...tableOpts(y),
      head: [["Date", "Given to", "Allocated by", "Purpose", "Status", "Amount"]],
      body: data.pettyAllocations.map((a) => [
        a.date,
        safeText(a.employeeName, 18),
        safeText(a.allocatedBy || "—", 16),
        safeText(a.purpose, 28),
        a.status,
        fmt(a.amount),
      ]),
      columnStyles: { 5: { halign: "right" } },
    })
    y = afterTable(doc)
  } else {
    doc.setTextColor(...SLATE)
    doc.text("No petty cash allocations in this period.", MARGIN, y + 4)
    y += 12
  }

  // Purchases summary + local
  y = sectionTitle(doc, "Purchases overview", y)
  y = kpiRow(doc, y, [
    { label: "Local / trade", value: fmt(s.localPoValue) },
    { label: "Imported POs", value: fmt(s.importedPoValue) },
    { label: "Shipments landed", value: fmt(s.importShipmentsLanded) },
    { label: "Ledger paid", value: fmt(s.ledgerSpend) },
  ])

  y = sectionTitle(doc, "Local / trade purchases", y)
  if (localPurchases.length > 0) {
    autoTable(doc, {
      ...tableOpts(y),
      head: [["PO", "Supplier", "Date", "Status", "Value", "Paid in period"]],
      body: localPurchases.map((p) => [
        p.poNumber,
        safeText(p.supplier, 22),
        p.date,
        safeText(p.status, 14),
        fmt(p.value),
        fmt(p.paidInPeriod),
      ]),
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
    })
    y = afterTable(doc)
  } else {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    doc.text("No local / trade purchase activity in this period.", MARGIN, y + 2)
    y += 10
  }

  y = sectionTitle(doc, "Imported purchases (POs)", y)
  if (importedPurchases.length > 0) {
    autoTable(doc, {
      ...tableOpts(y),
      head: [["PO", "Supplier", "Date", "Status", "Value", "Paid in period"]],
      body: importedPurchases.map((p) => [
        p.poNumber,
        safeText(p.supplier, 22),
        p.date,
        safeText(p.status, 14),
        fmt(p.value),
        fmt(p.paidInPeriod),
      ]),
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
    })
    y = afterTable(doc)
  } else {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    doc.text("No imported PO activity in this period.", MARGIN, y + 2)
    y += 10
  }

  if ((data.importShipments || []).length > 0) {
    y = sectionTitle(doc, "Import shipments", y)
    autoTable(doc, {
      ...tableOpts(y),
      head: [["Shipment", "Supplier", "Date", "Status", "Landed PKR", "Paid"]],
      body: data.importShipments.map((sh) => [
        sh.shipmentNumber,
        safeText(sh.supplierName, 22),
        sh.date,
        safeText(sh.status, 12),
        fmt(sh.landedPkr),
        fmt(sh.paidInPeriod),
      ]),
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
    })
    y = afterTable(doc)
  }

  if ((data.purchaseLedger || []).length > 0) {
    y = sectionTitle(doc, "Purchase ledger", y)
    autoTable(doc, {
      ...tableOpts(y),
      head: [["Ledger #", "Date", "Supplier", "Product / note", "Total", "Paid", "Due"]],
      body: (data.purchaseLedger || []).map((r) => [
        r.ledgerNumber,
        r.date,
        safeText(r.supplierName, 18),
        safeText(r.productName, 22),
        fmt(r.totalAmount),
        fmt(r.amountPaid),
        fmt(r.amountDue),
      ]),
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
    })
    y = afterTable(doc)
  }

  if ((data.expensesByCategory || []).length > 0) {
    y = sectionTitle(doc, "Expenses by category", y)
    autoTable(doc, {
      ...tableOpts(y),
      head: [["Category", "Amount"]],
      body: data.expensesByCategory.map((r) => [safeText(r.category, 40), fmt(r.amount)]),
      columnStyles: { 1: { halign: "right" } },
    })
    y = afterTable(doc)
  }

  if ((data.expenseLines || []).length > 0) {
    y = sectionTitle(doc, "Expense / finance records", y)
    autoTable(doc, {
      ...tableOpts(y),
      head: [["Date", "Title", "Category", "By", "Amount"]],
      body: data.expenseLines.map((e) => [
        e.date,
        safeText(e.title, 34),
        safeText(e.category, 14),
        safeText(e.createdBy || "—", 12),
        fmt(e.amount),
      ]),
      columnStyles: { 4: { halign: "right" } },
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pageH = doc.internal.pageSize.getHeight()
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, pageH - 12, pageW - MARGIN, pageH - 12)
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Voltrix Finance Report · ${data.range.from} to ${data.range.to}`,
      MARGIN,
      pageH - 7,
    )
    doc.text(`Page ${i} / ${pageCount}`, pageW - MARGIN, pageH - 7, { align: "right" })
  }

  doc.save(`voltrix-finance-report-${data.range.from}-to-${data.range.to}.pdf`)
}

export async function downloadFinanceReportExcel(
  data: FinanceReportPayload,
  generatedBy = "Admin",
) {
  const ExcelJSMod = await import("exceljs")
  const ExcelJS = ExcelJSMod.default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Voltrix ERP"
  wb.created = new Date()
  const s = data.summary
  const localPurchases = (data.purchases || []).filter((p) => p.type !== "imported")
  const importedPurchases = (data.purchases || []).filter((p) => p.type === "imported")
  const paymentMethods = data.paymentMethods || []
  const orderPayments = data.orderPayments || []
  const purchaseLedger = data.purchaseLedger || []

  const paintHeader = (row: { eachCell: (cb: (cell: Record<string, unknown>) => void) => void; height: number }) => {
    row.eachCell((cell) => {
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

  const addSheetTable = (
    ws: {
      addRow: (v: (string | number)[]) => {
        eachCell: (cb: (cell: Record<string, unknown>, col: number) => void) => void
        font?: unknown
      }
      columns: { width?: number }[]
      views: unknown[]
    },
    title: string,
    headers: string[],
    rows: (string | number)[][],
    moneyCols: number[] = [],
  ) => {
    const titleRow = ws.addRow([title])
    titleRow.font = { bold: true, size: 13, color: { argb: "FF134E4A" } }
    ws.addRow([])
    paintHeader(ws.addRow(headers) as never)
    rows.forEach((r) => {
      const row = ws.addRow(r)
      row.eachCell((cell, col) => {
        cell.alignment = { vertical: "middle", wrapText: true }
        cell.border = {
          top: { style: "hair", color: { argb: "FFE2E8F0" } },
          bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        }
        if (moneyCols.includes(col)) {
          cell.numFmt = "#,##0"
          cell.alignment = { horizontal: "right", vertical: "middle" }
        }
      })
    })
    ws.columns.forEach((col, i) => {
      const header = headers[i] || ""
      col.width = Math.min(36, Math.max(12, header.length + 4))
    })
    ws.views = [{ state: "frozen", ySplit: 3 }]
  }

  const summary = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: "FF1FACA6" } },
  })
  const brandRow = summary.addRow(["VOLTRIX — Finance Report"])
  brandRow.font = { bold: true, size: 16, color: { argb: "FF134E4A" } }
  summary.addRow([`Period: ${data.range.from} → ${data.range.to}`])
  summary.addRow([
    `Generated: ${new Date(data.generatedAt || Date.now()).toLocaleString("en-PK")} · ${generatedBy}`,
  ])
  summary.addRow(["Confidential — Admin only"])
  summary.addRow([])

  paintHeader(summary.addRow(["Metric", "Value"]))
  const summaryRows: [string, string | number][] = [
    ["Orders created (count)", s.allOrdersCount || 0],
    ["Orders created (value PKR)", num(s.allOrdersValue)],
    ["Orders delivered (count)", s.deliveredCount || 0],
    ["Orders delivered (value PKR)", num(s.deliveredRevenue)],
    ["Cash received on orders (PKR)", num(s.cashReceived)],
    ["Order payments (count)", s.orderPaymentsCount || 0],
    ["POS sales (PKR)", num(s.posSalesTotal)],
    ["Finance expenses (PKR)", num(s.expensesTotal)],
    ["Petty cash allocated (PKR)", num(s.pettyAllocated)],
    ["Petty allocations (count)", s.pettyAllocationsCount || 0],
    ["Petty cash spent approved (PKR)", num(s.pettyApprovedSpent)],
    ["Local purchases value (PKR)", num(s.localPoValue)],
    ["Local purchases paid (PKR)", num(s.localPaid)],
    ["Imported PO value (PKR)", num(s.importedPoValue)],
    ["Imported PO paid (PKR)", num(s.importedPaid)],
    ["Import shipments landed (PKR)", num(s.importShipmentsLanded)],
    ["Import shipments paid (PKR)", num(s.importShipmentsPaid)],
    ["Purchase total value (PKR)", num(s.purchaseTotalValue)],
    ["Purchase ledger total (PKR)", num(s.ledgerTotal)],
    ["Purchase ledger paid (PKR)", num(s.ledgerSpend)],
    ["Money in (PKR)", num(s.moneyIn)],
    ["Money out (PKR)", num(s.moneyOut)],
    ["Net cash flow (PKR)", num(s.netCashFlow)],
  ]
  summaryRows.forEach(([k, v]) => {
    const row = summary.addRow([k, v])
    if (typeof v === "number") {
      row.getCell(2).numFmt = "#,##0"
      row.getCell(2).alignment = { horizontal: "right" }
    }
  })
  summary.getColumn(1).width = 42
  summary.getColumn(2).width = 18

  if (paymentMethods.length) {
    summary.addRow([])
    const pmTitle = summary.addRow(["Cash by payment method"])
    pmTitle.font = { bold: true, size: 12 }
    paintHeader(summary.addRow(["Method", "Amount (PKR)"]))
    paymentMethods.forEach((r) => {
      const row = summary.addRow([r.method, num(r.amount)])
      row.getCell(2).numFmt = "#,##0"
    })
  }

  addSheetTable(
    wb.addWorksheet("Order cash received"),
    `Order cash received — total ${fmt(s.cashReceived)}`,
    ["Date", "Order", "Client", "Method", "Recorded by", "Order total", "Amount received", "Order status"],
    orderPayments.map((p) => [
      p.date,
      p.orderNumber,
      p.clientName,
      p.method,
      p.recordedBy,
      num(p.orderTotal),
      num(p.amount),
      p.orderStatus,
    ]),
    [6, 7],
  )

  addSheetTable(
    wb.addWorksheet("Delivered orders"),
    "Delivered orders",
    ["Order", "Client", "Date", "Order total", "Cash on order", "Status"],
    (data.deliveredOrders || []).map((o) => [
      o.orderNumber,
      o.clientName,
      o.date,
      num(o.total),
      num(o.cashReceived),
      o.status,
    ]),
    [4, 5],
  )

  addSheetTable(
    wb.addWorksheet("Petty cash allocated"),
    `Petty cash allocated — total ${fmt(s.pettyAllocated)}`,
    ["Date", "Given to (employee)", "Allocated by", "Purpose", "Payout method", "Status", "Amount"],
    (data.pettyAllocations || []).map((a) => [
      a.date,
      a.employeeName,
      a.allocatedBy || "—",
      a.purpose || "",
      a.payoutMethod || "",
      a.status,
      num(a.amount),
    ]),
    [7],
  )

  addSheetTable(
    wb.addWorksheet("Local purchases"),
    `Local / trade purchases — value ${fmt(s.localPoValue)} · paid ${fmt(s.localPaid)}`,
    ["PO", "Supplier", "Date", "Status", "Value", "Paid in period", "Created in period"],
    localPurchases.map((p) => [
      p.poNumber,
      p.supplier || "",
      p.date,
      p.status,
      num(p.value),
      num(p.paidInPeriod),
      p.createdInPeriod === false ? "No (payment only)" : "Yes",
    ]),
    [5, 6],
  )

  addSheetTable(
    wb.addWorksheet("Imported purchases"),
    `Imported POs — value ${fmt(s.importedPoValue)} · paid ${fmt(s.importedPaid)}`,
    ["PO", "Supplier", "Date", "Status", "Value", "Paid in period", "Created in period"],
    importedPurchases.map((p) => [
      p.poNumber,
      p.supplier || "",
      p.date,
      p.status,
      num(p.value),
      num(p.paidInPeriod),
      p.createdInPeriod === false ? "No (payment only)" : "Yes",
    ]),
    [5, 6],
  )

  addSheetTable(
    wb.addWorksheet("Import shipments"),
    `Import shipments — landed ${fmt(s.importShipmentsLanded)} · paid ${fmt(s.importShipmentsPaid)}`,
    ["Shipment", "Supplier", "Date", "Status", "Landed PKR", "Paid in period"],
    (data.importShipments || []).map((sh) => [
      sh.shipmentNumber,
      sh.supplierName || "",
      sh.date,
      sh.status,
      num(sh.landedPkr),
      num(sh.paidInPeriod),
    ]),
    [5, 6],
  )

  addSheetTable(
    wb.addWorksheet("Purchase ledger"),
    `Purchase ledger — total ${fmt(s.ledgerTotal)} · paid ${fmt(s.ledgerSpend)}`,
    ["Ledger #", "Date", "Supplier", "Product", "Category", "Type", "Total", "Paid", "Due", "Created by"],
    purchaseLedger.map((r) => [
      r.ledgerNumber,
      r.date,
      r.supplierName,
      r.productName,
      r.category,
      r.transactionType,
      num(r.totalAmount),
      num(r.amountPaid),
      num(r.amountDue),
      r.createdBy,
    ]),
    [7, 8, 9],
  )

  addSheetTable(
    wb.addWorksheet("Expenses"),
    "Expense / finance records",
    ["Date", "Title", "Category", "Created by", "Amount"],
    (data.expenseLines || []).map((e) => [
      e.date,
      e.title,
      e.category,
      e.createdBy || "",
      num(e.amount),
    ]),
    [5],
  )

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `voltrix-finance-report-${data.range.from}-to-${data.range.to}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

/** @deprecated Use downloadFinanceReportExcel — kept for compatibility */
export function downloadFinanceReportCSV(data: FinanceReportPayload) {
  void downloadFinanceReportExcel(data, "Admin")
}
