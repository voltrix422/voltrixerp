import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { InventoryMovementRow } from "@/lib/inventory-movement-display"
import { formatMovementDate, getReferenceTypeLabel } from "@/lib/inventory-movement-display"
import { formatStockRange } from "@/lib/inventory-movement-stock"

const BRAND: [number, number, number] = [31, 172, 166]
const INBOUND: [number, number, number] = [22, 101, 52]
const OUTBOUND: [number, number, number] = [194, 65, 12]

export type InventoryMovementsPdfOptions = {
  movements: InventoryMovementRow[]
  dateLabel: string
  exportedBy?: string
}

function formatDateLabel(from?: string, to?: string): string {
  if (from && to) return `${from} to ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return "All time"
}

export function downloadInventoryMovementsPDF(opts: InventoryMovementsPdfOptions) {
  const { movements, dateLabel, exportedBy } = opts
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })
  const mL = 10

  const totalIn = movements.filter((m) => m.is_inbound).length
  const totalOut = movements.filter((m) => !m.is_inbound).length
  const qtyIn = movements.filter((m) => m.is_inbound).reduce((s, m) => s + m.abs_quantity, 0)
  const qtyOut = movements.filter((m) => !m.is_inbound).reduce((s, m) => s + m.abs_quantity, 0)
  const orderCount = new Set(movements.filter((m) => m.order_number).map((m) => m.order_number)).size

  doc.setFillColor(...BRAND)
  doc.rect(0, 0, 297, 28, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.text("Inventory Movement Overview", mL, 12)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(dateLabel, mL, 19)
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
      ["Inbound (IN)", `${totalIn} (${qtyIn.toLocaleString()} units)`],
      ["Outbound (OUT)", `${totalOut} (${qtyOut.toLocaleString()} units)`],
      ["Unique orders", String(orderCount)],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BRAND, textColor: 255 },
    margin: { left: mL, right: mL },
    tableWidth: 120,
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  doc.text("Movement Ledger", mL, y)
  y += 3

  const body =
    movements.length > 0
      ? movements.map((m) => [
          formatMovementDate(m.created_at),
          m.movement_label,
          m.item_description,
          `${m.abs_quantity} ${m.unit}`,
          formatStockRange(m.stock_before, m.stock_after, m.unit),
          m.location_label,
          m.source,
          m.destination,
          m.order_number || "—",
          m.client_name || "—",
          getReferenceTypeLabel(m.reference_type),
          m.reference_number,
          m.created_by,
        ])
      : [["—", "No movements in this period", "", "", "", "", "", "", "", "", "", "", ""]]

  autoTable(doc, {
    startY: y,
    head: [["Date", "Type", "Item", "Qty", "Stock", "Location", "From", "To", "Order", "Client", "Ref Type", "Ref #", "By"]],
    body,
    theme: "striped",
    styles: { fontSize: 6.5, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: BRAND, textColor: 255, fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 9 },
      2: { cellWidth: 28 },
      3: { cellWidth: 12 },
      4: { cellWidth: 20 },
      5: { cellWidth: 18 },
      6: { cellWidth: 24 },
      7: { cellWidth: 24 },
      8: { cellWidth: 16 },
      9: { cellWidth: 18 },
      10: { cellWidth: 18 },
      11: { cellWidth: 16 },
      12: { cellWidth: 16 },
    },
    margin: { left: mL, right: mL },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 1) {
        const label = String(data.cell.raw || "")
        if (label === "IN") {
          data.cell.styles.textColor = INBOUND
          data.cell.styles.fontStyle = "bold"
        } else if (label === "OUT") {
          data.cell.styles.textColor = OUTBOUND
          data.cell.styles.fontStyle = "bold"
        }
      }
    },
  })

  const rangeSlug = dateLabel.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").slice(0, 40)
  doc.save(`inventory-movements-${rangeSlug || "export"}.pdf`)
}

export { formatDateLabel }
