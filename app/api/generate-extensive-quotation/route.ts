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

/** Quiet professional palette — ink / gray, minimal chrome. */
const C = {
  ink: [32, 32, 32] as [number, number, number],
  muted: [100, 100, 100] as [number, number, number],
  softMuted: [130, 130, 130] as [number, number, number],
  line: [220, 220, 220] as [number, number, number],
  rule: [60, 60, 60] as [number, number, number],
  headBg: [248, 248, 248] as [number, number, number],
  altRow: [252, 252, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  accent: [26, 120, 116] as [number, number, number],
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

function hairline(ctx: Ctx, y: number, weight = 0.25): number {
  const { doc, mL, pageW, mR } = ctx
  doc.setDrawColor(...C.line)
  doc.setLineWidth(weight)
  doc.line(mL, y, pageW - mR, y)
  return y + 5
}

function sectionHeader(ctx: Ctx, title: string, y: number): number {
  y = ensureSpace(ctx, y, 11)
  const { doc, mL } = ctx
  doc.setFont(FONT, "bold")
  doc.setFontSize(9)
  doc.setTextColor(...C.ink)
  doc.text(title.toUpperCase(), mL, y)
  // Short accent underline under the title only — not a full-width double rule
  const tw = doc.getTextWidth(title.toUpperCase())
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.7)
  doc.line(mL, y + 2, mL + Math.min(tw, 48), y + 2)
  return y + 8
}

function writeWrapped(
  ctx: Ctx,
  text: string,
  y: number,
  opts?: { size?: number; color?: [number, number, number]; bold?: boolean; indent?: number; lineH?: number },
): number {
  const { doc, mL, contentW } = ctx
  const size = opts?.size ?? 9
  const lineH = opts?.lineH ?? size * 0.42
  const indent = opts?.indent ?? 0
  doc.setFont(FONT, opts?.bold ? "bold" : "normal")
  doc.setFontSize(size)
  doc.setTextColor(...(opts?.color || C.ink))
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
    return writeWrapped(ctx, text, y, { size: 8.5, color: C.ink, lineH: 3.9 }) + 2
  }
  const list = bullets.map((b) => b.trim()).filter(Boolean)
  for (const bullet of list) {
    y = ensureSpace(ctx, y, 8)
    ctx.doc.setFont(FONT, "normal")
    ctx.doc.setFontSize(8.5)
    ctx.doc.setTextColor(...C.muted)
    ctx.doc.text("–", ctx.mL, y)
    ctx.doc.setTextColor(...C.ink)
    const wrapped = ctx.doc.splitTextToSize(bullet, ctx.contentW - 6) as string[]
    ctx.doc.text(wrapped, ctx.mL + 5, y)
    y += wrapped.length * 3.8 + 1.6
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
  ctx.doc.setTextColor(...C.ink)
  const lines = ctx.doc.splitTextToSize(h, ctx.contentW) as string[]
  ctx.doc.text(lines, ctx.mL, y)
  return y + lines.length * 3.8 + 2
}

function tableDefaults(ctx: Ctx) {
  return {
    theme: "plain" as const,
    margin: { left: ctx.mL, right: ctx.mR, bottom: ctx.footerReserve },
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.6, bottom: 2.6, left: 2, right: 2 },
      textColor: C.ink,
      lineColor: C.line,
      lineWidth: 0,
      font: FONT,
      minCellHeight: 6.5,
      valign: "top" as const,
      overflow: "linebreak" as const,
    },
    headStyles: {
      fillColor: C.headBg,
      textColor: C.ink,
      fontStyle: "bold" as const,
      fontSize: 7,
      font: FONT,
      lineWidth: { bottom: 0.45 },
      lineColor: C.rule,
      cellPadding: { top: 2.8, bottom: 2.8, left: 2, right: 2 },
      valign: "middle" as const,
    },
    bodyStyles: {
      lineWidth: { bottom: 0.15 },
      lineColor: C.line,
    },
    alternateRowStyles: { fillColor: C.altRow },
    tableLineColor: C.line,
    tableLineWidth: 0,
  }
}

