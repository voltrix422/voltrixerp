import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  absoluteAssetUrl,
  normalizeSpecRows,
  type ProductSpecRow,
  type ProductSpecsPayload,
} from "@/lib/product-specs"
import { getCategoryDisplayLabel } from "@/lib/product-categories"

const TEAL: [number, number, number] = [31, 172, 166]
const TEAL_DARK: [number, number, number] = [18, 110, 106]
const INK: [number, number, number] = [24, 28, 32]
const MUTED: [number, number, number] = [90, 98, 106]
const RULE: [number, number, number] = [220, 228, 230]
const SOFT: [number, number, number] = [244, 250, 249]
const WHITE: [number, number, number] = [255, 255, 255]

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_H = 14

type JsDoc = jsPDF & { lastAutoTable?: { finalY: number } }

type LoadedImage = { data: string; format: "PNG" | "JPEG" }

async function loadImageBase64(url: string): Promise<LoadedImage | null> {
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

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(String(text || "").trim(), maxWidth) as string[]
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - FOOTER_H - 4) {
    doc.addPage()
    return MARGIN + 4
  }
  return y
}

function fitImage(
  img: LoadedImage,
  maxW: number,
  maxH: number,
  doc: jsPDF,
): { w: number; h: number } {
  const props = doc.getImageProperties(img.data)
  const ratio = props.width / Math.max(props.height, 1)
  let w = maxW
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  return { w, h }
}

function drawFooter(doc: JsDoc, productName: string) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.35)
    doc.line(MARGIN, PAGE_H - FOOTER_H, PAGE_W - MARGIN, PAGE_H - FOOTER_H)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text("Voltrix Batteries Pvt. Ltd.", MARGIN, PAGE_H - 7)
    doc.text("Official product specification sheet", MARGIN, PAGE_H - 3.5)

    const short = productName.length > 42 ? `${productName.slice(0, 40)}…` : productName
    doc.text(short, PAGE_W / 2, PAGE_H - 5, { align: "center" })
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 5, { align: "right" })
  }
}

function drawSectionLabel(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(...TEAL_DARK)
  doc.text(title.toUpperCase(), MARGIN, y)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y + 1.8, MARGIN + 22, y + 1.8)
  return y + 7
}

async function drawBrandHeader(doc: jsPDF, logo: LoadedImage | null) {
  doc.setFillColor(...TEAL_DARK)
  doc.rect(0, 0, PAGE_W, 28, "F")
  doc.setFillColor(...TEAL)
  doc.rect(0, 28, PAGE_W, 2.2, "F")

  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, MARGIN, 5, 18, 18)
    } catch {
      /* text-only header */
    }
  }

  const textX = MARGIN + (logo ? 22 : 0)
  doc.setTextColor(...WHITE)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("VOLTRIX BATTERIES", textX, 12)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.text("Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", textX, 17.5)
  doc.text("051-8731661  ·  +92 303 4927779  ·  sale@voltrixbatteries.com", textX, 22)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("SPECIFICATION SHEET", PAGE_W - MARGIN, 13, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  doc.text(dateStr, PAGE_W - MARGIN, 19, { align: "right" })
  doc.text("www.voltrixbatteries.com", PAGE_W - MARGIN, 24, { align: "right" })
}

function drawMetaChips(
  doc: jsPDF,
  y: number,
  chips: { label: string; value: string }[],
): number {
  const usable = chips.filter((c) => c.value.trim())
  if (!usable.length) return y

  let x = MARGIN
  const chipH = 9
  const gap = 3
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)

  for (const chip of usable) {
    const label = `${chip.label}: ${chip.value}`
    const w = Math.min(doc.getTextWidth(label) + 8, CONTENT_W)
    if (x + w > PAGE_W - MARGIN) {
      x = MARGIN
      y += chipH + gap
    }
    doc.setFillColor(...SOFT)
    doc.setDrawColor(...RULE)
    doc.roundedRect(x, y, w, chipH, 1.2, 1.2, "FD")
    doc.setTextColor(...INK)
    doc.text(label, x + 4, y + 6)
    x += w + gap
  }
  return y + chipH + 6
}

