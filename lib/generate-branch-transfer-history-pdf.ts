import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Branch } from "@/lib/branches"
import type { TransferHistoryDisplayEntry } from "@/lib/branch-transfer-history-display"

const BRAND: [number, number, number] = [26, 159, 154]
const BRAND_DARK: [number, number, number] = [18, 120, 116]
const INK: [number, number, number] = [30, 30, 30]
const MUTED: [number, number, number] = [96, 96, 96]
const ROW_ALT: [number, number, number] = [245, 250, 250]
const OUTGOING: [number, number, number] = [194, 65, 12]
const INCOMING: [number, number, number] = [22, 101, 52]

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

function formatBranchType(type: Branch["type"]): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function drawPageFooter(doc: jsPDF, page: number, pageCount: number, margin: number, pageW: number) {
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setDrawColor(230, 230, 230)
  doc.setLineWidth(0.2)
  doc.line(margin, pageHeight - 14, pageW - margin, pageHeight - 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  doc.text("Voltrix Batteries Pvt. Ltd. — Branch inventory transfer history", margin, pageHeight - 8)
  doc.text(`Page ${page} of ${pageCount}`, pageW - margin, pageHeight - 8, { align: "right" })
}

export async function generateBranchTransferHistoryPDF(
  branch: Branch,
  transferHistory: TransferHistoryDisplayEntry[],
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = 210
  const margin = 14
  const contentW = pageW - margin * 2
  const generatedAt = new Date().toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const outgoingCount = transferHistory.filter((entry) => entry.fromBranchId === branch.id).length
  const incomingCount = transferHistory.filter((entry) => entry.toBranchId === branch.id).length

  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageW, 40, "F")

  const logo = await loadImageBase64("/logo.png")
  const logoOffset = logo ? 30 : 0
  if (logo) {
    doc.addImage(logo, "PNG", margin, 6, 24, 24)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("VOLTRIX BATTERIES", margin + logoOffset, 13)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.text("Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", margin + logoOffset, 19)
  doc.text("Phone: 051-8731661  |  Mobile: +92 303 4927779", margin + logoOffset, 24)
  doc.text("Email: info@voltrixbatteries.com  |  www.voltrixbatteries.com", margin + logoOffset, 29)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("TRANSFER HISTORY", pageW - margin, 16, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.text(branch.code, pageW - margin, 23, { align: "right" })

  doc.setFillColor(...BRAND_DARK)
  doc.rect(0, 40, pageW, 18, "F")

  const metaItems = [
    { label: "BRANCH", value: branch.name },
    { label: "TYPE", value: formatBranchType(branch.type) },
    { label: "MANAGER", value: branch.manager || "—" },
    { label: "GENERATED", value: generatedAt },
  ]
  const metaColW = contentW / metaItems.length
  metaItems.forEach((item, index) => {
    const x = margin + index * metaColW
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.5)
    doc.setTextColor(180, 230, 228)
    doc.text(item.label, x, 46)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text(item.value, x, 51.5, { maxWidth: metaColW - 2 })
  })

  let y = 66
  doc.setFillColor(247, 250, 250)
  doc.roundedRect(margin, y - 5, contentW, 16, 2, 2, "F")
  doc.setDrawColor(...BRAND)
  doc.setLineWidth(0.4)
  doc.roundedRect(margin, y - 5, contentW, 16, 2, 2, "S")

  const summaryItems = [
  { label: "Total Records", value: String(transferHistory.length) },
  { label: "Outgoing", value: String(outgoingCount) },
  { label: "Incoming", value: String(incomingCount) },
  ]
  const summaryColW = contentW / summaryItems.length
  summaryItems.forEach((item, index) => {
    const x = margin + index * summaryColW + 4
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2])
    doc.text(item.label.toUpperCase(), x, y + 1)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(INK[0], INK[1], INK[2])
    doc.text(item.value, x, y + 7)
  })

  y += 20
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(INK[0], INK[1], INK[2])
  doc.text("Transfer Log", margin, y)
  y += 4
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2])
  doc.setLineWidth(0.8)
  doc.line(margin, y, margin + 28, y)
  y += 6

  const body = transferHistory.map((entry, index) => {
    const isOutgoing = entry.fromBranchId === branch.id
    const isIncoming = entry.toBranchId === branch.id
    const direction = isOutgoing ? "Outgoing" : isIncoming ? "Incoming" : "Transfer"
    const route = isOutgoing
      ? `${entry.fromBranchName} (${entry.fromBranchCode}) -> ${entry.toBranchName} (${entry.toBranchCode})`
      : isIncoming
        ? `${entry.fromBranchName} (${entry.fromBranchCode}) -> ${entry.toBranchName} (${entry.toBranchCode})`
        : `${entry.fromBranchName} (${entry.fromBranchCode}) -> ${entry.toBranchName} (${entry.toBranchCode})`

    const remarks = entry.isBatch
      ? entry.lineItems.map((line) => `${line.quantity} ${line.unit} × ${line.productDescription}`).join("; ")
      : entry.note

    return [
      String(index + 1),
      formatDateTime(entry.transferredAt),
      direction,
      entry.productDescription,
      `${entry.quantity} ${entry.unit}`,
      route,
      entry.transferredBy,
      remarks,
    ]
  })

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Date & Time", "Direction", "Item", "Qty", "Route", "By", "Remarks"]],
    body,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      textColor: INK,
      lineColor: [230, 230, 230],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: ROW_ALT,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 24 },
      2: { cellWidth: 18, fontStyle: "bold" },
      3: { cellWidth: 34 },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 38 },
      6: { cellWidth: 18 },
      7: { cellWidth: 36 },
    },
    didParseCell(data) {
      if (data.section !== "body") return
      if (data.column.index === 2) {
        const direction = String(data.cell.raw || "")
        if (direction === "Outgoing") {
          data.cell.styles.textColor = OUTGOING
        } else if (direction === "Incoming") {
          data.cell.styles.textColor = INCOMING
        }
      }
    },
  })

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    drawPageFooter(doc, page, pageCount, margin, pageW)
  }

  return doc.output("blob")
}

export async function downloadBranchTransferHistoryPDF(
  branch: Branch,
  transferHistory: TransferHistoryDisplayEntry[],
): Promise<void> {
  const blob = await generateBranchTransferHistoryPDF(branch, transferHistory)
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `Voltrix-Transfer-History-${branch.code}-${new Date().toISOString().slice(0, 10)}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(anchor)
}
