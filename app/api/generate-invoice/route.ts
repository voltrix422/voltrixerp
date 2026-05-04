import { NextRequest, NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const order = await request.json()
    
    const doc = new jsPDF()
    
    // Professional colors
    const black: [number, number, number] = [0, 0, 0]
    const gray: [number, number, number] = [100, 100, 100]
    const lightGray: [number, number, number] = [200, 200, 200]
    const accentColor: [number, number, number] = [26, 159, 154]
    
    let yPos = 15

    // Clean Header with Company Logo Area
    doc.setFontSize(28)
    doc.setTextColor(...accentColor)
    doc.setFont("helvetica", "bold")
    doc.text("INVOICE", 105, 25, { align: "center" })
    
    yPos = 40
    
    // Company Info Box with Logo
    doc.setDrawColor(...lightGray)
    doc.setLineWidth(0.8)
    doc.rect(15, yPos, 180, 40)
    
    // Add actual company logo
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png')
      if (fs.existsSync(logoPath)) {
        const logoData = fs.readFileSync(logoPath)
        const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`
        doc.addImage(logoBase64, 'PNG', 20, yPos + 5, 30, 30)
      } else {
        // Fallback logo text
        doc.setDrawColor(...accentColor)
        doc.setLineWidth(0.5)
        doc.rect(20, yPos + 5, 30, 30)
        doc.setFontSize(10)
        doc.setTextColor(...accentColor)
        doc.setFont("helvetica", "bold")
        doc.text("VOLTRIX", 35, yPos + 15, { align: "center" })
        doc.setFontSize(6)
        doc.text("PVT LTD", 35, yPos + 22, { align: "center" })
      }
    } catch (error) {
      // Fallback logo text
      doc.setDrawColor(...accentColor)
      doc.setLineWidth(0.5)
      doc.rect(20, yPos + 5, 30, 30)
      doc.setFontSize(8)
      doc.setTextColor(...gray)
      doc.setFont("helvetica", "normal")
      doc.text("LOGO", 35, yPos + 22, { align: "center" })
    }
    
    // Company Name (right of logo)
    doc.setFontSize(16)
    doc.setTextColor(...black)
    doc.setFont("helvetica", "bold")
    doc.text("VOLTRIX PVT LIMITED", 60, yPos + 12)
    
    // Company Details
    doc.setFontSize(9)
    doc.setTextColor(...gray)
    doc.setFont("helvetica", "normal")
    doc.text("Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", 60, yPos + 22)
    doc.text("+92 303 4927779", 60, yPos + 30)
    
    // Invoice Details on the right side of box
    doc.setFontSize(10)
    doc.setTextColor(...black)
    doc.setFont("helvetica", "bold")
    doc.text("Invoice #:", 140, yPos + 12)
    doc.setFont("helvetica", "normal")
    doc.text(order.orderNumber, 140, yPos + 20)
    
    doc.setFont("helvetica", "bold")
    doc.text("Date:", 170, yPos + 12)
    doc.setFont("helvetica", "normal")
    doc.text(new Date(order.createdAt).toLocaleDateString(), 170, yPos + 20)
    
    doc.setFont("helvetica", "bold")
    doc.text("Status:", 140, yPos + 30)
    doc.setFont("helvetica", "normal")
    doc.text(order.status || "Unknown", 140, yPos + 37)
    
    yPos = 90

    // Add delivery date if exists
    if (order.deliveryDate) {
      yPos += 5
      doc.setFontSize(9)
      doc.setTextColor(...black)
      doc.setFont("helvetica", "bold")
      doc.text("Delivery Date:", 15, yPos)
      doc.setFont("helvetica", "normal")
      doc.text(new Date(order.deliveryDate).toLocaleDateString(), 50, yPos)
      yPos += 8
    }

    yPos += 5

    // Bill To Section
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...gray)
    doc.text("BILL TO:", 15, yPos)
    
    yPos += 5
    
    doc.setFontSize(10)
    doc.setTextColor(...black)
    doc.setFont("helvetica", "bold")
    doc.text(order.clientName, 15, yPos)
    
    yPos += 5
    
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    if (order.deliveryAddress) {
      const addressLines = order.deliveryAddress.split("\n")
      addressLines.forEach((line: string, i: number) => {
        doc.text(line, 15, yPos + (i * 5))
      })
      yPos += (addressLines.length * 5) + 5
    } else {
      yPos += 5
    }

    yPos += 5

    // Items Table
    const tableData = order.items.map((item: any) => [
      item.description,
      item.qty.toString(),
      item.unit,
      `PKR ${item.unitPrice.toLocaleString()}`,
      `PKR ${(item.unitPrice * item.qty).toLocaleString()}`
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["Description", "Qty", "Unit", "Unit Price", "Total"]],
      body: tableData,
      theme: "plain",
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: black,
        fontStyle: "bold",
        fontSize: 9,
        lineWidth: 0.5,
        lineColor: lightGray
      },
      bodyStyles: {
        fontSize: 9,
        textColor: black,
        lineWidth: 0.5,
        lineColor: lightGray
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 20 },
        3: { cellWidth: 35, halign: "right" },
        4: { cellWidth: 35, halign: "right" }
      },
      margin: { left: 15, right: 15 },
      styles: {
        cellPadding: 3
      }
    })

    // Get Y position after table
    yPos = (doc as any).lastAutoTable.finalY + 10

    // Divider line before totals
    doc.line(130, yPos, 195, yPos)
    
    yPos += 8

    // Totals Section - Right aligned
    const totalsX = 130
    const totalsWidth = 65
    
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...black)
    
    // Subtotal
    doc.text("Subtotal:", totalsX, yPos)
    doc.text(`PKR ${order.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, totalsX + totalsWidth, yPos, { align: "right" })
    yPos += 5
    
    // Tax
    if (order.taxPercent > 0) {
      doc.text(`Tax (${order.taxPercent}%):`, totalsX, yPos)
      doc.text(`PKR ${order.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, totalsX + totalsWidth, yPos, { align: "right" })
      yPos += 5
    }
    
    // Transport
    if (order.transportCost > 0) {
      doc.text("Transport cost:", totalsX, yPos)
      doc.text(`PKR ${order.transportCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, totalsX + totalsWidth, yPos, { align: "right" })
      yPos += 5
    }
    
    // Other Cost
    if (order.otherCost > 0) {
      doc.text("Other cost:", totalsX, yPos)
      doc.text(`PKR ${order.otherCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, totalsX + totalsWidth, yPos, { align: "right" })
      yPos += 5
    }
    
    // Discount
    if (order.discount > 0 || order.discountValue > 0) {
      doc.setTextColor(0, 128, 0) // Green for discount
      doc.text(`Discount (${order.discount || 2}%):`, totalsX, yPos)
      doc.text(`-PKR ${(order.discountValue || (order.discountIsPercentage ? (order.subtotal * (order.discount || 2) / 100) : order.discount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, totalsX + totalsWidth, yPos, { align: "right" })
      doc.setTextColor(...black) // Reset to black
      yPos += 5
    }
    
    yPos += 2
    
    // Total line
    doc.setLineWidth(0.5)
    doc.setDrawColor(...black)
    doc.line(totalsX, yPos, totalsX + totalsWidth, yPos)
    yPos += 6
    
    // Total
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("TOTAL:", totalsX, yPos)
    doc.text(`PKR ${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, totalsX + totalsWidth, yPos, { align: "right" })

    // Footer with professional styling
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      
      // Footer divider with accent color
      doc.setLineWidth(0.8)
      doc.setDrawColor(...accentColor)
      doc.line(15, 275, 195, 275)
      
      // Thank you message with accent color
      doc.setFontSize(10)
      doc.setTextColor(...accentColor)
      doc.setFont("helvetica", "bold")
      doc.text("Thank you for your business!", 105, 280, { align: "center" })
      
      // Page info
      doc.setFontSize(8)
      doc.setTextColor(...gray)
      doc.setFont("helvetica", "normal")
      doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: "center" })
      doc.text(`Created by ${order.createdBy} on ${new Date(order.createdAt).toLocaleString()}`, 105, 290, { align: "center" })
    }

    const pdfBuffer = doc.output('arraybuffer')
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${order.orderNumber}.pdf"`
      }
    })
    
  } catch (error) {
    console.error('Error generating invoice:', error)
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 })
  }
}
