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

type Palette = {
  teal: [number, number, number]
  white: [number, number, number]
  dark: [number, number, number]
  gray: [number, number, number]
  line: [number, number, number]
  wash: [number, number, number]
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  need: number,
  pageH: number,
  topY: number,
): number {
  if (y + need > pageH - 18) {
    doc.addPage()
    return topY
  }
  return y
}

function drawSectionTitle(
  doc: jsPDF,
  title: string,
  y: number,
  mL: number,
  pageW: number,
  mR: number,
  colors: Palette,
): number {
  doc.setFont(FONT, "bold")
  doc.setFontSize(8)
  doc.setTextColor(...colors.dark)
  doc.text(title, mL, y)
  y += 4.5
  doc.setDrawColor(...colors.line)
  doc.setLineWidth(0.2)
  doc.line(mL, y - 2, pageW - mR, y - 2)
  return y
}

function drawPlainOrBullets(
  doc: jsPDF,
  opts: {
    bodyType: QuoteBodyType
    bullets: string[]
    plainText: string
    y: number
    mL: number
    pageW: number
    mR: number
    pageH: number
    topY: number
    colors: Palette
  },
): number {
  let { y } = opts
  const contentW = opts.pageW - opts.mL - opts.mR
  if (opts.bodyType === "plain") {
    const text = opts.plainText.trim()
    if (!text) return y
    doc.setFont(FONT, "normal")
    doc.setFontSize(7.2)
    doc.setTextColor(55, 60, 64)
    const lines = doc.splitTextToSize(text, contentW)
    for (let i = 0; i < lines.length; i++) {
      y = ensureSpace(doc, y, 5, opts.pageH, opts.topY)
      doc.text(lines[i], opts.mL, y)
      y += 3.3
    }
    return y + 1.5
  }

  const bullets = opts.bullets.map((b) => b.trim()).filter(Boolean)
  doc.setFont(FONT, "normal")
  doc.setFontSize(7.2)
  doc.setTextColor(55, 60, 64)
  for (const bullet of bullets) {
    y = ensureSpace(doc, y, 8, opts.pageH, opts.topY)
    const wrapped = doc.splitTextToSize(bullet, contentW - 6)
    doc.text("•", opts.mL, y)
    doc.text(wrapped, opts.mL + 4, y)
    y += wrapped.length * 3.3 + 1.1
  }
  return y + 1.5
}

