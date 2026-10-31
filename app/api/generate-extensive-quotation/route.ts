import { NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import path from "path"
import fs from "fs"
import {
  includedQuoteTotal,
  rowToExtensiveQuotation,
  type ExtensiveQuotation,
  type QuoteBodyType,
  type QuoteCustomSection,
  type QuoteTermSection,
  type QuoteWarrantySection,
} from "@/lib/extensive-quotations"

function loadFont(filename: string): string {
  try {
    const p = path.join(process.cwd(), "public", filename)
    if (fs.existsSync(p)) return fs.readFileSync(p).toString("base64")
  } catch {}
  return ""
}
const geistRegB64 = loadFont("Geist-Regular.ttf")
const geistBoldB64 = loadFont("Geist-Bold.ttf")

function registerGeist(doc: jsPDF) {
  if (geistRegB64) {
    doc.addFileToVFS("Geist-Regular.ttf", geistRegB64)
    doc.addFont("Geist-Regular.ttf", "Geist", "normal")
  }
  if (geistBoldB64) {
    doc.addFileToVFS("Geist-Bold.ttf", geistBoldB64)
    doc.addFont("Geist-Bold.ttf", "Geist", "bold")
  }
}
const FONT = geistRegB64 ? "Geist" : "helvetica"

function formatDate(value: string) {
  if (!value) return "—"
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatMoney(n: number) {
  return n.toLocaleString("en-PK", { maximumFractionDigits: 0 })
}

function isGenericTermsHeading(heading: string) {
  return /^terms?\s*&?\s*conditions?$/i.test(heading.trim())
}

function resolvePublicFile(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/")) {
    const rel = trimmed.replace(/^\//, "")
    const full = path.join(process.cwd(), "public", rel)
    if (fs.existsSync(full)) return full
  }
  return null
}

function imageFormatFromPath(filePath: string): "PNG" | "JPEG" | "WEBP" | null {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".png") return "PNG"
  if (ext === ".jpg" || ext === ".jpeg") return "JPEG"
  if (ext === ".webp") return "WEBP"
  return null
}

type C = {
  teal: [number, number, number]
  darkTeal: [number, number, number]
  softTeal: [number, number, number]
  white: [number, number, number]
  ink: [number, number, number]
  muted: [number, number, number]
  line: [number, number, number]
  soft: [number, number, number]
  card: [number, number, number]
}

const COLORS: C = {
  teal: [26, 159, 154],
  darkTeal: [18, 120, 116],
  softTeal: [232, 247, 246],
  white: [255, 255, 255],
  ink: [22, 28, 32],
  muted: [100, 110, 116],
  line: [226, 232, 232],
  soft: [248, 250, 250],
  card: [255, 255, 255],
}

type Ctx = {
  doc: jsPDF
  pageW: number
  pageH: number
  mL: number
  mR: number
  contentW: number
  topY: number
  footerReserve: number
  branded: boolean
}

function ensureSpace(ctx: Ctx, y: number, need: number): number {
  if (y + need > ctx.pageH - ctx.footerReserve) {
    ctx.doc.addPage()
    return ctx.topY
  }
  return y
}

function drawAccentBar(doc: jsPDF, x: number, y: number, h: number) {
  doc.setFillColor(...COLORS.teal)
  doc.roundedRect(x, y, 1.4, h, 0.4, 0.4, "F")
}

function sectionHeader(ctx: Ctx, title: string, y: number): number {
  y = ensureSpace(ctx, y, 14)
  const { doc, mL, contentW } = ctx
  doc.setFillColor(...COLORS.softTeal)
  doc.roundedRect(mL, y - 4, contentW, 9, 1.2, 1.2, "F")
  doc.setFillColor(...COLORS.teal)
  doc.roundedRect(mL, y - 4, 1.6, 9, 0.6, 0.6, "F")
  doc.setFont(FONT, "bold")
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.ink)
  doc.text(title.toUpperCase(), mL + 6, y + 1.8)
  return y + 10
}