function drawHeader(ctx: Ctx, quote: ExtensiveQuotation): number {
  const { doc, pageW, mL, mR, branded } = ctx
  let y = 16

  if (branded) {
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png")
      if (fs.existsSync(logoPath)) {
        const logoBase64 = fs.readFileSync(logoPath).toString("base64")
        doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", mL, y - 4, 16, 16)
      }
    } catch {
      /* ignore */
    }

    const textX = mL + 20
    doc.setTextColor(...C.ink)
    doc.setFont(FONT, "bold")
    doc.setFontSize(12)
    doc.text("VOLTRIX BATTERIES", textX, y + 1)
    doc.setFont(FONT, "normal")
    doc.setFontSize(7.2)
    doc.setTextColor(...C.muted)
    doc.text("Plot 73, Street 14, I-9/2, Islamabad", textX, y + 6)
    doc.text("051-8731661  ·  +92 303 4927779", textX, y + 10)
    doc.text("sale@voltrixbatteries.com  ·  voltrixbatteries.com", textX, y + 14)

    doc.setFont(FONT, "bold")
    doc.setFontSize(16)
    doc.setTextColor(...C.ink)
    doc.text("QUOTATION", pageW - mR, y + 2, { align: "right" })
    doc.setFont(FONT, "normal")
    doc.setFontSize(9)
    doc.setTextColor(...C.muted)
    doc.text(quote.quotationNumber, pageW - mR, y + 9, { align: "right" })

    y = 30
    doc.setDrawColor(...C.accent)
    doc.setLineWidth(0.6)
    doc.line(mL, y, pageW - mR, y)
    return y + 8
  }

  doc.setFont(FONT, "bold")
  doc.setFontSize(16)
  doc.setTextColor(...C.ink)
  doc.text("QUOTATION", mL, y + 2)
  doc.setFont(FONT, "normal")
  doc.setFontSize(9)
  doc.setTextColor(...C.muted)
  doc.text(quote.quotationNumber, pageW - mR, y + 2, { align: "right" })
  doc.setDrawColor(...C.accent)
  doc.setLineWidth(0.6)
  doc.line(mL, y + 6, pageW - mR, y + 6)
  return y + 12
}

