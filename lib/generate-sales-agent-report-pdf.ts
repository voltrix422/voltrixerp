import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { PortalSummary } from "@/lib/sales-agents"

function formatMoney(n: number) {
  return `Rs ${(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function formatDateLabel(from?: string | null, to?: string | null) {
  if (from && to) return `${from} to ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return "All time"
}

export async function downloadSalesAgentReportPDF(summary: PortalSummary) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const teal: [number, number, number] = [31, 172, 166]
  const pageW = 210
  const mL = 14

  doc.setFillColor(...teal)
  doc.rect(0, 0, pageW, 36, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Sales Agent Performance Report", mL, 14)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(summary.agentName, mL, 22)
  doc.text(
    `${summary.location || "—"} · ${summary.commissionPercent}% commission · ${formatDateLabel(summary.dateFrom, summary.dateTo)}`,
    mL,
    28
  )
  doc.text(`Generated ${new Date().toLocaleString("en-PK")}`, mL, 33)

  let y = 44
  doc.setTextColor(40, 40, 40)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("Summary", mL, y)
  y += 6

  const summaryRows = [
    ["Clients added", String(summary.clients)],
    ["Quotations", `${summary.quotations} (${formatMoney(summary.quotationsValue)})`],
    ["Orders", `${summary.orderCount} (${formatMoney(summary.ordersValue)} pipeline)`],
    ["Pending approval", String(summary.pendingOrders)],
    ["Delivered orders", String(summary.deliveredOrders)],
    ["Delivered sales", formatMoney(summary.totalSales)],
    ["Commission earned", formatMoney(summary.commissionEarned)],
  ]

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: summaryRows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: teal, textColor: 255 },
    margin: { left: mL, right: mL },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Orders in period", mL, y)
  y += 4

  const orderBody =
    summary.orderRows.length > 0
      ? summary.orderRows.map(o => [
          o.orderNumber,
          o.clientName,
          new Date(o.createdAt).toLocaleDateString("en-PK"),
          o.status.replace(/_/g, " "),
          formatMoney(o.total),
          o.status === "delivered" && o.commissionAmount != null
            ? formatMoney(o.commissionAmount)
            : "—",
        ])
      : [["—", "No orders in this period", "", "", "", ""]]

  autoTable(doc, {
    startY: y,
    head: [["Order", "Client", "Date", "Status", "Total", "Commission"]],
    body: orderBody,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: teal, textColor: 255 },
    margin: { left: mL, right: mL },
  })

  const slug = summary.agentName.replace(/\s+/g, "-").toLowerCase()
  const range = summary.dateFrom && summary.dateTo ? `-${summary.dateFrom}-to-${summary.dateTo}` : ""
  doc.save(`sales-report-${slug}${range}.pdf`)
}