function drawOverview(doc: jsPDF, y: number, text: string, maxWidth: number): number {
  if (!text.trim()) return y
  y = drawSectionLabel(doc, "Overview", y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  const lines = wrapLines(doc, text, maxWidth)
  for (const line of lines) {
    y = ensureSpace(doc, y, 5.2)
    doc.text(line, MARGIN, y)
    y += 5
  }
  return y + 4
}

async function drawProductHero(
  doc: jsPDF,
  y: number,
  productImage: LoadedImage | null,
  overview: string,
  highlightSpecs: ProductSpecRow[],
): Promise<number> {
  const hasImage = Boolean(productImage)
  const colGap = 8
  const imageColW = hasImage ? 72 : 0
  const textColW = CONTENT_W - imageColW - (hasImage ? colGap : 0)
  const textX = MARGIN + (hasImage ? imageColW + colGap : 0)

  let imageBottom = y
  if (productImage) {
    const boxH = 78
    doc.setFillColor(...SOFT)
    doc.setDrawColor(...RULE)
    doc.roundedRect(MARGIN, y, imageColW, boxH, 2, 2, "FD")
    const { w, h } = fitImage(productImage, imageColW - 8, boxH - 8, doc)
    const ix = MARGIN + (imageColW - w) / 2
    const iy = y + (boxH - h) / 2
    try {
      doc.addImage(productImage.data, productImage.format, ix, iy, w, h)
    } catch {
      /* ignore broken image */
    }
    imageBottom = y + boxH
  }

  let ty = y + 2
  if (overview.trim()) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(...TEAL_DARK)
    doc.text("PRODUCT OVERVIEW", textX, ty)
    ty += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.8)
    doc.setTextColor(...INK)
    const lines = wrapLines(doc, overview, textColW)
    const maxLines = hasImage ? 10 : 14
    lines.slice(0, maxLines).forEach((line) => {
      doc.text(line, textX, ty)
      ty += 4.4
    })
    if (lines.length > maxLines) {
      doc.setTextColor(...MUTED)
      doc.text("…", textX, ty)
      ty += 4.4
    }
    ty += 3
  }

  if (highlightSpecs.length) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(...TEAL_DARK)
    doc.text("KEY SPECS", textX, ty)
    ty += 5
    for (const row of highlightSpecs.slice(0, 5)) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(row.label || "—", textX, ty)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...INK)
      const valueLines = wrapLines(doc, row.value || "—", textColW * 0.55)
      doc.text(valueLines[0] || "—", textX + textColW * 0.42, ty)
      ty += 4.6
    }
  }

  return Math.max(imageBottom, ty) + 6
}

function drawSpecsTable(doc: JsDoc, y: number, specs: ProductSpecRow[]): number {
  if (!specs.length) return y
  y = ensureSpace(doc, y, 18)
  y = drawSectionLabel(doc, "Technical specifications", y)

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_H + 4 },
    head: [["Specification", "Value"]],
    body: specs.map((s) => [s.label || "—", s.value || "—"]),
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: { top: 2.6, bottom: 2.6, left: 3.2, right: 3.2 },
      textColor: INK,
      lineColor: RULE,
      lineWidth: 0.2,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: TEAL_DARK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3.2, right: 3.2 },
    },
    alternateRowStyles: { fillColor: SOFT },
    columnStyles: {
      0: { cellWidth: CONTENT_W * 0.4, fontStyle: "bold", textColor: MUTED },
      1: { cellWidth: CONTENT_W * 0.6 },
    },
    didDrawPage: () => {
      /* footer drawn once at the end */
    },
  })

  return (doc.lastAutoTable?.finalY ?? y) + 8
}

async function drawFramedImagePage(
  doc: jsPDF,
  title: string,
  subtitle: string,
  image: LoadedImage,
  logo: LoadedImage | null,
) {
  doc.addPage()
  await drawBrandHeader(doc, logo)

  let y = 38
  y = drawSectionLabel(doc, title, y)
  if (subtitle) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(subtitle, MARGIN, y)
    y += 6
  }

  const maxH = PAGE_H - y - FOOTER_H - 8
  const { w, h } = fitImage(image, CONTENT_W, maxH, doc)
  const x = MARGIN + (CONTENT_W - w) / 2

  doc.setFillColor(...SOFT)
  doc.setDrawColor(...RULE)
  doc.roundedRect(x - 2, y - 2, w + 4, h + 4, 1.5, 1.5, "FD")
  try {
    doc.addImage(image.data, image.format, x, y, w, h)
  } catch {
    doc.setTextColor(...MUTED)
    doc.setFontSize(10)
    doc.text("Image could not be embedded.", MARGIN, y + 10)
  }
}

export async function generateProductSpecPDF(product: ProductSpecsPayload): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsDoc
  const specs = normalizeSpecRows(product.specs)
  const categoryLabel = getCategoryDisplayLabel(String(product.category ?? ""))
  const overview = String(product.description || product.full_desc || "").trim()
  const mainImageUrl = Array.isArray(product.images) ? product.images[0] : undefined

  const [logo, productImage, specSheetImage] = await Promise.all([
    loadImageBase64("/logo.png"),
    mainImageUrl ? loadImageBase64(mainImageUrl) : Promise.resolve(null),
    product.specSheetUrl ? loadImageBase64(product.specSheetUrl) : Promise.resolve(null),
  ])

  await drawBrandHeader(doc, logo)

  let y = 46
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  const nameLines = wrapLines(doc, product.name, CONTENT_W)
  for (const line of nameLines) {
    doc.text(line, MARGIN, y)
    y += 7.5
  }

  y += 3
  y = drawMetaChips(doc, y, [
    { label: "Category", value: categoryLabel },
    { label: "Warranty", value: String(product.warranty || "").trim() },
    { label: "Document", value: "Product datasheet" },
  ])

  const highlightSpecs = specs.filter((s) => s.label || s.value).slice(0, 5)
  if (productImage || overview || highlightSpecs.length) {
    y = await drawProductHero(doc, y, productImage, overview, highlightSpecs)
  } else if (overview) {
    y = drawOverview(doc, y, overview, CONTENT_W)
  }

  y = drawSpecsTable(doc, y, specs)

  if (specSheetImage) {
    await drawFramedImagePage(
      doc,
      "Full specification sheet",
      product.name,
      specSheetImage,
      logo,
    )
  }

  for (const row of specs) {
    if (!row.imageUrl) continue
    const detail = await loadImageBase64(row.imageUrl)
    if (!detail) continue
    await drawFramedImagePage(
      doc,
      row.label ? `${row.label}` : "Specification detail",
      product.name,
      detail,
      logo,
    )
  }

  drawFooter(doc, product.name)
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