function writeWrapped(
  ctx: Ctx,
  text: string,
  y: number,
  opts?: { size?: number; color?: [number, number, number]; bold?: boolean; italic?: boolean; indent?: number; lineH?: number },
): number {
  const { doc, mL, contentW } = ctx
  const size = opts?.size ?? 9
  const lineH = opts?.lineH ?? size * 0.42
  const indent = opts?.indent ?? 0
  doc.setFont(FONT, opts?.bold ? "bold" : "normal")
  doc.setFontSize(size)
  doc.setTextColor(...(opts?.color || COLORS.ink))
  const lines = doc.splitTextToSize(text, contentW - indent) as string[]
  for (const line of lines) {
    y = ensureSpace(ctx, y, lineH + 1)
    doc.text(line, mL + indent, y)
    y += lineH
  }
  return y
}

function drawPlainOrBullets(
  ctx: Ctx,
  bodyType: QuoteBodyType,
  bullets: string[],
  plainText: string,
  y: number,
): number {
  if (bodyType === "plain") {
    const text = plainText.trim()
    if (!text) return y
    return writeWrapped(ctx, text, y, { size: 8.5, color: [50, 56, 62], lineH: 3.8 }) + 2
  }
  const list = bullets.map((b) => b.trim()).filter(Boolean)
  for (const bullet of list) {
    y = ensureSpace(ctx, y, 8)
    ctx.doc.setFont(FONT, "normal")
    ctx.doc.setFontSize(8.5)
    ctx.doc.setTextColor(...COLORS.teal)
    ctx.doc.text("•", ctx.mL, y)
    ctx.doc.setTextColor(50, 56, 62)
    const wrapped = ctx.doc.splitTextToSize(bullet, ctx.contentW - 6) as string[]
    ctx.doc.text(wrapped, ctx.mL + 5, y)
    y += wrapped.length * 3.7 + 1.4
  }
  return y + 1
}

function drawSubheading(ctx: Ctx, heading: string, y: number, skipGeneric = false): number {
  const h = heading.trim()
  if (!h) return y
  if (skipGeneric && isGenericTermsHeading(h)) return y
  y = ensureSpace(ctx, y, 8)
  ctx.doc.setFont(FONT, "bold")
  ctx.doc.setFontSize(9)
  ctx.doc.setTextColor(...COLORS.ink)
  const lines = ctx.doc.splitTextToSize(h, ctx.contentW) as string[]
  ctx.doc.text(lines, ctx.mL, y)
  return y + lines.length * 3.8 + 1.5
}

function drawHeader(ctx: Ctx, quote: ExtensiveQuotation): number {
  const { doc, pageW, mL, mR, branded } = ctx
  if (branded) {
    doc.setFillColor(...COLORS.teal)
    doc.rect(0, 0, pageW, 38, "F")
    doc.setFillColor(...COLORS.darkTeal)
    doc.rect(0, 38, pageW, 3, "F")

    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png")
      if (fs.existsSync(logoPath)) {
        const logoBase64 = fs.readFileSync(logoPath).toString("base64")
        doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", mL, 7, 24, 24)
      }
    } catch {}

    doc.setTextColor(...COLORS.white)
    doc.setFont(FONT, "bold")
    doc.setFontSize(14)
    doc.text("VOLTRIX BATTERIES", mL + 28, 14)
    doc.setFont(FONT, "normal")
    doc.setFontSize(7.2)
    doc.setTextColor(220, 245, 243)
    doc.text("Plot 73, Street 14, I-9/2, Islamabad", mL + 28, 20)
    doc.text("051-8731661  ·  +92 303 4927779", mL + 28, 25)
    doc.text("sale@voltrixbatteries.com  ·  voltrixbatteries.com", mL + 28, 30)

    doc.setFont(FONT, "bold")
    doc.setFontSize(18)
    doc.setTextColor(...COLORS.white)
    doc.text("QUOTATION", pageW - mR, 16, { align: "right" })
    doc.setFont(FONT, "normal")
    doc.setFontSize(9)
    doc.setTextColor(220, 245, 243)
    doc.text(quote.quotationNumber, pageW - mR, 23, { align: "right" })
    return 50
  }

  doc.setFont(FONT, "bold")
  doc.setFontSize(18)
  doc.setTextColor(...COLORS.ink)
  doc.text("QUOTATION", mL, 18)
  doc.setFont(FONT, "normal")
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)
  doc.text(quote.quotationNumber, pageW - mR, 18, { align: "right" })
  doc.setDrawColor(...COLORS.teal)
  doc.setLineWidth(1.2)
  doc.line(mL, 22, pageW - mR, 22)
  return 30
}

