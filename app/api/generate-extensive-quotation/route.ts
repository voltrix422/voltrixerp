import { NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import path from "path"
import fs from "fs"
import {
  includedQuoteTotal,
  rowToExtensiveQuotation,
  type ExtensiveQuotation,
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
    const teal: [number, number, number] = [31, 172, 166]
    const white: [number, number, number] = [255, 255, 255]
    const dark: [number, number, number] = [28, 32, 36]
    const gray: [number, number, number] = [90, 96, 100]
    const line: [number, number, number] = [210, 218, 218]
    const wash: [number, number, number] = [245, 249, 249]

    let y = 0

    if (branded) {
      doc.setFillColor(...teal)
      doc.rect(0, 0, pageW, 26, "F")
      try {
        const logoPath = path.join(process.cwd(), "public", "logo.png")
        if (fs.existsSync(logoPath)) {
          const logoBase64 = fs.readFileSync(logoPath).toString("base64")
          doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", mL, 4.5, 17, 17)
        }
      } catch {}
      doc.setTextColor(...white)
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
      doc.setTextColor(...dark)
      doc.text("QUOTATION", mL, 14)
      doc.setFont(FONT, "normal")
      doc.setFontSize(8)
      doc.setTextColor(...gray)
      doc.text(quote.quotationNumber, pageW - mR, 14, { align: "right" })
      doc.setDrawColor(...teal)
      doc.setLineWidth(0.7)
      doc.line(mL, 17.5, pageW - mR, 17.5)
      y = 22
    }

    const prepared = [quote.recipientCompany, quote.recipientAddress].filter(Boolean).join(" · ")
    doc.setFillColor(...wash)
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
      doc.setTextColor(...gray)
      doc.text(m.label, x, y + 4)
      doc.setFont(FONT, "normal")
      doc.setFontSize(8)
      doc.setTextColor(...dark)
      const clipped = doc.splitTextToSize(m.value, colW - 2)
      doc.text(clipped[0], x, y + 8.5)
    })
    y += 12
    if (prepared) {
      doc.setFont(FONT, "normal")
      doc.setFontSize(7)
      doc.setTextColor(...gray)
      const prep = doc.splitTextToSize(prepared, pageW - mL - mR - 8)
      doc.text(prep.slice(0, 1), mL + 3, y + 2.5)
      y += 7
    } else {
      y += 2
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
      margin: { left: mL, right: mR, bottom: 16 },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.6, bottom: 1.6, left: 1.6, right: 1.6 },
        textColor: dark,
        lineColor: line,
        lineWidth: 0.15,
        font: FONT,
        minCellHeight: 6,
      },
      headStyles: {
        fillColor: branded ? teal : [45, 52, 56],
        textColor: white,
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
      alternateRowStyles: { fillColor: wash },
      tableLineColor: line,
      tableLineWidth: 0.15,
    })

    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y) + 4

    const totW = 62
    const totX = pageW - mR - totW
    if (y > pageH - 28) {
      doc.addPage()
      y = 16
    }
    doc.setFillColor(...(branded ? teal : dark))
    doc.roundedRect(totX, y, totW, 8, 1.2, 1.2, "F")
    doc.setFont(FONT, "bold")
    doc.setFontSize(8)
    doc.setTextColor(...white)
    doc.text("Total", totX + 3, y + 5.4)
    doc.text(`PKR ${formatMoney(total)}`, totX + totW - 3, y + 5.4, { align: "right" })
    y += 12

    const terms = quote.terms.filter((t) => t.heading.trim() || t.bullets.some((b) => b.trim()))
    if (terms.length) {
      if (y > pageH - 32) {
        doc.addPage()
        y = 16
      }
      doc.setFont(FONT, "bold")
      doc.setFontSize(8)
      doc.setTextColor(...dark)
      doc.text("Terms & conditions", mL, y)
      y += 4.5
      doc.setDrawColor(...line)
      doc.setLineWidth(0.2)
      doc.line(mL, y - 2, pageW - mR, y - 2)

      for (const section of terms) {
        const heading = section.heading.trim()
        const showHeading = heading && !isGenericTermsHeading(heading)
        const bullets = section.bullets.map((b) => b.trim()).filter(Boolean)
        if (!showHeading && bullets.length === 0) continue
        if (y > pageH - 24) {
          doc.addPage()
          y = 16
        }
        if (showHeading) {
          doc.setFont(FONT, "bold")
          doc.setFontSize(7.5)
          doc.setTextColor(...dark)
          const hLines = doc.splitTextToSize(heading, pageW - mL - mR)
          doc.text(hLines, mL, y)
          y += hLines.length * 3.4 + 1
        }
        doc.setFont(FONT, "normal")
        doc.setFontSize(7.2)
        doc.setTextColor(55, 60, 64)
        for (const bullet of bullets) {
          if (y > pageH - 18) {
            doc.addPage()
            y = 16
          }
          const wrapped = doc.splitTextToSize(bullet, pageW - mL - mR - 6)
          doc.text("•", mL, y)
          doc.text(wrapped, mL + 4, y)
          y += wrapped.length * 3.3 + 1.1
        }
        y += 1.5
      }
    }

    doc.setDrawColor(...line)
    doc.setLineWidth(0.25)
    doc.line(mL, pageH - 11, pageW - mR, pageH - 11)
    doc.setFont(FONT, "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(...gray)
    const foot = branded
      ? "Voltrix Batteries (Pvt) Ltd  ·  Computer-generated quotation"
      : "Computer-generated quotation"
    doc.text(foot, pageW / 2, pageH - 7, { align: "center" })

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
