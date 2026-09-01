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
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-PK")
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
    const teal: [number, number, number] = [31, 172, 166]
    const darkTeal: [number, number, number] = [18, 120, 116]
    const white: [number, number, number] = [255, 255, 255]
    const dark: [number, number, number] = [30, 30, 30]
    const gray: [number, number, number] = [100, 100, 100]
    const lightBg: [number, number, number] = [247, 250, 250]
    const border: [number, number, number] = [220, 230, 229]

    if (branded) {
      doc.setFillColor(...teal)
      doc.rect(0, 0, pageW, 42, "F")
      try {
        const logoPath = path.join(process.cwd(), "public", "logo.png")
        if (fs.existsSync(logoPath)) {
          const logoBase64 = fs.readFileSync(logoPath).toString("base64")
          doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", mL, 6, 28, 28)
        }
      } catch {}
      doc.setTextColor(...white)
      doc.setFont(FONT, "bold")
      doc.setFontSize(15)
      doc.text("VOLTRIX BATTERIES", mL + 32, 14)
      doc.setFont(FONT, "normal")
      doc.setFontSize(7.5)
      doc.text("Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", mL + 32, 20)
      doc.text("Phone: 051-8731661  |  Mobile: +92 303 4927779", mL + 32, 25)
      doc.text("Email: sale@voltrixbatteries.com  |  www.voltrixbatteries.com", mL + 32, 30)
      doc.setFont(FONT, "bold")
      doc.setFontSize(22)
      doc.text("QUOTATION", pageW - mR, 20, { align: "right" })
      doc.setFontSize(9)
      doc.setFont(FONT, "normal")
      doc.text(quote.quotationNumber, pageW - mR, 27, { align: "right" })

      doc.setFillColor(...darkTeal)
      doc.rect(0, 42, pageW, 16, "F")
    } else {
      doc.setFont(FONT, "bold")
      doc.setFontSize(22)
      doc.setTextColor(...dark)
      doc.text("QUOTATION", mL, 18)
      doc.setFont(FONT, "normal")
      doc.setFontSize(10)
      doc.setTextColor(...gray)
      doc.text(quote.quotationNumber, pageW - mR, 18, { align: "right" })
      doc.setDrawColor(...border)
      doc.setLineWidth(0.4)
      doc.line(mL, 24, pageW - mR, 24)
    }

    const metaY = branded ? 48 : 32
    const metaItems = [
      { label: "TO", value: quote.recipientName },
      { label: "DATE", value: formatDate(quote.quoteDate) },
      ...(quote.validUntil ? [{ label: "VALID UNTIL", value: formatDate(quote.validUntil) }] : []),
    ]
    const colW = (pageW - mL - mR) / metaItems.length
    metaItems.forEach((m, i) => {
      const x = mL + i * colW
      doc.setFont(FONT, "bold")
      doc.setFontSize(7)
      doc.setTextColor(branded ? 180 : 120, branded ? 230 : 120, branded ? 228 : 120)
      if (!branded) doc.setTextColor(...gray)
      doc.text(m.label, x, metaY)
      doc.setFont(FONT, "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...(branded ? white : dark))
      doc.text(m.value || "—", x, metaY + 6)
    })

    let y = branded ? 66 : 46
    if (quote.recipientCompany || quote.recipientAddress) {
      doc.setFillColor(...lightBg)
      doc.roundedRect(mL, y, pageW - mL - mR, 16, 2, 2, "F")
      doc.setFont(FONT, "bold")
      doc.setFontSize(7)
      doc.setTextColor(...gray)
      doc.text("PREPARED FOR", mL + 3, y + 5)
      doc.setFont(FONT, "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...dark)
      const who = [quote.recipientCompany, quote.recipientAddress].filter(Boolean).join("  ·  ")
      const lines = doc.splitTextToSize(who, pageW - mL - mR - 8)
      doc.text(lines.slice(0, 2), mL + 3, y + 10)
      y += 20
    }

    const tableBody = included.map((item, i) => [
      `${i + 1}`,
      item.itemName,
      item.supplier,
      item.qty.toString(),
      item.unit,
      `PKR ${item.rate.toLocaleString("en-PK")}`,
      `PKR ${(item.qty * item.rate).toLocaleString("en-PK")}`,
    ])

    autoTable(doc, {
      startY: y,
      head: [["#", "ITEM", "SUPPLIER", "QTY", "UNIT", "RATE", "AMOUNT"]],
      body: tableBody.length ? tableBody : [["—", "No items included", "", "", "", "", ""]],
      margin: { left: mL, right: mR, bottom: 24 },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: dark, lineColor: border, lineWidth: 0.2, font: FONT },
      headStyles: {
        fillColor: branded ? teal : [50, 50, 50],
        textColor: white,
        fontStyle: "bold",
        fontSize: 7.5,
        font: FONT,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 42 },
        2: { cellWidth: 32 },
        3: { cellWidth: 14, halign: "center" },
        4: { cellWidth: 16, halign: "center" },
        5: { cellWidth: 30, halign: "right" },
        6: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [250, 253, 253] },
    })

    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y) + 8

    const totW = 80
    const totX = pageW - mR - totW
    if (y > pageH - 40) {
      doc.addPage()
      y = 20
    }
    doc.setFillColor(...(branded ? teal : dark))
    doc.roundedRect(totX, y, totW, 10, 2, 2, "F")
    doc.setFont(FONT, "bold")
    doc.setFontSize(9)
    doc.setTextColor(...white)
    doc.text("TOTAL", totX + 4, y + 7)
    doc.text(`PKR ${total.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, totX + totW - 4, y + 7, {
      align: "right",
    })
    y += 16

    if (quote.notes.trim()) {
      if (y > pageH - 40) {
        doc.addPage()
        y = 20
      }
      doc.setFont(FONT, "bold")
      doc.setFontSize(8)
      doc.setTextColor(...gray)
      doc.text("NOTES", mL, y)
      y += 5
      doc.setFont(FONT, "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...dark)
      const noteLines = doc.splitTextToSize(quote.notes.trim(), pageW - mL - mR)
      doc.text(noteLines, mL, y)
      y += noteLines.length * 4 + 6
    }

    const terms = quote.terms.filter((t) => t.heading.trim() || t.bullets.some((b) => b.trim()))
    if (terms.length) {
      if (y > pageH - 40) {
        doc.addPage()
        y = 20
      }
      doc.setFont(FONT, "bold")
      doc.setFontSize(10)
      doc.setTextColor(...dark)
      doc.text("Terms & conditions", mL, y)
      y += 7
      for (const section of terms) {
        if (y > pageH - 28) {
          doc.addPage()
          y = 20
        }
        if (section.heading.trim()) {
          doc.setFont(FONT, "bold")
          doc.setFontSize(8.5)
          doc.setTextColor(...dark)
          doc.text(section.heading.trim(), mL, y)
          y += 5
        }
        doc.setFont(FONT, "normal")
        doc.setFontSize(8)
        doc.setTextColor(50, 50, 50)
        for (const bullet of section.bullets.filter((b) => b.trim())) {
          if (y > pageH - 24) {
            doc.addPage()
            y = 20
          }
          const wrapped = doc.splitTextToSize(`•  ${bullet.trim()}`, pageW - mL - mR - 4)
          doc.text(wrapped, mL + 2, y)
          y += wrapped.length * 4 + 1.5
        }
        y += 3
      }
    }

    const footerY = pageH - 16
    if (branded) {
      doc.setFillColor(...teal)
      doc.rect(0, footerY, pageW, 16, "F")
      doc.setFont(FONT, "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(...white)
      doc.text("This is a computer-generated quotation.", pageW / 2, footerY + 9, { align: "center" })
    } else {
      doc.setDrawColor(...border)
      doc.line(mL, footerY, pageW - mR, footerY)
      doc.setFont(FONT, "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(...gray)
      doc.text("This is a computer-generated quotation.", pageW / 2, footerY + 8, { align: "center" })
    }

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
