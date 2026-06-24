import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  absoluteAssetUrl,
  normalizeSpecRows,
  type ProductSpecsPayload,
} from "@/lib/product-specs"
import { getCategoryDisplayLabel } from "@/lib/product-categories"

const BRAND: [number, number, number] = [26, 159, 154]
const BRAND_DARK: [number, number, number] = [18, 120, 116]
const INK: [number, number, number] = [38, 38, 38]
const MUTED: [number, number, number] = [96, 96, 96]

async function loadImageBase64(url: string): Promise<{ data: string; format: "PNG" | "JPEG" } | null> {
  const src = absoluteAssetUrl(url)
  if (!src) return null
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    const data = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(blob)
    })
    if (!data) return null
    const format = data.includes("image/png") ? "PNG" : "JPEG"
    return { data, format }
  } catch {
    return null
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

async function drawHeader(doc: jsPDF, productName: string) {
  const pageW = 210
  const margin = 14
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageW, 40, "F")

  const logo = await loadImageBase64("/logo.png")
  if (logo) {
    doc.addImage(logo.data, logo.format, margin, 6, 24, 24)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("VOLTRIX BATTERIES", margin + 28, 13)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.text("Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", margin + 28, 19)
  doc.text("Phone: 051-8731661  |  Mobile: +92 303 4927779", margin + 28, 24)
  doc.text("Email: sale@voltrixbatteries.com  |  www.voltrixbatteries.com", margin + 28, 29)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("PRODUCT SPECIFICATIONS", pageW - margin, 16, { align: "right" })
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  const dateStr = new Date().toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  doc.text(dateStr, pageW - margin, 23, { align: "right" })
  doc.text(productName, pageW - margin, 30, { align: "right" })

  doc.setFillColor(...BRAND_DARK)
  doc.rect(0, 40, pageW, 8, "F")
}

async function addImageBlock(
  doc: jsPDF,
  y: number,
  margin: number,
  contentW: number,
  title: string,
  imageUrl: string,
): Promise<number> {
  const img = await loadImageBase64(imageUrl)
  if (!img) return y

  y = ensureSpace(doc, y, 14, margin)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...BRAND)
  doc.text(title, margin, y)
  y += 6

  const props = doc.getImageProperties(img.data)
  const ratio = props.width / props.height
  let imgW = contentW
  let imgH = imgW / ratio
  const maxH = 120
  if (imgH > maxH) {
    imgH = maxH
    imgW = imgH * ratio
  }

  y = ensureSpace(doc, y, imgH + 4, margin)
  const x = margin + (contentW - imgW) / 2
  doc.addImage(img.data, img.format, x, y, imgW, imgH)
  return y + imgH + 8
}

export async function generateProductSpecPDF(product: ProductSpecsPayload): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const margin = 14
  const pageW = 210
  const contentW = pageW - margin * 2
  const specs = normalizeSpecRows(product.specs)
  const categoryLabel = getCategoryDisplayLabel(String(product.category ?? ""))

  await drawHeader(doc, product.name)

  let y = 52
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  const nameLines = wrapLines(doc, product.name, contentW)
  nameLines.forEach((line) => {
    y = ensureSpace(doc, y, 8, margin)
    doc.text(line, margin, y)
    y += 8
  })

  y += 2
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  if (categoryLabel) {
    y = ensureSpace(doc, y, 6, margin)
    doc.text(`Category: ${categoryLabel}`, margin, y)
    y += 6
  }
  if (product.warranty) {
    y = ensureSpace(doc, y, 6, margin)
    doc.text(`Warranty: ${product.warranty}`, margin, y)
    y += 6
  }

  const summary = String(product.description || product.full_desc || "").trim()
  if (summary) {
    y += 4
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    y = ensureSpace(doc, y, 8, margin)
    doc.text("Product overview", margin, y)
    y += 6
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    wrapLines(doc, summary, contentW).forEach((line) => {
      y = ensureSpace(doc, y, 6, margin)
      doc.text(line, margin, y)
      y += 5.5
    })
  }

  if (specs.length > 0) {
    y += 4
    y = ensureSpace(doc, y, 12, margin)
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Specification", "Value"]],
      body: specs.map(s => [s.label, s.value]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 250, 250] },
      theme: "striped",
    })
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20
    y += 8
  }

  const mainImage = Array.isArray(product.images) ? product.images[0] : undefined
  if (mainImage) {
    y = await addImageBlock(doc, y, margin, contentW, "Product image", mainImage)
  }

  if (product.specSheetUrl) {
    y = await addImageBlock(doc, y, margin, contentW, "Full specification sheet", product.specSheetUrl)
  }

  for (const row of specs) {
    if (row.imageUrl) {
      y = await addImageBlock(
        doc,
        y,
        margin,
        contentW,
        row.label ? `${row.label} — detail` : "Specification detail",
        row.imageUrl,
      )
    }
  }

  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(
    "Voltrix Batteries Pvt. Ltd. — This document is generated from official product data.",
    margin,
    pageH - 10,
  )

  return doc.output("blob")
}

export async function downloadProductSpecPDF(product: ProductSpecsPayload): Promise<void> {
  const blob = await generateProductSpecPDF(product)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Voltrix-Specs-${slugify(product.name) || "product"}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
