import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Branch } from "@/lib/branches"
import { getInventoryModelLabels } from "@/lib/inventory-model-labels"
import { getManualInventoryItems } from "@/lib/manual-inventory"
import type { TransferHistoryDisplayEntry } from "@/lib/branch-transfer-history-display"

const BRAND: [number, number, number] = [26, 159, 154]
const BRAND_DARK: [number, number, number] = [18, 120, 116]
const INK: [number, number, number] = [30, 30, 30]
const MUTED: [number, number, number] = [96, 96, 96]
const ROW_ALT: [number, number, number] = [245, 250, 250]
const OUTGOING: [number, number, number] = [194, 65, 12]
const INCOMING: [number, number, number] = [22, 101, 52]

type ProductRow = {
  index: number
  name: string
  model: string
  qty: string
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

async function buildProductLabelMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  try {
    const [manualItems, labels] = await Promise.all([
      getManualInventoryItems().catch(() => []),
      getInventoryModelLabels().catch(() => []),
    ])
    for (const item of manualItems) {
      if (item.model && item.name) map[item.model.trim()] = item.name.trim()
    }
    for (const label of labels) {
      if (label.model && label.displayName) {
        map[label.model.trim()] = label.displayName.trim()
      }
    }
  } catch {
    /* use raw descriptions */
  }
  return map
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

function slugForFilename(value: string): string {
  return value
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

function humanizeModelCode(code: string): string {
  return code
    .replace(/^MAN-/i, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function resolveProductDisplay(
  description: string,
  labelMap: Record<string, string>,
): { name: string; model: string } {
  const trimmed = description.trim()
  if (!trimmed) return { name: "Unlabeled item", model: "—" }

  const dotSep = trimmed.indexOf(" · ")
  if (dotSep >= 0) {
    const name = trimmed.slice(0, dotSep).trim()
    const model = trimmed.slice(dotSep + 3).trim()
    return { name: name || labelMap[model] || humanizeModelCode(model), model }
  }

  const friendly = labelMap[trimmed]
  if (friendly) return { name: friendly, model: trimmed }

  if (trimmed.toUpperCase().startsWith("MAN-")) {
    return { name: humanizeModelCode(trimmed), model: trimmed }
  }

  return { name: trimmed, model: "—" }
}

function getItemRows(
  entry: TransferHistoryDisplayEntry,
  labelMap: Record<string, string>,
): ProductRow[] {
  const lines =
    entry.lineItems.length > 0
      ? entry.lineItems
      : [
          {
            productDescription: entry.productDescription,
            quantity: entry.quantity,
            unit: entry.unit,
          },
        ]

  return lines.map((line, index) => {
    const { name, model } = resolveProductDisplay(line.productDescription, labelMap)
    return {
      index: index + 1,
      name,
      model,
      qty: `${line.quantity} ${line.unit}`,
    }
  })
}

function extractRemarks(note: string): { summary?: string; dispatchNote?: string; userNote?: string } {
  const lines = note
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const header = lines.find(
    (line) =>
      line.startsWith("Bulk transfer") ||
      line.startsWith("Sent ") ||
      (!line.startsWith("•") && !line.startsWith("Dispatch note:")),
  )

  const dispatchLine = lines.find((line) => line.startsWith("Dispatch note:"))
  const dispatchNote = dispatchLine?.replace(/^Dispatch note:\s*/i, "").trim()

  const userNoteLine = lines.find((line) => line.includes(" — Note:"))
  const userNote = userNoteLine?.split(" — Note:").pop()?.trim()

  return {
    summary: header && !header.startsWith("•") ? header : undefined,
    dispatchNote,
    userNote,
  }
}

export function transferHistoryPdfFilename(
  branch: Branch,
  entry: TransferHistoryDisplayEntry,
): string {
  const date = entry.transferredAt.slice(0, 10)
  const peerCode =
    entry.fromBranchId === branch.id ? entry.toBranchCode : entry.fromBranchCode
  const route = `${branch.code}-to-${peerCode}-${date}`
  if (entry.isBatch && entry.transferBatchId) {
    return `Voltrix-Transfer-${route}-batch.pdf`
  }
  const itemSlug = slugForFilename(entry.productDescription.slice(0, 24))
  return `Voltrix-Transfer-${route}-${itemSlug || entry.id.slice(0, 8)}.pdf`
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

function drawDocumentHeader(
  doc: jsPDF,
  branch: Branch,
  isSingleSlip: boolean,
  logo: string,
  generatedAt: string,
  margin: number,
  pageW: number,
  contentW: number,
): number {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageW, 40, "F")

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
  doc.text("Email: sale@voltrixbatteries.com  |  www.voltrixbatteries.com", margin + logoOffset, 29)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(isSingleSlip ? "TRANSFER SLIP" : "TRANSFER HISTORY", pageW - margin, 16, { align: "right" })
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

  return 66
}

function drawSummaryBar(
  doc: jsPDF,
  y: number,
  transferHistory: TransferHistoryDisplayEntry[],
  branch: Branch,
  margin: number,
  contentW: number,
): number {
  const outgoingCount = transferHistory.filter((entry) => entry.fromBranchId === branch.id).length
  const incomingCount = transferHistory.filter((entry) => entry.toBranchId === branch.id).length

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

  return y + 20
}

function getDirection(entry: TransferHistoryDisplayEntry, branch: Branch) {
  const isOutgoing = entry.fromBranchId === branch.id
  const isIncoming = entry.toBranchId === branch.id
  return {
    label: isOutgoing ? "Outgoing" : isIncoming ? "Incoming" : "Transfer",
    color: isOutgoing ? OUTGOING : isIncoming ? INCOMING : INK,
  }
}

function drawTransferBlock(
  doc: jsPDF,
  startY: number,
  entry: TransferHistoryDisplayEntry,
  branch: Branch,
  labelMap: Record<string, string>,
  margin: number,
  contentW: number,
  options: { recordNumber?: number; compact?: boolean },
): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  const bottomLimit = pageHeight - 18
  let y = startY

  const itemRows = getItemRows(entry, labelMap)
  const estimatedHeight = 34 + itemRows.length * 8 + 24
  if (y + estimatedHeight > bottomLimit && y > 70) {
    doc.addPage()
    y = 20
  }

  const direction = getDirection(entry, branch)
  const remarks = extractRemarks(entry.note || "")

  doc.setFillColor(252, 253, 253)
  doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "F")
  doc.setDrawColor(220, 235, 234)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "S")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9.5)
  doc.setTextColor(INK[0], INK[1], INK[2])
  const title =
    options.recordNumber != null
      ? `Transfer #${options.recordNumber}`
      : entry.isBatch
        ? `Bulk transfer (${itemRows.length} items)`
        : "Transfer details"
  doc.text(title, margin + 3, y + 5.5)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(direction.color[0], direction.color[1], direction.color[2])
  doc.text(direction.label, margin + contentW - 3, y + 5.5, { align: "right" })

  y += 12

  const infoRows = [
    ["Date & time", formatDateTime(entry.transferredAt)],
    ["From", `${entry.fromBranchName} (${entry.fromBranchCode})`],
    ["To", `${entry.toBranchName} (${entry.toBranchCode})`],
    ["Transferred by", entry.transferredBy || "—"],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: infoRows,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 2 },
      textColor: INK,
      lineColor: [235, 240, 240],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: "bold", textColor: MUTED },
      1: { cellWidth: contentW - 34 },
    },
  })

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 18
  y += 4

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
  doc.text("Items transferred", margin, y)
  y += 3

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Product name", "Model code", "Quantity"]],
    body: itemRows.map((row) => [
      String(row.index),
      row.name,
      row.model,
      row.qty,
    ]),
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 3,
      overflow: "linebreak",
      textColor: INK,
      lineColor: [230, 230, 230],
      lineWidth: 0.2,
      valign: "middle",
    },
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: ROW_ALT,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 78, fontStyle: "bold" },
      2: { cellWidth: 52, fontSize: 7.5, textColor: MUTED },
      3: { cellWidth: 22, halign: "right", fontStyle: "bold" },
    },
  })

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20
  y += 3

  const totalQty = itemRows.length > 0
    ? entry.lineItems.reduce((sum, line) => sum + line.quantity, 0) || entry.quantity
    : entry.quantity
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  doc.text(
    `Total: ${itemRows.length} item${itemRows.length === 1 ? "" : "s"}  ·  ${totalQty} ${entry.unit} overall`,
    margin,
    y + 3,
  )
  y += 10

  const noteLines: string[] = []
  if (remarks.dispatchNote) noteLines.push(`Dispatch note: ${remarks.dispatchNote}`)
  if (remarks.userNote) noteLines.push(`Note: ${remarks.userNote}`)
  if (!remarks.dispatchNote && !remarks.userNote && remarks.summary && !options.compact) {
    noteLines.push(remarks.summary)
  }

  if (noteLines.length > 0) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(INK[0], INK[1], INK[2])
    doc.text("Remarks", margin, y)
    y += 4

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
    for (const line of noteLines) {
      const wrapped = doc.splitTextToSize(line, contentW - 4)
      doc.text(wrapped, margin + 2, y)
      y += wrapped.length * 4 + 1
    }
  }

  return y + 8
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

  const isSingleSlip = transferHistory.length === 1
  const labelMap = await buildProductLabelMap()
  const logo = await loadImageBase64("/logo.png")

  let y = drawDocumentHeader(doc, branch, isSingleSlip, logo, generatedAt, margin, pageW, contentW)

  if (!isSingleSlip) {
    y = drawSummaryBar(doc, y, transferHistory, branch, margin, contentW)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(INK[0], INK[1], INK[2])
    doc.text("Transfer log", margin, y)
    y += 4
    doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2])
    doc.setLineWidth(0.8)
    doc.line(margin, y, margin + 28, y)
    y += 8
  }

  transferHistory.forEach((entry, index) => {
    y = drawTransferBlock(doc, y, entry, branch, labelMap, margin, contentW, {
      recordNumber: isSingleSlip ? undefined : index + 1,
      compact: !isSingleSlip,
    })
    if (!isSingleSlip && index < transferHistory.length - 1) {
      doc.setDrawColor(230, 230, 230)
      doc.setLineWidth(0.3)
      doc.line(margin + 8, y - 2, margin + contentW - 8, y - 2)
      y += 4
    }
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
  options?: { singleEntry?: TransferHistoryDisplayEntry },
): Promise<void> {
  const entries = options?.singleEntry ? [options.singleEntry] : transferHistory
  const blob = await generateBranchTransferHistoryPDF(branch, entries)
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  const datePart = new Date().toISOString().slice(0, 10)
  anchor.download = options?.singleEntry
    ? transferHistoryPdfFilename(branch, options.singleEntry)
    : `Voltrix-Transfer-History-${branch.code}-${datePart}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(anchor)
}
