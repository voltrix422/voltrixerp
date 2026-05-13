import jsPDF from "jspdf"
import { parseProductTermsContent } from "@/lib/parse-product-terms"

const BRAND = { r: 26, g: 159, b: 154 }
const INK = { r: 38, g: 38, b: 38 }
const MUTED = { r: 96, g: 96, b: 96 }

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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - margin) {
    doc.addPage()
    return margin
  }
  return y
}

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[]
}

export async function generateProductTermsPDF(productName: string, content: string): Promise<Blob> {
  const parsed = parseProductTermsContent(content)
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = 210
  const margin = 16
  const contentW = pageW - margin * 2
  let y = 0

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, pageW, 34, "F")

  const logo = await loadImageBase64("/logo.png")
  if (logo) {
    doc.addImage(logo, "PNG", margin, 6, 18, 18)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("VOLTRIX BATTERIES", margin + (logo ? 22 : 0), 13)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text("Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", margin + (logo ? 22 : 0), 18)
  doc.text("Phone: 051-8731661 | Email: info@voltrix-power.com", margin + (logo ? 22 : 0), 22.5)
  doc.text("www.voltrixbatteries.com", margin + (logo ? 22 : 0), 27)

  y = 44
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`Product: ${productName}`, margin, y)
  y += 8

  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  const titleLines = wrapLines(doc, parsed.title, contentW)
  titleLines.forEach((line: string) => {
    y = ensureSpace(doc, y, 8, margin)
    doc.text(line, margin, y)
    y += 8
  })

  y += 2
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
  doc.setLineWidth(0.8)
  doc.line(margin, y, margin + 42, y)
  y += 8

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  doc.setTextColor(INK.r, INK.g, INK.b)
  parsed.intro.forEach((paragraph) => {
    const lines = wrapLines(doc, paragraph, contentW)
    lines.forEach((line: string) => {
      y = ensureSpace(doc, y, 6, margin)
      doc.text(line, margin, y)
      y += 5.5
    })
    y += 3
  })

  y += 2
  doc.setFillColor(245, 248, 248)
  const sectionHeight = 10
  y = ensureSpace(doc, y, sectionHeight + 6, margin)
  doc.roundedRect(margin, y - 6, contentW, sectionHeight, 2, 2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  doc.text(parsed.sectionTitle, margin + 4, y)
  y += 10

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(INK.r, INK.g, INK.b)
  parsed.bullets.forEach((bullet, index) => {
    const lines = wrapLines(doc, bullet, contentW - 8)
    y = ensureSpace(doc, y, lines.length * 5.5 + 4, margin)
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
    doc.circle(margin + 2, y - 1.5, 1.2, "F")
    doc.setTextColor(INK.r, INK.g, INK.b)
    lines.forEach((line: string, lineIndex: number) => {
      doc.text(line, margin + 7, y + lineIndex * 5.5)
    })
    y += lines.length * 5.5 + 3
    if (index < parsed.bullets.length - 1) {
      doc.setDrawColor(230, 230, 230)
      doc.setLineWidth(0.2)
      doc.line(margin + 7, y - 1, margin + contentW, y - 1)
    }
  })

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(margin, pageHeight - 14, pageW - margin, pageHeight - 14)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text("Voltrix Batteries Pvt. Ltd. — Product warranty terms", margin, pageHeight - 8)
    doc.text(`Page ${page} of ${pageCount}`, pageW - margin, pageHeight - 8, { align: "right" })
  }

  return doc.output("blob")
}

export async function downloadProductTermsPDF(productName: string, content: string): Promise<void> {
  const blob = await generateProductTermsPDF(productName, content)
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `Voltrix-Terms-${slugify(productName) || "product"}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(anchor)
}