function drawPartyBlock(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  const { doc, mL, mR, pageW, contentW } = ctx
  const gap = 4
  const leftW = contentW * 0.58
  const rightW = contentW - leftW - gap
  const boxH = 34

  y = ensureSpace(ctx, y, boxH + 4)

  // Prepared for
  doc.setFillColor(...COLORS.soft)
  doc.roundedRect(mL, y, leftW, boxH, 1.5, 1.5, "F")
  drawAccentBar(doc, mL + 2, y + 4, boxH - 8)
  doc.setFont(FONT, "bold")
  doc.setFontSize(6.5)
  doc.setTextColor(...COLORS.teal)
  doc.text("PREPARED FOR", mL + 7, y + 7)
  doc.setFont(FONT, "bold")
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.ink)
  const nameLines = doc.splitTextToSize(quote.recipientName || "—", leftW - 12) as string[]
  doc.text(nameLines[0], mL + 7, y + 13.5)
  doc.setFont(FONT, "normal")
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  const detail = [quote.recipientCompany, quote.recipientAddress].filter(Boolean).join("\n")
  if (detail) {
    const dLines = doc.splitTextToSize(detail, leftW - 12) as string[]
    doc.text(dLines.slice(0, 2), mL + 7, y + 19)
  }
  if (quote.preparedBy?.trim()) {
    doc.setFont(FONT, "bold")
    doc.setFontSize(6.5)
    doc.setTextColor(...COLORS.teal)
    doc.text("PREPARED BY", mL + 7, y + 28)
    doc.setFont(FONT, "normal")
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.ink)
    doc.text(quote.preparedBy.trim(), mL + 36, y + 28)
  }

  // Quote meta
  const rx = mL + leftW + gap
  doc.setFillColor(...COLORS.softTeal)
  doc.roundedRect(rx, y, rightW, boxH, 1.5, 1.5, "F")
  const rows = [
    { label: "Quote date", value: formatDate(quote.quoteDate) },
    { label: "Valid until", value: quote.validUntil ? formatDate(quote.validUntil) : "—" },
    { label: "Reference", value: quote.quotationNumber },
    { label: "Company", value: "Voltrix Batteries Pvt. Ltd" },
  ]
  rows.forEach((row, i) => {
    const ry = y + 6 + i * 6.5
    doc.setFont(FONT, "bold")
    doc.setFontSize(6.2)
    doc.setTextColor(...COLORS.teal)
    doc.text(row.label.toUpperCase(), rx + 4, ry)
    doc.setFont(FONT, "normal")
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.ink)
    const clipped = doc.splitTextToSize(row.value, rightW - 28) as string[]
    doc.text(clipped[0] || "", pageW - mR - 4, ry, { align: "right" })
  })

  return y + boxH + 8
}

function drawIntro(ctx: Ctx, intro: string, y: number): number {
  const text = intro.trim()
  if (!text) return y
  const { doc, mL, contentW } = ctx
  const lines = doc.splitTextToSize(text, contentW - 10) as string[]
  const boxH = Math.min(8 + lines.length * 4.1, 42)
  y = ensureSpace(ctx, y, boxH + 6)
  doc.setDrawColor(...COLORS.line)
  doc.setFillColor(...COLORS.white)
  doc.setLineWidth(0.3)
  doc.roundedRect(mL, y, contentW, boxH, 2, 2, "FD")
  drawAccentBar(doc, mL + 2.5, y + 4, boxH - 8)
  doc.setFont(FONT, "normal")
  doc.setFontSize(9)
  doc.setTextColor(45, 52, 58)
  let ty = y + 7
  for (const line of lines.slice(0, 8)) {
    doc.text(line, mL + 8, ty)
    ty += 4.1
  }
  return y + boxH + 8
}

