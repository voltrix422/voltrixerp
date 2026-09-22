"use client"

import jsPDF from "jspdf"
import { VOLTRIX_COMPREHENSIVE_WARRANTY } from "@/lib/warranty-comprehensive-terms"
import type { PublicWarrantyCardData } from "@/components/warranty/warranty-public-card"

function formatCardDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function statusLabel(endDate: string): string {
  const end = new Date(endDate)
  const diffDays = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return "Expired"
  if (diffDays <= 30) return `${diffDays}d left`
  return "Active"
}

const BRAND = { r: 26, g: 159, b: 154 }
const BRAND_DARK = { r: 13, g: 122, b: 118 }
const INK = { r: 17, g: 24, b: 39 }
const SLATE = { r: 51, g: 65, b: 85 }

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

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[]
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 18) {
    doc.addPage()
    return margin
  }
  return y
}

export async function generateWarrantyCardPDF(warranty: PublicWarrantyCardData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = 210
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2
  const logo = await loadImageBase64("/logo.png")

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, pageW, 42, "F")
  doc.setFillColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b)
  doc.rect(0, 42, pageW, 2, "F")

  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 8, 22, 22)
    } catch {
      // skip broken logo
    }
  }

  const textX = margin + (logo ? 26 : 0)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("VOLTRIX BATTERIES", textX, 16)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.text("Official Digital Warranty Card", textX, 22)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text(`${VOLTRIX_COMPREHENSIVE_WARRANTY.policyLabel} Warranty`, textX, 29)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.text(warranty.productName || "Voltrix Product", textX, 36)

  const badge = statusLabel(warranty.warrantyEndDate).toUpperCase()
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  const badgeW = Math.max(doc.getTextWidth(badge) + 8, 22)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(pageW - margin - badgeW, 14, badgeW, 8, 2, 2, "F")
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  doc.text(badge, pageW - margin - badgeW / 2, 19.4, { align: "center" })

  let y = 52
  const chips = [
    warranty.warrantyId ? `Warranty: ${warranty.warrantyId}` : null,
    warranty.serialNumber ? `SN: ${warranty.serialNumber}` : null,
    warranty.invoiceNumber ? `Inv: ${warranty.invoiceNumber}` : null,
  ].filter(Boolean) as string[]

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  let chipX = margin
  for (const chip of chips) {
    const w = doc.getTextWidth(chip) + 6
    if (chipX + w > pageW - margin) {
      chipX = margin
      y += 8
    }
    doc.setFillColor(240, 253, 250)
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
    doc.setLineWidth(0.25)
    doc.roundedRect(chipX, y - 4.2, w, 7, 1.4, 1.4, "FD")
    doc.setTextColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b)
    doc.text(chip, chipX + 3, y)
    chipX += w + 2.5
  }
  y += 10

  const dates = [
    { label: "SOLD", value: formatCardDate(warranty.soldDate) },
    { label: "STARTED", value: formatCardDate(warranty.warrantyStartDate) },
    { label: "VALID UNTIL", value: formatCardDate(warranty.warrantyEndDate) },
  ]
  const boxW = (contentW - 6) / 3
  dates.forEach((item, i) => {
    const bx = margin + i * (boxW + 3)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(bx, y, boxW, 16, 2, 2, "FD")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.5)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(item.label, bx + 3, y + 5)
    doc.setFontSize(10)
    doc.setTextColor(INK.r, INK.g, INK.b)
    doc.text(item.value, bx + 3, y + 12)
  })
  y += 20

  if (warranty.customerName) {
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, y, contentW, 16, 2, 2, "FD")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.5)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text("REGISTERED OWNER", margin + 3, y + 5)
    doc.setFontSize(11)
    doc.setTextColor(INK.r, INK.g, INK.b)
    doc.text(warranty.customerName, margin + 3, y + 12)
    y += 20
  }

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.roundedRect(margin, y, contentW, 10, 2, 2, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.8)
  doc.text(
    `${VOLTRIX_COMPREHENSIVE_WARRANTY.policyLabel.toUpperCase()}  ·  ${VOLTRIX_COMPREHENSIVE_WARRANTY.policySummary}`,
    margin + 3,
    y + 6.4,
  )
  y += 16

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text(VOLTRIX_COMPREHENSIVE_WARRANTY.documentTitle, margin, y)
  y += 7

  for (const section of VOLTRIX_COMPREHENSIVE_WARRANTY.sections) {
    const paragraphs = section.paragraphs ?? []
    const bullets = section.bullets ?? []
    const body = [...paragraphs, ...bullets]
    const preview = wrapLines(doc, body[0] || "", contentW)
    y = ensureSpace(doc, y, 10 + preview.length * 4, margin)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(BRAND_DARK.r, BRAND_DARK.g, BRAND_DARK.b)
    doc.text(section.title, margin, y)
    y += 5

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.2)
    doc.setTextColor(SLATE.r, SLATE.g, SLATE.b)

    for (const paragraph of paragraphs) {
      const lines = wrapLines(doc, paragraph, contentW)
      for (const line of lines) {
        y = ensureSpace(doc, y, 5, margin)
        doc.text(line, margin, y)
        y += 4
      }
      y += 1.5
    }

    for (const bullet of bullets) {
      const lines = wrapLines(doc, bullet, contentW - 5)
      y = ensureSpace(doc, y, lines.length * 4 + 2, margin)
      doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
      doc.circle(margin + 1.4, y - 1.1, 0.85, "F")
      doc.setTextColor(SLATE.r, SLATE.g, SLATE.b)
      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) y = ensureSpace(doc, y, 5, margin)
        doc.text(line, margin + 5, y + lineIndex * 4)
      })
      y += lines.length * 4 + 1.2
    }
    y += 2
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
    doc.rect(0, pageH - 12, pageW, 12, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.text(
      `${VOLTRIX_COMPREHENSIVE_WARRANTY.footer.company}  ·  ${VOLTRIX_COMPREHENSIVE_WARRANTY.footer.location}  ·  ${VOLTRIX_COMPREHENSIVE_WARRANTY.footer.website}`,
      margin,
      pageH - 5,
    )
    doc.text(`${page} / ${pages}`, pageW - margin, pageH - 5, { align: "right" })
  }

  return doc.output("blob")
}

export async function downloadWarrantyCardPDF(warranty: PublicWarrantyCardData): Promise<void> {
  const blob = await generateWarrantyCardPDF(warranty)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const id = (warranty.warrantyId || warranty.serialNumber || "card").replace(/[^a-zA-Z0-9-_]/g, "")
  link.href = url
  link.download = `warranty-${id}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
