import { NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import path from "path"
import fs from "fs"
import type { Quotation } from "@/lib/quotations"

function loadFont(filename: string): string {
  try {
    const p = path.join(process.cwd(), "public", filename)
    if (fs.existsSync(p)) return fs.readFileSync(p).toString("base64")
  } catch {}
  return ""
}
const geistRegB64  = loadFont("Geist-Regular.ttf")
const geistBoldB64 = loadFont("Geist-Bold.ttf")

function registerGeist(doc: jsPDF) {
  if (geistRegB64)  { doc.addFileToVFS("Geist-Regular.ttf", geistRegB64);  doc.addFont("Geist-Regular.ttf", "Geist", "normal") }
  if (geistBoldB64) { doc.addFileToVFS("Geist-Bold.ttf",    geistBoldB64); doc.addFont("Geist-Bold.ttf",    "Geist", "bold")   }
}
const FONT = geistRegB64 ? "Geist" : "helvetica"

export async function POST(req: NextRequest) {
  try {
    const quotation: Quotation = await req.json()
    const taxAmount = Number(quotation.tax || 0)
    const hasTax = Math.abs(taxAmount) > 0.004

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    registerGeist(doc)
    doc.setFont(FONT, "normal")
    const pageW = doc.internal.pageSize.getWidth()   // 210
    const pageH = doc.internal.pageSize.getHeight()  // 297
    const mL = 14
    const mR = 14

    // ── Colors ────────────────────────────────────────────────────
    const teal     = [31, 172, 166] as [number,number,number]
    const darkTeal = [18, 120, 116] as [number,number,number]
    const white     = [255, 255, 255] as [number,number,number]
    const dark      = [30, 30, 30] as [number,number,number]
    const gray      = [100, 100, 100] as [number,number,number]
    const lightBg   = [247, 250, 250] as [number,number,number]
    const border    = [220, 230, 229] as [number,number,number]

    // ── Header band ───────────────────────────────────────────────
    doc.setFillColor(...teal)
    doc.rect(0, 0, pageW, 42, "F")

    // Logo
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png")
      if (fs.existsSync(logoPath)) {
        const logoData = fs.readFileSync(logoPath)
        const logoBase64 = logoData.toString("base64")
        doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", mL, 6, 28, 28)
      }
    } catch {}

    // Company name & address (right of logo)
    doc.setTextColor(...white)
    doc.setFont(FONT, "bold")
    doc.setFontSize(15)
    doc.text("VOLTRIX BATTERIES", mL + 32, 14)

    doc.setFont(FONT, "normal")
    doc.setFontSize(7.5)
    doc.text("Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", mL + 32, 20)
    doc.text("Phone: 051-8731661  |  Mobile: +92 303 4927779", mL + 32, 25)
    doc.text("Email: sale@voltrixbatteries.com  |  www.voltrixbatteries.com", mL + 32, 30)

    // QUOTATION label (top-right)
    doc.setFont(FONT, "bold")
    doc.setFontSize(22)
    doc.setTextColor(...white)
    doc.text("QUOTATION", pageW - mR, 20, { align: "right" })
    doc.setFontSize(9)
    doc.setFont(FONT, "normal")
    doc.text(quotation.quotationNumber, pageW - mR, 27, { align: "right" })

    // ── Meta info band ────────────────────────────────────────────
    doc.setFillColor(...darkTeal)
    doc.rect(0, 42, pageW, 16, "F")

    const metaItems = [
      { label: "CLIENT", value: quotation.clientName },
      { label: "DATE", value: new Date(quotation.createdAt).toLocaleDateString("en-PK") },
      ...(quotation.validUntil ? [{ label: "VALID UNTIL", value: new Date(quotation.validUntil).toLocaleDateString("en-PK") }] : []),
      { label: "STATUS", value: quotation.status.toUpperCase() },
    ]
    const colW = (pageW - mL - mR) / metaItems.length
    metaItems.forEach((m, i) => {
      const x = mL + i * colW
      doc.setFont(FONT, "bold")
      doc.setFontSize(7)
      doc.setTextColor(180, 230, 228)
      doc.text(m.label, x, 48)
      doc.setFont(FONT, "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...white)
      doc.text(m.value, x, 54)
    })

    // ── Body start ────────────────────────────────────────────────
    let y = 66
    doc.setTextColor(...dark)

    // Delivery address + notes side by side
    const hasAddr = !!quotation.deliveryAddress
    const hasNotes = !!quotation.notes

    if (hasAddr || hasNotes) {
      const boxH = 18
      if (hasAddr) {
        doc.setFillColor(...lightBg)
        doc.roundedRect(mL, y, hasNotes ? 88 : pageW - mL - mR, boxH, 2, 2, "F")
        doc.setDrawColor(...border)
        doc.setLineWidth(0.3)
        doc.roundedRect(mL, y, hasNotes ? 88 : pageW - mL - mR, boxH, 2, 2, "S")
        doc.setFont(FONT, "bold")
        doc.setFontSize(7)
        doc.setTextColor(...gray)
        doc.text("DELIVERY ADDRESS", mL + 3, y + 5)
        doc.setFont(FONT, "normal")
        doc.setFontSize(8.5)
        doc.setTextColor(...dark)
        const addrLines = doc.splitTextToSize(quotation.deliveryAddress, 82)
        doc.text(addrLines, mL + 3, y + 10)
      }
      if (hasNotes) {
        const nx = hasAddr ? mL + 92 : mL
        const nw = hasAddr ? pageW - mL - mR - 92 : pageW - mL - mR
        doc.setFillColor(...lightBg)
        doc.roundedRect(nx, y, nw, boxH, 2, 2, "F")
        doc.setDrawColor(...border)
        doc.roundedRect(nx, y, nw, boxH, 2, 2, "S")
        doc.setFont(FONT, "bold")
        doc.setFontSize(7)
        doc.setTextColor(...gray)
        doc.text("NOTES", nx + 3, y + 5)
        doc.setFont(FONT, "normal")
        doc.setFontSize(8)
        doc.setTextColor(...dark)
        const noteLines = doc.splitTextToSize(quotation.notes, nw - 6)
        doc.text(noteLines.slice(0, 2), nx + 3, y + 10)
      }
      y += boxH + 6
    }

    // ── Items table ───────────────────────────────────────────────
    const tableBody = quotation.items.map((item, i) => [
      `${i + 1}`,
      item.description,
      item.qty.toString(),
      item.unit,
      `PKR ${item.unitPrice.toLocaleString("en-PK")}`,
      `PKR ${(item.qty * item.unitPrice).toLocaleString("en-PK")}`,
    ])

    autoTable(doc, {
      startY: y,
      head: [["#", "DESCRIPTION", "QTY", "UNIT", "UNIT PRICE", "TOTAL"]],
      body: tableBody,
      margin: { left: mL, right: mR },
      styles: { fontSize: 8.5, cellPadding: 3, textColor: dark, lineColor: border, lineWidth: 0.2, font: FONT },
      headStyles: { fillColor: teal, textColor: white, fontStyle: "bold", fontSize: 8, halign: "left", font: FONT },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 32, halign: "right" },
        5: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [250, 253, 253] },
      tableLineColor: border,
      tableLineWidth: 0.2,
    })

    y = (doc as any).lastAutoTable.finalY + 6

    // ── Totals block ──────────────────────────────────────────────
    const totW = 80
    const totX = pageW - mR - totW

    // Background
    doc.setFillColor(...lightBg)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.3)

    const rows: { label: string; value: string; bold?: boolean; color?: [number,number,number] }[] = []
    rows.push({ label: "Subtotal", value: `PKR ${quotation.subtotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}` })
    if ((quotation.discountValue || 0) > 0)
      rows.push({ label: `Discount${quotation.discountIsPercentage ? ` (${quotation.discount}%)` : ""}`, value: `-PKR ${(quotation.discountValue || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, color: [200, 50, 50] })
    if (hasTax)
      rows.push({ label: `Tax (${quotation.taxPercent}%)`, value: `PKR ${taxAmount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}` })
    if (quotation.transportCost > 0)
      rows.push({ label: quotation.transportLabel, value: `PKR ${(quotation.transportCostValue || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}` })
    if (quotation.otherCost > 0)
      rows.push({ label: quotation.otherCostLabel, value: `PKR ${(quotation.otherCostValue || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}` })

    const rowH = 7
    const totalsH = rows.length * rowH + 14
    doc.roundedRect(totX, y, totW, totalsH, 2, 2, "FD")

    let ry = y + 6
    rows.forEach(row => {
      doc.setFont(FONT, "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...(row.color || gray))
      doc.text(row.label, totX + 4, ry)
      doc.setTextColor(...(row.color || dark))
      doc.text(row.value, totX + totW - 4, ry, { align: "right" })
      ry += rowH
    })

    // Divider
    doc.setDrawColor(...border)
    doc.setLineWidth(0.4)
    doc.line(totX + 4, ry - 1, totX + totW - 4, ry - 1)
    ry += 3

    // Total row
    doc.setFillColor(...teal)
    doc.roundedRect(totX, ry - 4, totW, 12, 2, 2, "F")
    doc.setFont(FONT, "bold")
    doc.setFontSize(10)
    doc.setTextColor(...white)
    doc.text("TOTAL", totX + 4, ry + 4)
    doc.text(`PKR ${quotation.total.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, totX + totW - 4, ry + 4, { align: "right" })

    // ── Footer ────────────────────────────────────────────────────
    const footerY = pageH - 18
    doc.setFillColor(...teal)
    doc.rect(0, footerY, pageW, 18, "F")

    doc.setFont(FONT, "bold")
    doc.setFontSize(9)
    doc.setTextColor(...white)
    doc.text("Thank you for your business!", pageW / 2, footerY + 7, { align: "center" })

    doc.setFont(FONT, "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(200, 235, 234)
    doc.text("This is a computer-generated quotation. No signature required.", pageW / 2, footerY + 13, { align: "center" })

    // ── Output ────────────────────────────────────────────────────
    const pdfBlob = doc.output("arraybuffer")

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Quotation-${quotation.quotationNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error generating quotation:", error)
    return NextResponse.json({ error: "Failed to generate quotation" }, { status: 500 })
  }
}