function drawTotal(ctx: Ctx, total: number, y: number): number {
  const { doc, pageW, mR } = ctx
  const totW = 68
  const totX = pageW - mR - totW
  y = ensureSpace(ctx, y, 16)
  doc.setFillColor(...COLORS.soft)
  doc.roundedRect(totX - 2, y - 2, totW + 4, 14, 2, 2, "F")
  doc.setFillColor(...COLORS.teal)
  doc.roundedRect(totX, y, totW, 10, 1.5, 1.5, "F")
  doc.setFont(FONT, "bold")
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.white)
  doc.text("TOTAL", totX + 4, y + 6.5)
  doc.setFontSize(10)
  doc.text(`PKR ${formatMoney(total)}`, totX + totW - 4, y + 6.5, { align: "right" })
  return y + 16
}

function drawProjects(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  const projects = quote.projects.filter(
    (p) => p.title.trim() || p.summary.trim() || p.imageUrls.length,
  )
  if (!projects.length) return y
  y = sectionHeader(ctx, "Recent projects", y)
  const { doc, mL, contentW } = ctx

  for (const project of projects) {
    const urls = project.imageUrls.filter(Boolean).slice(0, 4)
    const imgH = urls.length ? 30 : 0
    const estH = 18 + (project.summary ? 12 : 0) + imgH
    y = ensureSpace(ctx, y, Math.min(estH, 50))

    doc.setFillColor(...COLORS.soft)
    const cardTop = y
    let innerY = y + 5

    if (project.title.trim()) {
      doc.setFont(FONT, "bold")
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.ink)
      doc.text(project.title.trim(), mL + 4, innerY)
      innerY += 5
    }
    if (project.location.trim()) {
      doc.setFont(FONT, "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(...COLORS.teal)
      doc.text(project.location.trim(), mL + 4, innerY)
      innerY += 4.5
    }
    if (project.summary.trim()) {
      doc.setFont(FONT, "normal")
      doc.setFontSize(8)
      doc.setTextColor(55, 60, 66)
      const sum = doc.splitTextToSize(project.summary.trim(), contentW - 8) as string[]
      for (const line of sum.slice(0, 4)) {
        innerY = ensureSpace(ctx, innerY, 5)
        if (innerY < 20) {
          // new page — restart card without prior background
        }
        doc.text(line, mL + 4, innerY)
        innerY += 3.6
      }
      innerY += 2
    }

    if (urls.length) {
      const imgW = (contentW - 8 - (urls.length - 1) * 3) / Math.min(urls.length, 3)
      const h = 28
      let x = mL + 4
      let row = 0
      for (let i = 0; i < urls.length; i++) {
        const filePath = resolvePublicFile(urls[i])
        const fmt = filePath ? imageFormatFromPath(filePath) : null
        if (!filePath || !fmt) continue
        if (i > 0 && i % 3 === 0) {
          x = mL + 4
          row += 1
          innerY += h + 3
        }
        innerY = ensureSpace(ctx, innerY, h + 4)
        try {
          const b64 = fs.readFileSync(filePath).toString("base64")
          const mime = fmt === "PNG" ? "image/png" : fmt === "WEBP" ? "image/webp" : "image/jpeg"
          const drawY = innerY
          doc.addImage(`data:${mime};base64,${b64}`, fmt, x, drawY, imgW, h)
          x += imgW + 3
        } catch {
          // skip
        }
      }
      innerY += h + 3
    }

    const cardH = Math.max(innerY - cardTop + 3, 12)
    // redraw soft card behind content is hard mid-stream; use top border instead
    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.35)
    doc.roundedRect(mL, cardTop - 1, contentW, cardH, 2, 2, "S")
    y = cardTop + cardH + 5
  }
  return y
}