function drawPartyBlock(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  const { doc, mL, mR, pageW, contentW } = ctx
  const gap = 10
  const leftW = contentW * 0.55
  const rightW = contentW - leftW - gap

  y = ensureSpace(ctx, y, 36)

  doc.setFont(FONT, "bold")
  doc.setFontSize(7)
  doc.setTextColor(...C.softMuted)
  doc.text("PREPARED FOR", mL, y)

  doc.setFont(FONT, "bold")
  doc.setFontSize(11)
  doc.setTextColor(...C.ink)
  const nameLines = doc.splitTextToSize(quote.recipientName || "—", leftW) as string[]
  doc.text(nameLines[0], mL, y + 6)

  let ly = y + 11
  doc.setFont(FONT, "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...C.muted)
  if (quote.recipientCompany?.trim()) {
    doc.text(quote.recipientCompany.trim(), mL, ly)
    ly += 4.2
  }
  if (quote.recipientAddress?.trim()) {
    const dLines = doc.splitTextToSize(quote.recipientAddress.trim(), leftW) as string[]
    doc.text(dLines.slice(0, 2), mL, ly)
    ly += dLines.slice(0, 2).length * 4
  }
  if (quote.preparedBy?.trim()) {
    ly += 2
    doc.setFont(FONT, "bold")
    doc.setFontSize(7)
    doc.setTextColor(...C.softMuted)
    doc.text("PREPARED BY", mL, ly)
    doc.setFont(FONT, "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...C.ink)
    doc.text(quote.preparedBy.trim(), mL + 28, ly)
    ly += 4
  }

  const rx = mL + leftW + gap
  const meta = [
    { label: "Quote date", value: formatDate(quote.quoteDate) },
    { label: "Valid until", value: quote.validUntil ? formatDate(quote.validUntil) : "—" },
    { label: "Reference", value: quote.quotationNumber },
  ]
  meta.forEach((row, i) => {
    const ry = y + i * 7
    doc.setFont(FONT, "bold")
    doc.setFontSize(7)
    doc.setTextColor(...C.softMuted)
    doc.text(row.label.toUpperCase(), rx, ry)
    doc.setFont(FONT, "normal")
    doc.setFontSize(9)
    doc.setTextColor(...C.ink)
    doc.text(row.value, pageW - mR, ry, { align: "right" })
  })

  const bottom = Math.max(ly, y + meta.length * 7) + 4
  return hairline(ctx, bottom, 0.3)
}

function drawIntro(ctx: Ctx, intro: string, y: number): number {
  const text = intro.trim()
  if (!text) return y
  y = ensureSpace(ctx, y, 16)
  return writeWrapped(ctx, text, y, { size: 9, color: C.muted, lineH: 4.1 }) + 6
}

function drawTotal(ctx: Ctx, total: number, y: number): number {
  const { doc, pageW, mR } = ctx
  y = ensureSpace(ctx, y, 12)
  y += 2
  doc.setFont(FONT, "bold")
  doc.setFontSize(9)
  doc.setTextColor(...C.muted)
  doc.text("TOTAL", pageW - mR - 70, y)
  doc.setFontSize(11)
  doc.setTextColor(...C.ink)
  doc.text(`PKR ${formatMoney(total)}`, pageW - mR, y, { align: "right" })
  return y + 10
}

function drawProjects(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  const projects = quote.projects.filter(
    (p) =>
      p.title.trim() ||
      (p.client || p.location || "").trim() ||
      p.summary.trim() ||
      (p.projectValue || "").trim() ||
      (p.capacityMw || "").trim() ||
      (p.completionDate || "").trim() ||
      p.imageUrls.length,
  )
  if (!projects.length) return y
  y = sectionHeader(ctx, "Our previous projects", y)
  const { doc } = ctx

  const tableLike = projects.some(
    (p) => (p.client || p.location || p.projectValue || p.capacityMw || p.completionDate || "").trim(),
  )

  if (tableLike) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Project", "Client", "Description", "Value (M)", "MW", "Completed"]],
      body: projects.map((p, i) => [
        String(i + 1),
        p.title.trim() || "—",
        (p.client || p.location || "").trim() || "—",
        p.summary.trim() || "—",
        (p.projectValue || "").trim() || "—",
        (p.capacityMw || "").trim() || "—",
        (p.completionDate || "").trim() || "—",
      ]),
      ...tableDefaults(ctx),
      styles: {
        ...tableDefaults(ctx).styles,
        fontSize: 6.5,
        cellPadding: { top: 2, bottom: 2, left: 1.4, right: 1.4 },
        valign: "top",
      },
      headStyles: {
        ...tableDefaults(ctx).headStyles,
        fontSize: 6.2,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1.4, right: 1.4 },
      },
      columnStyles: {
        0: { cellWidth: 7, halign: "center" },
        1: { cellWidth: 20 },
        2: { cellWidth: 26 },
        3: { cellWidth: 72 },
        4: { cellWidth: 16, halign: "right" },
        5: { cellWidth: 12, halign: "center" },
        6: { cellWidth: 25 },
      },
    })
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y) + 6
  } else {
    for (const project of projects) {
      y = ensureSpace(ctx, y, 14)
      if (project.title.trim()) {
        doc.setFont(FONT, "bold")
        doc.setFontSize(9)
        doc.setTextColor(...C.ink)
        doc.text(project.title.trim(), ctx.mL, y)
        y += 4.5
      }
      if (project.summary.trim()) {
        y = writeWrapped(ctx, project.summary.trim(), y, { size: 8, color: C.muted, lineH: 3.6 }) + 2
      }
    }
  }

  // Optional photos under the table (if any)
  for (const project of projects) {
    const urls = project.imageUrls.filter(Boolean).slice(0, 3)
    if (!urls.length) continue
    const imgW = (ctx.contentW - (urls.length - 1) * 3) / urls.length
    const h = 24
    y = ensureSpace(ctx, y, h + 6)
    let x = ctx.mL
    for (const url of urls) {
      const filePath = resolvePublicFile(url)
      const fmt = filePath ? imageFormatFromPath(filePath) : null
      if (!filePath || !fmt) continue
      try {
        const b64 = fs.readFileSync(filePath).toString("base64")
        const mime = fmt === "PNG" ? "image/png" : fmt === "WEBP" ? "image/webp" : "image/jpeg"
        doc.addImage(`data:${mime};base64,${b64}`, fmt, x, y, imgW, h)
        x += imgW + 3
      } catch {
        /* skip */
      }
    }
    y += h + 5
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
    const { doc } = ctx
    autoTable(doc, {
      startY: y,
      head: [["Sr.", "Product", "Brand", "Warranty"]],
      body: warranties.map((w, i) => [
        String(i + 1),
        w.productName.trim() || "—",
        w.heading.trim() || "—",
        w.plainText.trim() || "—",
      ]),
      ...tableDefaults(ctx),
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 95 },
        2: { cellWidth: 42 },
        3: { cellWidth: 33, halign: "center" },
      },
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
    const wrapped = doc.splitTextToSize(quoteText ? `"${quoteText}"` : "", contentW) as string[]
    y = ensureSpace(ctx, y, 10 + wrapped.length * 3.8)
    doc.setFont(FONT, "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...C.ink)
    let ty = y
    for (const line of wrapped) {
      doc.text(line, mL, ty)
      ty += 3.8
    }
    const attribution = [t.name.trim(), t.role.trim()].filter(Boolean).join(" · ")
    if (attribution) {
      ty += 1
      doc.setFont(FONT, "bold")
      doc.setFontSize(7.5)
      doc.setTextColor(...C.muted)
      doc.text(attribution, mL, ty)
      ty += 4
    }
    y = ty + 4
  }
  return y
}

