import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export type FinanceReportPayload = {
  range: { from: string; to: string }
  currency: string
  summary: Record<string, number>
  expensesByCategory: { category: string; amount: number }[]
  paymentMethods: { method: string; amount: number }[]
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
    amount: number
    status: string
    purpose: string
  }>
  pettySpend: Array<{
    date: string
    description: string
    amount: number
    status: string
  }>
  purchases: Array<{
    poNumber: string
    type: string
    date: string
    status: string
    value: number
    paidInPeriod: number
  }>
  importShipments: Array<{
    shipmentNumber: string
    supplierName: string
    date: string
    status: string
    landedPkr: number
    paidInPeriod: number
  }>
  generatedAt?: string
}

function fmt(n: number) {
  return `Rs ${(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
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

function sectionTitle(doc: jsPDF, title: string, y: number, mL: number) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(title, mL, y)
  return y + 4
}

export async function downloadFinanceReportPDF(
  data: FinanceReportPayload,
  generatedBy = "Admin",
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const teal: [number, number, number] = [31, 172, 166]
  const mL = 14
  const pageW = 210
  const s = data.summary

  doc.setFillColor(...teal)
  doc.rect(0, 0, pageW, 36, "F")
  const logo = await loadImageBase64("/logo.png")
  if (logo) {
    try {
      doc.addImage(logo, "PNG", mL, 6, 20, 20)
    } catch {
      /* ignore */
    }
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text("VOLTRIX — Finance Report", logo ? mL + 24 : mL, 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`Period: ${data.range.from} → ${data.range.to}`, logo ? mL + 24 : mL, 21)
  doc.text(
    `Generated ${new Date(data.generatedAt || Date.now()).toLocaleString("en-PK")} · ${generatedBy}`,
    logo ? mL + 24 : mL,
    27,
  )
  doc.text("Confidential — Admin only", logo ? mL + 24 : mL, 32)

  let y = 44
  y = sectionTitle(doc, "Executive summary", y, mL)

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Amount / Count"]],
    body: [
      ["Orders created (excl. draft/cancelled)", `${s.allOrdersCount} · ${fmt(s.allOrdersValue)}`],
      ["Orders delivered in period", `${s.deliveredCount} · ${fmt(s.deliveredRevenue)}`],
      ["Cash received (approved payments)", fmt(s.cashReceived)],
      ["POS sales", `${s.posCount} · ${fmt(s.posSalesTotal)}`],
      ["Finance expenses / records", fmt(s.expensesTotal)],
      ["Petty cash allocated", fmt(s.pettyAllocated)],
      ["Petty cash spent (approved)", fmt(s.pettyApprovedSpent)],
      ["Local / trade POs (value)", `${s.localPoCount} · ${fmt(s.localPoValue)}`],
      ["Local / trade PO paid", fmt(s.localPaid)],
      ["Imported POs (value)", `${s.importedPoCount} · ${fmt(s.importedPoValue)}`],
      ["Imported PO paid", fmt(s.importedPaid)],
      ["Import shipments landed", fmt(s.importShipmentsLanded)],
      ["Import shipments paid", fmt(s.importShipmentsPaid)],
      ["Purchase ledger spend", fmt(s.ledgerSpend)],
      ["Money in", fmt(s.moneyIn)],
      ["Money out", fmt(s.moneyOut)],
      ["Net cash flow", fmt(s.netCashFlow)],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: teal, textColor: 255 },
    margin: { left: mL, right: mL },
    columnStyles: { 1: { halign: "right" } },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  if (data.expensesByCategory.length > 0) {
    y = sectionTitle(doc, "Expenses by category", y, mL)
    autoTable(doc, {
      startY: y,
      head: [["Category", "Amount"]],
      body: data.expensesByCategory.map((r) => [r.category, fmt(r.amount)]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: teal, textColor: 255 },
      margin: { left: mL, right: mL },
      columnStyles: { 1: { halign: "right" } },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  if (data.deliveredOrders.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = 20
    }
    y = sectionTitle(doc, "Delivered orders", y, mL)
    autoTable(doc, {
      startY: y,
      head: [["Order", "Client", "Date", "Total", "Cash on order"]],
      body: data.deliveredOrders.slice(0, 80).map((o) => [
        o.orderNumber,
        o.clientName.slice(0, 28),
        o.date,
        fmt(o.total),
        fmt(o.cashReceived),
      ]),
      theme: "striped",
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: teal, textColor: 255 },
      margin: { left: mL, right: mL },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  if (data.expenseLines.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = 20
    }
    y = sectionTitle(doc, "Expense / finance records", y, mL)
    autoTable(doc, {
      startY: y,
      head: [["Date", "Title", "Category", "By", "Amount"]],
      body: data.expenseLines.slice(0, 80).map((e) => [
        e.date,
        e.title.slice(0, 32),
        e.category,
        (e.createdBy || "—").slice(0, 14),
        fmt(e.amount),
      ]),
      theme: "striped",
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: teal, textColor: 255 },
      margin: { left: mL, right: mL },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  if (data.pettyAllocations.length > 0 || data.pettySpend.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = 20
    }
    y = sectionTitle(doc, "Petty cash", y, mL)
    if (data.pettyAllocations.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Date", "Employee", "Purpose", "Status", "Amount"]],
        body: data.pettyAllocations.slice(0, 40).map((a) => [
          a.date,
          a.employeeName.slice(0, 20),
          (a.purpose || "—").slice(0, 24),
          a.status,
          fmt(a.amount),
        ]),
        theme: "striped",
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: teal, textColor: 255 },
        margin: { left: mL, right: mL },
      })
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    }
    if (data.pettySpend.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Date", "Receipt", "Status", "Amount"]],
        body: data.pettySpend.slice(0, 40).map((r) => [
          r.date,
          r.description.slice(0, 40),
          r.status,
          fmt(r.amount),
        ]),
        theme: "striped",
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: teal, textColor: 255 },
        margin: { left: mL, right: mL },
      })
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    }
  }

  if (data.purchases.length > 0 || data.importShipments.length > 0) {
    doc.addPage()
    y = 20
    y = sectionTitle(doc, "Purchases (local / imported POs)", y, mL)
    if (data.purchases.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["PO", "Type", "Date", "Status", "Value", "Paid in period"]],
        body: data.purchases.slice(0, 60).map((p) => [
          p.poNumber,
          p.type,
          p.date,
          p.status,
          fmt(p.value),
          fmt(p.paidInPeriod),
        ]),
        theme: "striped",
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: teal, textColor: 255 },
        margin: { left: mL, right: mL },
      })
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    }
    if (data.importShipments.length > 0) {
      y = sectionTitle(doc, "Import shipments", y, mL)
      autoTable(doc, {
        startY: y,
        head: [["Shipment", "Supplier", "Date", "Landed PKR", "Paid"]],
        body: data.importShipments.slice(0, 40).map((sh) => [
          sh.shipmentNumber,
          (sh.supplierName || "—").slice(0, 24),
          sh.date,
          fmt(sh.landedPkr),
          fmt(sh.paidInPeriod),
        ]),
        theme: "striped",
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: teal, textColor: 255 },
        margin: { left: mL, right: mL },
      })
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(
      `Voltrix Finance Report · ${data.range.from} to ${data.range.to} · Page ${i}/${pageCount}`,
      mL,
      290,
    )
  }

  doc.save(`voltrix-finance-report-${data.range.from}-to-${data.range.to}.pdf`)
}

export function downloadFinanceReportCSV(data: FinanceReportPayload) {
  const rows: string[][] = [
    ["Voltrix Finance Report"],
    ["From", data.range.from],
    ["To", data.range.to],
    [],
    ["SUMMARY"],
    ["Metric", "Value"],
    ...Object.entries(data.summary).map(([k, v]) => [k, String(v)]),
    [],
    ["EXPENSES BY CATEGORY"],
    ["Category", "Amount"],
    ...data.expensesByCategory.map((r) => [r.category, String(r.amount)]),
    [],
    ["DELIVERED ORDERS"],
    ["Order", "Client", "Date", "Total", "CashReceived"],
    ...data.deliveredOrders.map((o) => [
      o.orderNumber,
      o.clientName,
      o.date,
      String(o.total),
      String(o.cashReceived),
    ]),
    [],
    ["EXPENSE LINES"],
    ["Date", "Title", "Category", "Amount", "CreatedBy"],
    ...data.expenseLines.map((e) => [
      e.date,
      e.title,
      e.category,
      String(e.amount),
      e.createdBy,
    ]),
    [],
    ["PETTY ALLOCATIONS"],
    ["Date", "Employee", "Purpose", "Status", "Amount"],
    ...data.pettyAllocations.map((a) => [
      a.date,
      a.employeeName,
      a.purpose,
      a.status,
      String(a.amount),
    ]),
    [],
    ["PETTY SPEND"],
    ["Date", "Description", "Status", "Amount"],
    ...data.pettySpend.map((r) => [r.date, r.description, r.status, String(r.amount)]),
    [],
    ["PURCHASES"],
    ["PO", "Type", "Date", "Status", "Value", "PaidInPeriod"],
    ...data.purchases.map((p) => [
      p.poNumber,
      p.type,
      p.date,
      p.status,
      String(p.value),
      String(p.paidInPeriod),
    ]),
    [],
    ["IMPORT SHIPMENTS"],
    ["Shipment", "Supplier", "Date", "LandedPkr", "Paid"],
    ...data.importShipments.map((sh) => [
      sh.shipmentNumber,
      sh.supplierName,
      sh.date,
      String(sh.landedPkr),
      String(sh.paidInPeriod),
    ]),
  ]

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `voltrix-finance-report-${data.range.from}-to-${data.range.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
