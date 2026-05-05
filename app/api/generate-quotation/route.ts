import { NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"
import type { Quotation } from "@/lib/quotations"

export async function POST(req: NextRequest) {
  try {
    const quotation: Quotation = await req.json()

    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginL = 15
    const marginR = 15

    // Header - Company Info
    doc.setFillColor(20, 172, 166)
    doc.rect(0, 0, pageW, 35, "F")
    
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text("VOLTRIX BATTERIES", marginL, 15)
    
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text("Office # 2, 2nd Floor, Anum Estate, Main Peshawar Road, Rawalpindi", marginL, 22)
    doc.text("+92 303 4927779", marginL, 27)

    // "QUOTATION" label
    doc.setFont("helvetica", "bold")
    doc.setFontSize(22)
    doc.text("QUOTATION", pageW - marginR, 22, { align: "right" })

    // Meta row (teal-dark band)
    doc.setFillColor(20, 143, 139)
    doc.rect(0, 38, pageW, 18, "F")
    
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)

    // Quotation #
    doc.text("QUOTATION #", marginL, 44)
    doc.setFont("helvetica", "normal")
    doc.text(quotation.quotationNumber, marginL, 49)

    // Client
    doc.setFont("helvetica", "bold")
    doc.text("CLIENT", marginL + 50, 44)
    doc.setFont("helvetica", "normal")
    doc.text(quotation.clientName, marginL + 50, 49)

    // Date
    doc.setFont("helvetica", "bold")
    doc.text("DATE", marginL + 110, 44)
    doc.setFont("helvetica", "normal")
    doc.text(new Date(quotation.createdAt).toLocaleDateString(), marginL + 110, 49)

    // Valid Until
    if (quotation.validUntil) {
      doc.setFont("helvetica", "bold")
      doc.text("VALID UNTIL", marginL + 150, 44)
      doc.setFont("helvetica", "normal")
      doc.text(new Date(quotation.validUntil).toLocaleDateString(), marginL + 150, 49)
    }

    // Reset text color
    doc.setTextColor(0, 0, 0)

    // Delivery Address
    let yPos = 65
    if (quotation.deliveryAddress) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text("Delivery Address:", marginL, yPos)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.text(quotation.deliveryAddress, marginL, yPos + 5)
      yPos += 15
    }

    // Notes
    if (quotation.notes) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text("Notes:", marginL, yPos)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      const noteLines = doc.splitTextToSize(quotation.notes, pageW - marginL - marginR)
      doc.text(noteLines, marginL, yPos + 5)
      yPos += 5 + (noteLines.length * 4)
    }

    yPos += 5

    // Items Table Header
    doc.setFillColor(240, 240, 240)
    doc.rect(marginL, yPos, pageW - marginL - marginR, 8, "F")
    
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.text("#", marginL + 2, yPos + 5)
    doc.text("DESCRIPTION", marginL + 10, yPos + 5)
    doc.text("QTY", marginL + 110, yPos + 5)
    doc.text("UNIT", marginL + 130, yPos + 5)
    doc.text("UNIT PRICE", marginL + 150, yPos + 5)
    doc.text("TOTAL", pageW - marginR - 2, yPos + 5, { align: "right" })

    yPos += 10

    // Items
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    
    quotation.items.forEach((item, index) => {
      if (yPos > pageH - 60) {
        doc.addPage()
        yPos = 20
      }

      const itemTotal = item.qty * item.unitPrice
      
      doc.text(`${index + 1}`, marginL + 2, yPos)
      const descLines = doc.splitTextToSize(item.description, 95)
      doc.text(descLines, marginL + 10, yPos)
      doc.text(item.qty.toString(), marginL + 110, yPos)
      doc.text(item.unit, marginL + 130, yPos)
      doc.text(`PKR ${item.unitPrice.toLocaleString()}`, marginL + 150, yPos)
      doc.text(`PKR ${itemTotal.toLocaleString()}`, pageW - marginR - 2, yPos, { align: "right" })

      yPos += Math.max(5, descLines.length * 4)
    })

    yPos += 5

    // Totals Section
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    
    const totalsX = pageW - marginR - 60
    
    // Subtotal
    doc.text("Subtotal:", totalsX, yPos)
    doc.text(`PKR ${quotation.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - marginR - 2, yPos, { align: "right" })
    yPos += 6

    // Discount
    if (quotation.discount > 0) {
      doc.setFont("helvetica", "normal")
      doc.text(`Discount ${quotation.discountIsPercentage ? `(${quotation.discount}%)` : ""}:`, totalsX, yPos)
      doc.text(`-PKR ${(quotation.discountValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - marginR - 2, yPos, { align: "right" })
      yPos += 6
    }

    // Tax
    if (quotation.taxPercent > 0) {
      doc.setFont("helvetica", "normal")
      doc.text(`Tax (${quotation.taxPercent}%):`, totalsX, yPos)
      doc.text(`PKR ${quotation.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - marginR - 2, yPos, { align: "right" })
      yPos += 6
    }

    // Transport
    if (quotation.transportCost > 0) {
      doc.setFont("helvetica", "normal")
      doc.text(`${quotation.transportLabel}:`, totalsX, yPos)
      doc.text(`PKR ${(quotation.transportCostValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - marginR - 2, yPos, { align: "right" })
      yPos += 6
    }

    // Other Cost
    if (quotation.otherCost > 0) {
      doc.setFont("helvetica", "normal")
      doc.text(`${quotation.otherCostLabel}:`, totalsX, yPos)
      doc.text(`PKR ${(quotation.otherCostValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - marginR - 2, yPos, { align: "right" })
      yPos += 6
    }

    // Total
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text("TOTAL:", totalsX, yPos)
    doc.text(`PKR ${quotation.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - marginR - 2, yPos, { align: "right" })

    // Footer
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text("Thank you for your business!", pageW / 2, pageH - 15, { align: "center" })
    doc.text("This is a computer-generated quotation.", pageW / 2, pageH - 10, { align: "center" })

    const pdfBlob = doc.output("blob")

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
