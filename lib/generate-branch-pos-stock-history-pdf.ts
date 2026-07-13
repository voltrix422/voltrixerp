import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { InventoryTransaction } from "@/lib/inventory-history"

const BRAND: [number, number, number] = [31, 172, 166]
const INBOUND: [number, number, number] = [22, 101, 52]
const OUTBOUND: [number, number, number] = [194, 65, 12]

function absQty(t: InventoryTransaction): number {
  return Math.abs(Number(t.quantity) || 0)
}

function typeLabel(t: InventoryTransaction): string {
  if (t.transaction_type === "in") return "IN"
  if (t.transaction_type === "out") return "OUT"
  if (t.transaction_type === "assigned_to_branch") return "ASSIGN"
  if (t.transaction_type === "branch_transfer") return "TRANSFER"
  return String(t.transaction_type || "").toUpperCase()
}

function refLabel(refType: string): string {
  if (refType === "branch_pos_order") return "POS Order"
  if (refType === "pos_sale") return "POS Sale"
  if (refType === "branch") return "Branch"
  if (refType === "order") return "Order"
  return refType || "—"
}

export function downloadBranchPosStockHistoryPDF(opts: {
  branchName: string
  movements: InventoryTransaction[]
  exportedBy?: string
  dateLabel?: string
}) {
  const { branchName, movements, exportedBy, dateLabel } = opts
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })
  const mL = 10

  const inbound = movements.filter((m) => m.transaction_type === "in")
  const outbound = movements.filter((m) => m.transaction_type !== "in")
  const qtyIn = inbound.reduce((s, m) => s + absQty(m), 0)
  const qtyOut = outbound.reduce((s, m) => s + absQty(m), 0)

  doc.setFillColor(...BRAND)
  doc.rect(0, 0, 297, 28, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.text(`${branchName} — Stock History`, mL, 12)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(dateLabel || "All time", mL, 19)
  const meta = [
    `Generated ${new Date().toLocaleString("en-PK")}`,
    exportedBy ? `Exported by ${exportedBy}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  doc.text(meta, mL, 24)

  let y = 34
  doc.setTextColor(40, 40, 40)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("Summary", mL, y)
  y += 5

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Total movements", String(movements.length)],
      ["Stock in", `${inbound.length} (${qtyIn.toLocaleString()} units)`],
      ["Stock out", `${outbound.length} (${qtyOut.toLocaleString()} units)`],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BRAND, textColor: 255 },
    margin: { left: mL, right: mL },
    tableWidth: 120,
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  doc.setFont("helvetica", "bold")
  doc.text("Movement ledger", mL, y)
  y += 3

  const body =
    movements.length > 0
      ? movements.map((m) => [
          new Date(m.created_at).toLocaleString("en-PK"),
          typeLabel(m),
          m.item_description,
          `${absQty(m)} ${m.unit || "pcs"}`,
          refLabel(m.reference_type),
          m.reference_number || "—",
          m.notes || "—",
          m.created_by,
        ])
      : [["—", "", "No movements", "", "", "", "", ""]]

  autoTable(doc, {
    startY: y,
    head: [["Date", "Type", "Item", "Qty", "Ref", "Ref #", "Notes", "By"]],
    body,
    theme: "striped",
    styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: BRAND, textColor: 255, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 16 },
      2: { cellWidth: 48 },
      3: { cellWidth: 22 },
      4: { cellWidth: 24 },
      5: { cellWidth: 28 },
      6: { cellWidth: 55 },
      7: { cellWidth: 28 },
    },
    margin: { left: mL, right: mL },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 1) {
        const label = String(data.cell.raw || "")
        if (label === "IN") data.cell.styles.textColor = INBOUND
        if (label === "OUT") data.cell.styles.textColor = OUTBOUND
      }
    },
  })

  const safeName = branchName.replace(/[^\w\-]+/g, "_").slice(0, 40)
  doc.save(`${safeName}_stock_history_${new Date().toISOString().slice(0, 10)}.pdf`)
}
