import { escCsvCell } from "@/lib/crm-excel-export"
import {
  formatLedgerItemsSummary,
  formatLedgerProject,
  formatLedgerSuppliers,
  formatLinkModeLabel,
  PURCHASE_TRANSACTION_TYPES,
  type PurchaseLedgerEntry,
} from "@/lib/purchase-ledger"

const TEAL: [number, number, number] = [31, 172, 166]
const TEAL_DARK: [number, number, number] = [26, 159, 154]
const MARGIN = 14

type JsDoc = import("jspdf").jsPDF & { lastAutoTable?: { finalY: number } }

function fmtMoney(n: number) {
  return `Rs. ${(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
}

function transactionTypeLabel(value: string) {
  return PURCHASE_TRANSACTION_TYPES.find(t => t.value === value)?.label ?? value
}

function formatQty(n: number) {
  const rounded = Math.round((n ?? 0) * 1000) / 1000
  return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString("en-PK", { maximumFractionDigits: 3 })
}

async function loadImageBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return ""
    const blob = await res.blob()
    return await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(blob)
    })
  } catch {
    return ""
  }
}

function drawBrandHeader(
  doc: JsDoc,
  title: string,
  metaLines: string[],
  rightTitle?: string,
) {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(...TEAL_DARK)
  doc.rect(0, 0, pageW, 34, "F")

  return loadImageBase64("/logo.png").then(logo => {
    if (logo) doc.addImage(logo, "PNG", MARGIN, 6, 16, 16)

    const textX = logo ? MARGIN + 20 : MARGIN
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text("VOLTRIX BATTERIES", textX, 12)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.text("Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", textX, 16.5)
    doc.text("051-8731661 · sale@voltrixbatteries.com", textX, 20)

    if (rightTitle) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text(rightTitle, pageW - MARGIN, 12, { align: "right" })
    }

    let y = 42
    doc.setTextColor(30, 30, 30)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(15)
    doc.text(title, MARGIN, y)
    y += 7

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    metaLines.forEach((line, i) => {
      doc.text(line, MARGIN, y + i * 4.5)
    })

    return y + metaLines.length * 4.5 + 4
  })
}

function drawFooter(doc: JsDoc) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, pageH - 12, pageW - MARGIN, pageH - 12)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text("Voltrix Batteries Pvt. Ltd. — Purchase Ledger", MARGIN, pageH - 7)
    doc.text(`Page ${i} of ${pages}`, pageW - MARGIN, pageH - 7, { align: "right" })
  }
}

function drawSectionTitle(doc: JsDoc, title: string, y: number) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text(title.toUpperCase(), MARGIN, y)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y + 1.5, MARGIN + 28, y + 1.5)
  return y + 6
}

function drawInfoGrid(doc: JsDoc, items: { label: string; value: string }[], startY: number) {
  const pageW = doc.internal.pageSize.getWidth()
  const colW = (pageW - MARGIN * 2 - 4) / 2
  let y = startY
  const rowH = 11

  for (let i = 0; i < items.length; i += 2) {
    for (let col = 0; col < 2; col++) {
      const item = items[i + col]
      if (!item) continue
      const x = MARGIN + col * (colW + 4)
      doc.setFillColor(248, 250, 250)
      doc.setDrawColor(230, 235, 235)
      doc.setLineWidth(0.2)
      doc.roundedRect(x, y, colW, rowH, 1.5, 1.5, "FD")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text(item.label.toUpperCase(), x + 3, y + 4)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(30, 30, 30)
      const wrapped = doc.splitTextToSize(item.value || "—", colW - 6)
      doc.text(wrapped.slice(0, 2), x + 3, y + 8)
    }
    y += rowH + 3
  }
  return y + 2
}

function drawPaymentSummary(doc: JsDoc, total: number, paid: number, due: number, startY: number) {
  const pageW = doc.internal.pageSize.getWidth()
  const cards = [
    { label: "Total", value: fmtMoney(total), color: TEAL },
    { label: "Paid", value: fmtMoney(paid), color: [16, 140, 90] as [number, number, number] },
    { label: "Due", value: fmtMoney(due), color: due > 0 ? [200, 120, 20] as [number, number, number] : [120, 120, 120] as [number, number, number] },
  ]
  const gap = 4
  const cardW = (pageW - MARGIN * 2 - gap * 2) / 3
  let x = MARGIN

  cards.forEach(card => {
    doc.setFillColor(...card.color)
    doc.roundedRect(x, startY, cardW, 18, 2, 2, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.text(card.label, x + cardW / 2, startY + 6, { align: "center" })
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text(card.value, x + cardW / 2, startY + 13.5, { align: "center" })
    x += cardW + gap
  })

  return startY + 24
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

function entryToRow(entry: PurchaseLedgerEntry): (string | number)[] {
  return [
    entry.ledgerNumber,
    entry.transactionDate,
    formatLinkModeLabel(entry.linkMode),
    formatLedgerProject(entry),
    formatLedgerSuppliers(entry),
    formatLedgerItemsSummary(entry),
    transactionTypeLabel(entry.transactionType),
    entry.totalAmount,
    entry.amountPaid,
    entry.amountDue,
    entry.dueDate || "",
    entry.notes || "",
    entry.createdBy || "",
  ]
}

const LEDGER_HEADERS = [
  "Ledger No.",
  "Date",
  "Link Type",
  "Project / Supplier",
  "Supplier(s)",
  "Items",
  "Transaction Type",
  "Total",
  "Paid",
  "Due",
  "Due Date",
  "Note",
  "Created By",
]

function rowsToCsv(headers: string[], rows: (string | number)[][]) {
  return [
    headers.map(h => escCsvCell(h)).join(","),
    ...rows.map(r => r.map(c => escCsvCell(c)).join(",")),
  ].join("\r\n")
}

export type PurchaseLedgerExportMeta = {
  exportedBy?: string
  filterSummary?: string
}

export function downloadPurchaseLedgerExcel(entries: PurchaseLedgerEntry[], meta?: PurchaseLedgerExportMeta) {
  let csv = ""
  if (meta?.exportedBy) {
    csv += `${escCsvCell("Exported by")},${escCsvCell(meta.exportedBy)}\r\n`
    csv += `${escCsvCell("Export time")},${escCsvCell(new Date().toLocaleString("en-PK"))}\r\n`
    if (meta.filterSummary) csv += `${escCsvCell("Filters")},${escCsvCell(meta.filterSummary)}\r\n`
    csv += "\r\n"
  }
  csv += rowsToCsv(LEDGER_HEADERS, entries.map(entryToRow))
  downloadCsv(`purchase-ledger-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export function downloadPurchaseLedgerEntryExcel(entry: PurchaseLedgerEntry) {
  const itemHeaders = ["Supplier", "Product", "Qty", "Unit Price", "Line Total"]
  const itemRows = entry.supplierGroups.length > 0
    ? entry.supplierGroups.flatMap(g => g.items.map(i => [
      g.supplierName,
      i.productName,
      i.quantity,
      i.unitPrice,
      i.lineTotal,
    ]))
    : entry.items.map(i => [entry.supplierName, i.productName, i.quantity, i.unitPrice, i.lineTotal])

  let csv = rowsToCsv(LEDGER_HEADERS, [entryToRow(entry)])
  if (itemRows.length > 0) {
    csv += `\r\n\r\n${rowsToCsv(itemHeaders, itemRows)}`
  }
  downloadCsv(`${entry.ledgerNumber}-purchase.csv`, csv)
}

export async function downloadPurchaseLedgerReportPDF(
  entries: PurchaseLedgerEntry[],
  meta?: PurchaseLedgerExportMeta,
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const landscape = entries.length > 4
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: landscape ? "landscape" : "portrait" }) as JsDoc
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const mL = MARGIN

  const totalAmount = entries.reduce((s, e) => s + e.totalAmount, 0)
  const totalPaid = entries.reduce((s, e) => s + e.amountPaid, 0)
  const totalDue = entries.reduce((s, e) => s + e.amountDue, 0)

  const metaLines = [
    meta?.exportedBy ? `Exported by ${meta.exportedBy}` : "",
    meta?.filterSummary ? `Filters: ${meta.filterSummary}` : "Filters: All entries",
    `Generated ${new Date().toLocaleString("en-PK")}`,
  ].filter(Boolean)

  let y = await drawBrandHeader(doc, "Purchase Ledger Report", metaLines, "SUMMARY")

  y = drawPaymentSummary(doc, totalAmount, totalPaid, totalDue, y)
  y += 2

  doc.setFillColor(248, 250, 250)
  doc.roundedRect(mL, y, pageW - mL * 2, 10, 1.5, 1.5, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text(`${entries.length} ${entries.length === 1 ? "entry" : "entries"} in this report`, mL + 4, y + 6.5)
  y += 14

  y = drawSectionTitle(doc, "Ledger entries", y)

  autoTable(doc, {
    startY: y,
    head: [["Ledger #", "Date", "Type", "Project / Supplier", "Supplier(s)", "Total", "Paid", "Due", "Due date"]],
    body: entries.length > 0
      ? entries.map(e => [
        e.ledgerNumber,
        e.transactionDate,
        formatLinkModeLabel(e.linkMode),
        formatLedgerProject(e),
        formatLedgerSuppliers(e),
        fmtMoney(e.totalAmount),
        fmtMoney(e.amountPaid),
        fmtMoney(e.amountDue),
        e.dueDate || "—",
      ])
      : [["—", "No entries match the selected filters", "", "", "", "", "", "", ""]],
    theme: "striped",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [230, 235, 235],
      lineWidth: 0.2,
      textColor: [40, 40, 40],
    },
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontStyle: "bold",
      halign: "left",
    },
    columnStyles: {
      5: { halign: "right", fontStyle: "bold" },
      6: { halign: "right", textColor: [16, 140, 90] },
      7: { halign: "right", textColor: [200, 120, 20] },
      0: { fontStyle: "bold", textColor: TEAL },
    },
    alternateRowStyles: { fillColor: [252, 253, 253] },
    margin: { left: mL, right: mL },
    didDrawPage: () => {
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.2)
      doc.line(mL, pageH - 12, pageW - mL, pageH - 12)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      doc.text("Voltrix Batteries Pvt. Ltd. — Purchase Ledger Report", mL, pageH - 7)
    },
  })

  drawFooter(doc)
  doc.save(`purchase-ledger-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export async function downloadPurchaseLedgerEntryPDF(entry: PurchaseLedgerEntry) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsDoc

  const metaLines = [
    `${formatLinkModeLabel(entry.linkMode)} · ${entry.transactionDate}`,
    entry.dueDate ? `Due date ${entry.dueDate}` : "",
    `Generated ${new Date().toLocaleString("en-PK")}`,
  ].filter(Boolean)

  let y = await drawBrandHeader(doc, entry.ledgerNumber, metaLines, transactionTypeLabel(entry.transactionType))

  y = drawPaymentSummary(doc, entry.totalAmount, entry.amountPaid, entry.amountDue, y)

  y = drawSectionTitle(doc, "Entry details", y)
  y = drawInfoGrid(doc, [
    { label: "Project / Supplier", value: formatLedgerProject(entry) },
    { label: "Supplier(s)", value: formatLedgerSuppliers(entry) },
    { label: "Transaction type", value: transactionTypeLabel(entry.transactionType) },
    { label: "Due date", value: entry.dueDate || "—" },
    { label: "Note", value: entry.notes?.trim() || "—" },
    { label: "Created by", value: entry.createdBy || "—" },
  ], y)

  const groups = entry.supplierGroups.length > 0
    ? entry.supplierGroups
    : [{ supplierName: entry.supplierName, items: entry.items }]

  for (const group of groups) {
    const pageH = doc.internal.pageSize.getHeight()
    if (y > pageH - 60) {
      doc.addPage()
      y = MARGIN
    }

    y = drawSectionTitle(doc, group.supplierName || "Items", y)

    autoTable(doc, {
      startY: y,
      head: [["#", "Product", "Qty", "Unit price", "Line total"]],
      body: group.items.map((item, idx) => [
        String(idx + 1),
        item.productName,
        formatQty(item.quantity),
        fmtMoney(item.unitPrice),
        fmtMoney(item.lineTotal),
      ]),
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [230, 235, 235],
        lineWidth: 0.2,
        textColor: [40, 40, 40],
      },
      headStyles: {
        fillColor: TEAL,
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right", fontStyle: "bold", textColor: TEAL },
      },
      margin: { left: MARGIN, right: MARGIN },
    })

    y = (doc.lastAutoTable?.finalY ?? y) + 8
  }

  if (entry.payments.length > 0) {
    const pageH = doc.internal.pageSize.getHeight()
    if (y > pageH - 50) {
      doc.addPage()
      y = MARGIN
    }

    y = drawSectionTitle(doc, "Payments", y)

    autoTable(doc, {
      startY: y,
      head: [["Date", "Amount", "Note", "Recorded by"]],
      body: entry.payments.map(p => [
        p.date,
        fmtMoney(p.amount),
        p.notes || "—",
        p.createdBy || "—",
      ]),
      theme: "striped",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [230, 235, 235],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: TEAL,
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        1: { halign: "right", fontStyle: "bold", textColor: [16, 140, 90] },
      },
      alternateRowStyles: { fillColor: [252, 253, 253] },
      margin: { left: MARGIN, right: MARGIN },
    })
  }

  drawFooter(doc)
  doc.save(`${entry.ledgerNumber}-purchase.pdf`)
}