function drawWarranties(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  const warranties = quote.warranties.filter(
    (w) => w.productName.trim() || w.heading.trim() || w.bullets.length || w.plainText.trim(),
  )
  if (!warranties.length) return y
  y = sectionHeader(ctx, "Product warranties", y)

  const tableLike = warranties.every(
    (w) => (w.bodyType || "plain") === "plain" || (!w.bullets.filter(Boolean).length && w.plainText.trim()),
  )

  if (tableLike) {
    const { doc, mL, mR, footerReserve } = ctx
    autoTable(doc, {
      startY: y,
      head: [["Sr.", "Product", "Brand", "Warranty"]],
      body: warranties.map((w, i) => [
        String(i + 1),
        w.productName.trim() || "—",
        w.heading.trim() || "—",
        w.plainText.trim() || "—",
      ]),
      margin: { left: mL, right: mR, bottom: footerReserve },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        textColor: COLORS.ink,
        lineColor: COLORS.line,
        lineWidth: 0.2,
        font: FONT,
        valign: "middle",
      },
      headStyles: {
        fillColor: COLORS.darkTeal,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 7.5,
        font: FONT,
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 95 },
        2: { cellWidth: 42 },
        3: { cellWidth: 33, halign: "center", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: COLORS.soft },
    })
    return ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y) + 8
  }

  for (const w of warranties as QuoteWarrantySection[]) {
    const title = [w.productName.trim(), w.heading.trim()].filter(Boolean).join("  ·  ")
    y = drawSubheading(ctx, title, y)
    y = drawPlainOrBullets(ctx, w.bodyType || "bullets", w.bullets, w.plainText || "", y)
    y += 2
  }
  return y
}