function drawCustomSections(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  // Skip empty unit-generation placeholders
  const sections = quote.customSections.filter((s) => {
    const hasBody = s.bullets.some((b) => b.trim()) || (s.plainText || "").trim()
    return s.heading.trim() && hasBody
  })
  if (!sections.length) return y
  for (const s of sections as QuoteCustomSection[]) {
    y = sectionHeader(ctx, s.heading.trim() || "Additional details", y)
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
    y += 3
  }
  return y
}

function drawSignatures(ctx: Ctx, quote: ExtensiveQuotation, y: number): number {
  const { doc, mL, mR, pageW } = ctx
  y = ensureSpace(ctx, y, 26)
  y += 6
  doc.setDrawColor(...C.line)
  doc.setLineWidth(0.3)
  doc.line(mL, y, mL + 55, y)
  doc.line(pageW - mR - 55, y, pageW - mR, y)

  doc.setFont(FONT, "normal")
  doc.setFontSize(7)
  doc.setTextColor(...C.softMuted)
  doc.text("Client acceptance", mL, y + 4.5)
  doc.text("For Voltrix Batteries Pvt. Ltd", pageW - mR - 55, y + 4.5)

  if (quote.preparedBy?.trim()) {
    doc.setFont(FONT, "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(...C.ink)
    doc.text(quote.preparedBy.trim(), pageW - mR - 55, y + 10)
    doc.setFont(FONT, "normal")
    doc.setFontSize(7)
    doc.setTextColor(...C.muted)
    doc.text("Prepared by", pageW - mR - 55, y + 14.5)
  }
  return y + 20
}

function applyPageFooters(ctx: Ctx, quote: ExtensiveQuotation) {
  const { doc, pageW, pageH, mL, mR, branded } = ctx
  const pageCount = doc.getNumberOfPages()
  const base = branded ? "Voltrix Batteries Pvt. Ltd" : "Quotation"
  const custom = quote.footerText.trim()
  const shortFooter = custom.length > 0 && custom.length <= 60 ? custom : ""

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont(FONT, "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(...C.softMuted)
    doc.text(base, mL, pageH - 8)
    doc.text(`${i} / ${pageCount}`, pageW - mR, pageH - 8, { align: "right" })
    if (shortFooter) {
      doc.text(shortFooter, pageW / 2, pageH - 8, { align: "center" })
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
    const mL = 16
    const mR = 16
    const ctx: Ctx = {
      doc,
      pageW,
      pageH,
      mL,
      mR,
      contentW: pageW - mL - mR,
      topY: 16,
      footerReserve: 18,
      branded,
    }

    let y = drawHeader(ctx, quote)
    y = drawPartyBlock(ctx, quote, y)
    y = drawIntro(ctx, quote.introText, y)

    const tableBody = included.map((item, i) => [
      String(i + 1),
      item.itemName,
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
      ...tableDefaults(ctx),
      columnStyles: {
        0: { cellWidth: 9, halign: "center" },
        1: { cellWidth: 58 },
        2: { cellWidth: 34 },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 27, halign: "right", fontStyle: "bold" },
      },
    })

    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y) + 6
    y = drawTotal(ctx, total, y)
    y = drawSignatures(ctx, quote, y)

    y = drawProjects(ctx, quote, y)
    y = drawCustomSections(ctx, quote, y)
    y = drawWarranties(ctx, quote, y)
    y = drawTerms(ctx, quote, y)
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
