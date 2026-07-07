import { escCsvCell } from "@/lib/crm-excel-export"
import {
  formatLedgerItemsSummary,
  formatLedgerProject,
  formatLedgerSuppliers,
  formatLinkModeLabel,
  PURCHASE_TRANSACTION_TYPES,
  type PurchaseLedgerEntry,
} from "@/lib/purchase-ledger"

function fmtMoney(n: number) {
  return `Rs. ${(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
}

function transactionTypeLabel(value: string) {
  return PURCHASE_TRANSACTION_TYPES.find(t => t.value === value)?.label ?? value
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
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: entries.length > 8 ? "landscape" : "portrait" })
  const teal: [number, number, number] = [31, 172, 166]
  const pageW = doc.internal.pageSize.getWidth()
  const mL = 14

  const totalAmount = entries.reduce((s, e) => s + e.totalAmount, 0)
  const totalPaid = entries.reduce((s, e) => s + e.amountPaid, 0)
  const totalDue = entries.reduce((s, e) => s + e.amountDue, 0)

  doc.setFillColor(...teal)
  doc.rect(0, 0, pageW, 34, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.text("Purchase Ledger Report", mL, 13)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  if (meta?.exportedBy) doc.text(`Exported by ${meta.exportedBy}`, mL, 20)
  if (meta?.filterSummary) doc.text(meta.filterSummary, mL, 25)
  doc.text(`Generated ${new Date().toLocaleString("en-PK")}`, mL, 30)

  let y = 42
  autoTable(doc, {
    startY: y,
    head: [["Entries", "Total", "Paid", "Due"]],
    body: [[String(entries.length), fmtMoney(totalAmount), fmtMoney(totalPaid), fmtMoney(totalDue)]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: teal, textColor: 255 },
    margin: { left: mL, right: mL },
  })

  y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  autoTable(doc, {
    startY: y,
    head: [["Ledger", "Date", "Type", "Project/Supplier", "Suppliers", "Total", "Paid", "Due"]],
    body: entries.map(e => [
      e.ledgerNumber,
      e.transactionDate,
      formatLinkModeLabel(e.linkMode),
      formatLedgerProject(e),
      formatLedgerSuppliers(e),
      fmtMoney(e.totalAmount),
      fmtMoney(e.amountPaid),
      fmtMoney(e.amountDue),
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: teal, textColor: 255 },
    margin: { left: mL, right: mL },
  })

  doc.save(`purchase-ledger-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export async function downloadPurchaseLedgerEntryPDF(entry: PurchaseLedgerEntry) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const teal: [number, number, number] = [31, 172, 166]
  const mL = 14

  doc.setFillColor(...teal)
  doc.rect(0, 0, 210, 32, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(entry.ledgerNumber, mL, 12)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`${formatLinkModeLabel(entry.linkMode)} · ${entry.transactionDate}`, mL, 19)
  doc.text(`Generated ${new Date().toLocaleString("en-PK")}`, mL, 26)

  let y = 40
  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: [
      ["Project / Supplier", formatLedgerProject(entry)],
      ["Supplier(s)", formatLedgerSuppliers(entry)],
      ["Transaction type", transactionTypeLabel(entry.transactionType)],
      ["Due date", entry.dueDate || "—"],
      ["Note", entry.notes || "—"],
      ["Total", fmtMoney(entry.totalAmount)],
      ["Paid", fmtMoney(entry.amountPaid)],
      ["Due", fmtMoney(entry.amountDue)],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: teal, textColor: 255 },
    margin: { left: mL, right: mL },
  })

  y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  const groups = entry.supplierGroups.length > 0
    ? entry.supplierGroups
    : [{ supplierName: entry.supplierName, items: entry.items }]

  for (const group of groups) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    doc.text(group.supplierName || "Items", mL, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [["Product", "Qty", "Unit Price", "Line Total"]],
      body: group.items.map(i => [
        i.productName,
        String(i.quantity),
        fmtMoney(i.unitPrice),
        fmtMoney(i.lineTotal),
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: teal, textColor: 255 },
      margin: { left: mL, right: mL },
    })
    y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  if (entry.payments.length > 0) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("Payments", mL, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [["Date", "Amount", "Note", "By"]],
      body: entry.payments.map(p => [p.date, fmtMoney(p.amount), p.notes || "", p.createdBy || ""]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: teal, textColor: 255 },
      margin: { left: mL, right: mL },
    })
  }

  doc.save(`${entry.ledgerNumber}-purchase.pdf`)
}