function drawTestimonials(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  const testimonials = quote.testimonials.filter((t) => t.quote.trim() || t.name.trim())
  if (!testimonials.length) return y
  y = sectionHeader(ctx, "Client testimonials", y)
  const { doc, mL, contentW } = ctx

  for (const t of testimonials) {
    const quoteText = t.quote.trim()
    const wrapped = doc.splitTextToSize(quoteText ? `“${quoteText}”` : "", contentW - 12) as string[]
    const boxH = 10 + wrapped.length * 3.8 + (t.name ? 5 : 0)
    y = ensureSpace(ctx, y, boxH + 4)
    doc.setFillColor(...COLORS.soft)
    doc.roundedRect(mL, y, contentW, boxH, 2, 2, "F")
    drawAccentBar(doc, mL + 2, y + 4, boxH - 8)
    let ty = y + 6
    doc.setFont(FONT, "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(50, 56, 62)
    for (const line of wrapped) {
      doc.text(line, mL + 8, ty)
      ty += 3.8
    }
    const attribution = [t.name.trim(), t.role.trim()].filter(Boolean).join(" · ")
    if (attribution) {
      ty += 1
      doc.setFont(FONT, "bold")
      doc.setFontSize(7.5)
      doc.setTextColor(...COLORS.teal)
      doc.text(attribution, mL + 8, ty)
    }
    y += boxH + 4
  }
  return y
}

function drawCustomSections(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  const sections = quote.customSections.filter(
    (s) => s.heading.trim() || s.bullets.length || s.plainText.trim(),
  )
  if (!sections.length) return y
  y = sectionHeader(ctx, "Additional details", y)
  for (const s of sections as QuoteCustomSection[]) {
    y = drawSubheading(ctx, s.heading, y)
    y = drawPlainOrBullets(ctx, s.bodyType || "bullets", s.bullets, s.plainText || "", y)
    y += 2
  }
  return y
}

function drawTerms(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  const terms = quote.terms.filter(
    (t) => t.heading.trim() || t.bullets.some((b) => b.trim()) || (t.plainText || "").trim(),
  )
  if (!terms.length) return y
  y = sectionHeader(ctx, "Terms & conditions", y)
  for (const section of terms as QuoteTermSection[]) {
    y = drawSubheading(ctx, section.heading, y, true)
    y = drawPlainOrBullets(ctx, section.bodyType || "bullets", section.bullets, section.plainText || "", y)
    y += 2
  }
  return y
}

function applyPageFooters(ctx: Ctx, quote: ExtensiveQuotation) {
  const { doc, pageW, pageH, mL, mR, branded } = ctx
  const pageCount = doc.getNumberOfPages()
  const custom = quote.footerText.trim()
  const base = branded ? "Voltrix Batteries (Pvt) Ltd" : "Quotation"

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.4)
    doc.line(mL, pageH - 14, pageW - mR, pageH - 14)
    doc.setFont(FONT, "normal")
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.muted)
    doc.text(base, mL, pageH - 9)
    doc.text(`Page ${i} of ${pageCount}`, pageW - mR, pageH - 9, { align: "right" })
    if (custom) {
      doc.setFontSize(6.5)
      const clipped = doc.splitTextToSize(custom, pageW - mL - mR - 50) as string[]
      doc.text(clipped[0] || "", pageW / 2, pageH - 9, { align: "center" })
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const quote: ExtensiveQuotation = rowToExtensiveQuotation(body)
    const included = quote.items.filter((line) => line.included && (Number(line.qty) || 0) > 0)
    const total = includedQuoteTotal(quote.items)
    const branded = quote.showBranding !== false

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    registerGeist(doc)
    doc.setFont(FONT, "normal")

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const mL = 14
    const mR = 14
    const ctx: Ctx = {
      doc,
      pageW,
      pageH,
      mL,
      mR,
      contentW: pageW - mL - mR,
      topY: branded ? 16 : 14,
      footerReserve: 20,
      branded,
    }

    let y = drawHeader(ctx, quote)
    y = drawPartyBlock(ctx, quote, y)
    y = drawIntro(ctx, quote.introText, y)

    const tableBody = included.map((item, i) => [
      String(i + 1),
      item.lineKind === "expense" ? `${item.itemName}` : item.itemName,
      item.lineKind === "expense" ? "Expense" : item.supplier || "—",
      `${item.qty} ${item.unit}`.trim(),
      formatMoney(item.rate),
      formatMoney(item.qty * item.rate),
    ])

    y = sectionHeader(ctx, "Commercial offer", y)

    autoTable(doc, {
      startY: y,
      head: [["#", "Description", "Supplier / Type", "Qty", "Unit (PKR)", "Amount (PKR)"]],
      body: tableBody.length ? tableBody : [["—", "No items included", "", "", "", ""]],
      margin: { left: mL, right: mR, bottom: ctx.footerReserve },
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.4, bottom: 2.4, left: 2.2, right: 2.2 },
        textColor: COLORS.ink,
        lineColor: COLORS.line,
        lineWidth: 0.15,
        font: FONT,
        minCellHeight: 7.5,
        valign: "middle",
      },
      headStyles: {
        fillColor: COLORS.teal,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 7.5,
        font: FONT,
        cellPadding: { top: 2.6, bottom: 2.6, left: 2.2, right: 2.2 },
      },
      columnStyles: {
        0: { cellWidth: 9, halign: "center" },
        1: { cellWidth: 58 },
        2: { cellWidth: 34 },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 27, halign: "right", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: COLORS.soft },
      tableLineColor: COLORS.line,
      tableLineWidth: 0.15,
    })

    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y) + 6
    y = drawTotal(ctx, total, y)

    // Signature / prepared-by strip before optional marketing content
    y = ensureSpace(ctx, y, 22)
    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.3)
    doc.line(mL, y, mL + 55, y)
    doc.line(pageW - mR - 55, y, pageW - mR, y)
    doc.setFont(FONT, "normal")
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.muted)
    doc.text("Client acceptance", mL, y + 4)
    doc.text(quote.preparedBy?.trim() || "Prepared by Voltrix", pageW - mR - 55, y + 4)
    doc.setFont(FONT, "bold")
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.ink)
    if (quote.preparedBy?.trim()) {
      doc.text(quote.preparedBy.trim(), pageW - mR - 55, y + 9)
    }
    doc.setFont(FONT, "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(...COLORS.muted)
    doc.text("Voltrix Batteries Pvt. Ltd", pageW - mR - 55, y + 13)
    y += 20

    y = drawCustomSections(ctx, quote, y)
    y = drawWarranties(ctx, quote, y)
    y = drawTerms(ctx, quote, y)
    y = drawProjects(ctx, quote, y)
    y = drawTestimonials(ctx, quote, y)

    applyPageFooters(ctx, quote)

    const pdfBlob = doc.output("arraybuffer")
    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Quotation-${quote.quotationNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[generate-extensive-quotation]", error)
    return NextResponse.json({ error: "Failed to generate quotation" }, { status: 500 })
  }
}
