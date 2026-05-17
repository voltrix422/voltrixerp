import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Order } from "@/lib/orders"
import { STATUS_LABELS } from "@/lib/orders"

function formatMoney(n: number) {
  return `Rs ${(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function formatDateLabel(from?: string | null, to?: string | null) {
  if (from && to) return `${from} to ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return "All time"
}

export type OrdersReportOptions = {
  agentName: string
  orders: Order[]
  dateFrom?: string | null
  dateTo?: string | null
  statusFilter?: string
}

export async function downloadOrdersReportPDF(opts: OrdersReportOptions) {
  const { agentName, orders, dateFrom, dateTo, statusFilter } = opts
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const teal: [number, number, number] = [31, 172, 166]
  const mL = 14

  const totalValue = orders.reduce((s, o) => s + (o.total || 0), 0)
  const statusLabel =
    statusFilter && statusFilter !== "all"
      ? STATUS_LABELS[statusFilter as keyof typeof STATUS_LABELS] || statusFilter
      : "All statuses"

  doc.setFillColor(...teal)
  doc.rect(0, 0, 210, 36, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Orders Report", mL, 14)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(agentName, mL, 22)
  doc.text(`${statusLabel} · ${formatDateLabel(dateFrom, dateTo)}`, mL, 28)
  doc.text(`Generated ${new Date().toLocaleString("en-PK")}`, mL, 33)

  let y = 44
  doc.setTextColor(40, 40, 40)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Summary", mL, y)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Orders", String(orders.length)],
      ["Total value", formatMoney(totalValue)],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: teal, textColor: 255 },
    margin: { left: mL, right: mL },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.text("Orders", mL, y)
  y += 4

  const body =
    orders.length > 0
      ? orders.map(o => [
          o.orderNumber,
          o.clientName,
          new Date(o.createdAt).toLocaleDateString("en-PK"),
          STATUS_LABELS[o.status] || o.status,
          formatMoney(o.total || 0),
        ])
      : [["—", "No orders in this period", "", "", ""]]

  autoTable(doc, {
    startY: y,
    head: [["Order", "Client", "Date", "Status", "Total"]],
    body,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: teal, textColor: 255 },
    margin: { left: mL, right: mL },
  })

  const slug = agentName.replace(/\s+/g, "-").toLowerCase()
  const range = dateFrom && dateTo ? `-${dateFrom}-to-${dateTo}` : ""
  doc.save(`orders-report-${slug}${range}.pdf`)
}