function drawHeadingBlock(
  doc: jsPDF,
  heading: string,
  y: number,
  mL: number,
  pageW: number,
  mR: number,
  pageH: number,
  topY: number,
  colors: Palette,
  skipGenericTerms = false,
): number {
  const h = heading.trim()
  if (!h) return y
  if (skipGenericTerms && isGenericTermsHeading(h)) return y
  y = ensureSpace(doc, y, 10, pageH, topY)
  doc.setFont(FONT, "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(...colors.dark)
  const hLines = doc.splitTextToSize(h, pageW - mL - mR)
  doc.text(hLines, mL, y)
  return y + hLines.length * 3.4 + 1
}

function applyPageFooters(doc: jsPDF, quote: ExtensiveQuotation, branded: boolean, colors: Palette) {
  const pageCount = doc.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const mL = 12
  const mR = 12
  const base = branded
    ? "Voltrix Batteries (Pvt) Ltd  ·  Computer-generated quotation"
    : "Computer-generated quotation"
  const custom = quote.footerText.trim()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...colors.line)
    doc.setLineWidth(0.25)
    doc.line(mL, pageH - (custom ? 14 : 11), pageW - mR, pageH - (custom ? 14 : 11))
    doc.setFont(FONT, "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(...colors.gray)
    doc.text(base, pageW / 2, pageH - (custom ? 10 : 7), { align: "center" })
    if (custom) {
      const clipped = doc.splitTextToSize(custom, pageW - mL - mR)
      doc.setFontSize(6)
      doc.text(clipped.slice(0, 2), pageW / 2, pageH - 6, { align: "center" })
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
    const mL = 12
    const mR = 12
    const colors: Palette = {
      teal: [31, 172, 166],
      white: [255, 255, 255],
      dark: [28, 32, 36],
      gray: [90, 96, 100],
      line: [210, 218, 218],
      wash: [245, 249, 249],
    }
    const topY = branded ? 16 : 14

    let y = 0

    if (branded) {
      doc.setFillColor(...colors.teal)
      doc.rect(0, 0, pageW, 26, "F")
      try {
        const logoPath = path.join(process.cwd(), "public", "logo.png")
        if (fs.existsSync(logoPath)) {
          const logoBase64 = fs.readFileSync(logoPath).toString("base64")
          doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", mL, 4.5, 17, 17)
        }
      } catch {}
      doc.setTextColor(...colors.white)
      doc.setFont(FONT, "bold")
      doc.setFontSize(11)
      doc.text("VOLTRIX BATTERIES", mL + 20, 10)
      doc.setFont(FONT, "normal")
      doc.setFontSize(6.5)
      doc.text("Plot 73, Street 14, I-9/2, Islamabad  ·  051-8731661  ·  +92 303 4927779", mL + 20, 15.5)
      doc.text("sale@voltrixbatteries.com  ·  www.voltrixbatteries.com", mL + 20, 19.5)
      doc.setFont(FONT, "bold")
      doc.setFontSize(13)
      doc.text("QUOTATION", pageW - mR, 11, { align: "right" })
      doc.setFont(FONT, "normal")
      doc.setFontSize(8)
      doc.text(quote.quotationNumber, pageW - mR, 17, { align: "right" })
      y = 32
    } else {
      doc.setFont(FONT, "bold")
      doc.setFontSize(13)
      doc.setTextColor(...colors.dark)
      doc.text("QUOTATION", mL, 14)
      doc.setFont(FONT, "normal")
      doc.setFontSize(8)
      doc.setTextColor(...colors.gray)
      doc.text(quote.quotationNumber, pageW - mR, 14, { align: "right" })
      doc.setDrawColor(...colors.teal)
      doc.setLineWidth(0.7)
      doc.line(mL, 17.5, pageW - mR, 17.5)
      y = 22
    }

    const prepared = [quote.recipientCompany, quote.recipientAddress].filter(Boolean).join(" · ")
    doc.setFillColor(...colors.wash)
    doc.roundedRect(mL, y, pageW - mL - mR, prepared ? 16 : 11, 1.5, 1.5, "F")
    const meta = [
      { label: "TO", value: quote.recipientName || "—" },
      { label: "DATE", value: formatDate(quote.quoteDate) },
      { label: "VALID UNTIL", value: quote.validUntil ? formatDate(quote.validUntil) : "—" },
    ]
    const colW = (pageW - mL - mR - 6) / 3
    meta.forEach((m, i) => {
      const x = mL + 3 + i * colW
      doc.setFont(FONT, "bold")
      doc.setFontSize(6)
      doc.setTextColor(...colors.gray)
      doc.text(m.label, x, y + 4)
      doc.setFont(FONT, "normal")
      doc.setFontSize(8)
      doc.setTextColor(...colors.dark)
      const clipped = doc.splitTextToSize(m.value, colW - 2)
      doc.text(clipped[0], x, y + 8.5)
    })
    y += 12
    if (prepared) {
      doc.setFont(FONT, "normal")
      doc.setFontSize(7)
      doc.setTextColor(...colors.gray)
      const prep = doc.splitTextToSize(prepared, pageW - mL - mR - 8)
      doc.text(prep.slice(0, 1), mL + 3, y + 2.5)
      y += 7
    } else {
      y += 2
    }

    if (quote.introText.trim()) {
      y = ensureSpace(doc, y, 16, pageH, topY)
      y = drawSectionTitle(doc, "Proposal", y, mL, pageW, mR, colors)
      doc.setFont(FONT, "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(55, 60, 64)
      const introLines = doc.splitTextToSize(quote.introText.trim(), pageW - mL - mR)
      for (const line of introLines) {
        y = ensureSpace(doc, y, 5, pageH, topY)
        doc.text(line, mL, y)
        y += 3.4
      }
      y += 4
    }

    const tableBody = included.map((item, i) => [
      String(i + 1),
      item.itemName,
      item.supplier,
      `${item.qty} ${item.unit}`.trim(),
      formatMoney(item.rate),
      formatMoney(item.qty * item.rate),
    ])

    autoTable(doc, {
      startY: y,
      head: [["#", "Item", "Supplier", "Qty", "Rate (PKR)", "Amount (PKR)"]],
      body: tableBody.length ? tableBody : [["", "No items", "", "", "", ""]],
      margin: { left: mL, right: mR, bottom: 18 },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.6, bottom: 1.6, left: 1.6, right: 1.6 },
        textColor: colors.dark,
        lineColor: colors.line,
        lineWidth: 0.15,
        font: FONT,
        minCellHeight: 6,
      },
      headStyles: {
        fillColor: branded ? colors.teal : [45, 52, 56],
        textColor: colors.white,
        fontStyle: "bold",
        fontSize: 7,
        font: FONT,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1.6, right: 1.6 },
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 52 },
        2: { cellWidth: 38 },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: colors.wash },
      tableLineColor: colors.line,
      tableLineWidth: 0.15,
    })

    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y) + 4

    const totW = 62
    const totX = pageW - mR - totW
    y = ensureSpace(doc, y, 14, pageH, topY)
    doc.setFillColor(...(branded ? colors.teal : colors.dark))
    doc.roundedRect(totX, y, totW, 8, 1.2, 1.2, "F")
    doc.setFont(FONT, "bold")
    doc.setFontSize(8)
    doc.setTextColor(...colors.white)
    doc.text("Total", totX + 3, y + 5.4)
    doc.text(`PKR ${formatMoney(total)}`, totX + totW - 3, y + 5.4, { align: "right" })
    y += 12

    const projects = quote.projects.filter(
      (p) => p.title.trim() || p.summary.trim() || p.imageUrls.length,
    )
    if (projects.length) {
      y = ensureSpace(doc, y, 20, pageH, topY)
      y = drawSectionTitle(doc, "Recent projects", y, mL, pageW, mR, colors)
      for (const project of projects) {
        y = ensureSpace(doc, y, 24, pageH, topY)
        if (project.title.trim()) {
          doc.setFont(FONT, "bold")
          doc.setFontSize(8)
          doc.setTextColor(...colors.dark)
          doc.text(project.title.trim(), mL, y)
          y += 4
        }
        if (project.location.trim()) {
          doc.setFont(FONT, "normal")
          doc.setFontSize(7)
          doc.setTextColor(...colors.gray)
          doc.text(project.location.trim(), mL, y)
          y += 3.5
        }
        if (project.summary.trim()) {
          doc.setFont(FONT, "normal")
          doc.setFontSize(7.2)
          doc.setTextColor(55, 60, 64)
          const sumLines = doc.splitTextToSize(project.summary.trim(), pageW - mL - mR)
          for (const line of sumLines) {
            y = ensureSpace(doc, y, 5, pageH, topY)
            doc.text(line, mL, y)
            y += 3.3
          }
          y += 1
        }
        const urls = project.imageUrls.filter(Boolean).slice(0, 6)
        if (urls.length) {
          const imgW = 42
          const imgH = 28
          const gap = 3
          let x = mL
          for (const url of urls) {
            const filePath = resolvePublicFile(url)
            const fmt = filePath ? imageFormatFromPath(filePath) : null
            if (!filePath || !fmt) continue
            if (x + imgW > pageW - mR) {
              x = mL
              y += imgH + gap
            }
            y = ensureSpace(doc, y, imgH + 4, pageH, topY)
            try {
              const b64 = fs.readFileSync(filePath).toString("base64")
              const mime = fmt === "PNG" ? "image/png" : fmt === "WEBP" ? "image/webp" : "image/jpeg"
              doc.addImage(`data:${mime};base64,${b64}`, fmt, x, y, imgW, imgH)
              x += imgW + gap
            } catch {
              // skip broken image
            }
          }
          y += imgH + 5
        } else {
          y += 3
        }
      }
    }

    const warranties = quote.warranties.filter(
      (w) => w.productName.trim() || w.heading.trim() || w.bullets.length || w.plainText.trim(),
    )
    if (warranties.length) {
      y = ensureSpace(doc, y, 18, pageH, topY)
      y = drawSectionTitle(doc, "Product warranties", y, mL, pageW, mR, colors)
      for (const w of warranties as QuoteWarrantySection[]) {
        const title = [w.productName.trim(), w.heading.trim()].filter(Boolean).join(" — ")
        y = drawHeadingBlock(doc, title, y, mL, pageW, mR, pageH, topY, colors)
        y = drawPlainOrBullets(doc, {
          bodyType: w.bodyType || "bullets",
          bullets: w.bullets,
          plainText: w.plainText || "",
          y,
          mL,
          pageW,
          mR,
          pageH,
          topY,
          colors,
        })
      }
    }

    const testimonials = quote.testimonials.filter((t) => t.quote.trim() || t.name.trim())
    if (testimonials.length) {
      y = ensureSpace(doc, y, 18, pageH, topY)
      y = drawSectionTitle(doc, "Client testimonials", y, mL, pageW, mR, colors)
      for (const t of testimonials) {
        y = ensureSpace(doc, y, 16, pageH, topY)
        doc.setFont(FONT, "italic")
        doc.setFontSize(7.2)
        doc.setTextColor(55, 60, 64)
        const qLines = doc.splitTextToSize(`"${t.quote.trim()}"`, pageW - mL - mR - 2)
        for (const line of qLines) {
          y = ensureSpace(doc, y, 5, pageH, topY)
          doc.text(line, mL, y)
          y += 3.3
        }
        doc.setFont(FONT, "normal")
        doc.setFontSize(7)
        doc.setTextColor(...colors.gray)
        const attribution = [t.name.trim(), t.role.trim()].filter(Boolean).join(", ")
        if (attribution) {
          y = ensureSpace(doc, y, 5, pageH, topY)
          doc.text(`— ${attribution}`, mL, y)
          y += 5
        } else {
          y += 2
        }
      }
    }

    const customSections = quote.customSections.filter(
      (s) => s.heading.trim() || s.bullets.length || s.plainText.trim(),
    )
    if (customSections.length) {
      y = ensureSpace(doc, y, 18, pageH, topY)
      y = drawSectionTitle(doc, "Additional details", y, mL, pageW, mR, colors)
      for (const s of customSections as QuoteCustomSection[]) {
        y = drawHeadingBlock(doc, s.heading, y, mL, pageW, mR, pageH, topY, colors)
        y = drawPlainOrBullets(doc, {
          bodyType: s.bodyType || "bullets",
          bullets: s.bullets,
          plainText: s.plainText || "",
          y,
          mL,
          pageW,
          mR,
          pageH,
          topY,
          colors,
        })
      }
    }

    const terms = quote.terms.filter(
      (t) => t.heading.trim() || t.bullets.some((b) => b.trim()) || (t.plainText || "").trim(),
    )
    if (terms.length) {
      y = ensureSpace(doc, y, 18, pageH, topY)
      y = drawSectionTitle(doc, "Terms & conditions", y, mL, pageW, mR, colors)
      for (const section of terms as QuoteTermSection[]) {
        y = drawHeadingBlock(doc, section.heading, y, mL, pageW, mR, pageH, topY, colors, true)
        y = drawPlainOrBullets(doc, {
          bodyType: section.bodyType || "bullets",
          bullets: section.bullets,
          plainText: section.plainText || "",
          y,
          mL,
          pageW,
          mR,
          pageH,
          topY,
          colors,
        })
      }
    }

    applyPageFooters(doc, quote, branded, colors)

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
