import { NextRequest, NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const order = await request.json()

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })

    // ── Palette ──────────────────────────────────────────────────────────────
    const teal:      [number, number, number] = [26, 159, 154]
    const tealDark:  [number, number, number] = [18, 120, 116]
    const white:     [number, number, number] = [255, 255, 255]
    const black:     [number, number, number] = [30, 30, 30]
    const darkGray:  [number, number, number] = [80, 80, 80]
    const midGray:   [number, number, number] = [140, 140, 140]
    const lightGray: [number, number, number] = [230, 230, 230]
    const rowAlt:    [number, number, number] = [245, 250, 250]
    const green:     [number, number, number] = [34, 139, 34]

    const pageW = 210
    const marginL = 15
    const marginR = 15
    const contentW = pageW - marginL - marginR

    // ── Header band ──────────────────────────────────────────────────────────
    doc.setFillColor(...teal)
    doc.rect(0, 0, pageW, 38, 'F')

    // Logo
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png')
      if (fs.existsSync(logoPath)) {
        const logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
        doc.addImage(logoBase64, 'PNG', marginL, 5, 28, 28)
      }
    } catch {}

    // Company name + address (right of logo)
    doc.setTextColor(...white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('VOLTRIX PVT LIMITED', 50, 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Plot # 73, Street 14, Industrial Area I-9/2, Islamabad', 50, 21)
    doc.text('+92 303 4927779', 50, 27)

    // "QUOTATION" label — right side of header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('QUOTATION', pageW - marginR, 22, { align: 'right' })

    // ── Meta row (teal-dark band) ─────────────────────────────────────────────
    doc.setFillColor(...tealDark)
    doc.rect(0, 38, pageW, 14, 'F')

    doc.setTextColor(...white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)

    // Quotation #
    doc.text('QUOTATION #', marginL, 44)
    doc.setFont('helvetica', 'normal')
    doc.text(order.orderNumber, marginL, 49)

    // Date
    doc.setFont('helvetica', 'bold')
    doc.text('DATE', 75, 44)
    doc.setFont('helvetica', 'normal')
    doc.text(new Date(order.createdAt).toLocaleDateString(), 75, 49)

    // Delivery Date
    if (order.deliveryDate) {
      doc.setFont('helvetica', 'bold')
      doc.text('DELIVERY DATE', 120, 44)
      doc.setFont('helvetica', 'normal')
      doc.text(new Date(order.deliveryDate).toLocaleDateString(), 120, 49)
    }

    // Created by
    doc.setFont('helvetica', 'bold')
    doc.text('PREPARED BY', pageW - marginR - 35, 44)
    doc.setFont('helvetica', 'normal')
    doc.text(order.createdBy || '—', pageW - marginR - 35, 49)

    // ── TO section ───────────────────────────────────────────────────────────
    let y = 62

    doc.setTextColor(...teal)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('TO', marginL, y)

    // Underline
    doc.setDrawColor(...teal)
    doc.setLineWidth(0.4)
    doc.line(marginL, y + 1, marginL + 20, y + 1)

    y += 6
    doc.setTextColor(...black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(order.clientName || '—', marginL, y)

    if (order.deliveryAddress) {
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...darkGray)
      const lines = doc.splitTextToSize(order.deliveryAddress, 90)
      doc.text(lines, marginL, y)
      y += lines.length * 4.5
    }

    // ── Items table ──────────────────────────────────────────────────────────
    y = Math.max(y + 8, 90)

    const tableData = order.items.map((item: any) => [
      item.description,
      item.qty.toString(),
      item.unit,
      `PKR ${Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `PKR ${(Number(item.unitPrice) * Number(item.qty)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    ])

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Qty', 'Unit', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'plain',
      headStyles: {
        fillColor: teal,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      },
      bodyStyles: {
        fontSize: 9,
        textColor: black,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      },
      alternateRowStyles: { fillColor: rowAlt },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 38, halign: 'right' },
        4: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: marginL, right: marginR },
      tableLineColor: lightGray,
      tableLineWidth: 0.3,
    })

    y = (doc as any).lastAutoTable.finalY + 6

    // ── Totals block ─────────────────────────────────────────────────────────
    const totalsX = pageW - marginR - 75
    const totalsW = 75
    const labelX = totalsX + 2
    const valueX = totalsX + totalsW - 2

    function totalsRow(label: string, value: string, bold = false, color: [number,number,number] = black) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(bold ? 10 : 9)
      doc.setTextColor(...color)
      doc.text(label, labelX, y)
      doc.text(value, valueX, y, { align: 'right' })
      y += bold ? 6 : 5
    }

    // Light separator line
    doc.setDrawColor(...lightGray)
    doc.setLineWidth(0.3)
    doc.line(totalsX, y, totalsX + totalsW, y)
    y += 5

    totalsRow('Subtotal', `PKR ${Number(order.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)

    if (order.taxPercent > 0) {
      totalsRow(`Tax (${order.taxPercent}%)`, `PKR ${Number(order.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
    }

    if (order.transportCost > 0) {
      const tVal = order.transportCostValue ?? order.transportCost
      totalsRow(order.transportLabel || 'Transport', `PKR ${Number(tVal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
    }

    if (order.otherCost > 0) {
      const oVal = order.otherCostValue ?? order.otherCost
      totalsRow(order.otherCostLabel || 'Other cost', `PKR ${Number(oVal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
    }

    const discountValue = order.discountValue ?? (order.discountIsPercentage
      ? (order.subtotal * (order.discount || 0) / 100)
      : (order.discount || 0))
    if (discountValue > 0) {
      totalsRow('Discount', `-PKR ${Number(discountValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, false, green)
    }

    // Total divider
    doc.setDrawColor(...teal)
    doc.setLineWidth(0.6)
    doc.line(totalsX, y, totalsX + totalsW, y)
    y += 5

    // Total row with teal background pill
    doc.setFillColor(...teal)
    doc.roundedRect(totalsX, y - 4, totalsW, 9, 1.5, 1.5, 'F')
    doc.setTextColor(...white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('TOTAL', labelX, y + 2)
    doc.text(`PKR ${Number(order.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, valueX, y + 2, { align: 'right' })
    y += 12

    // ── Notes (if any) ───────────────────────────────────────────────────────
    if (order.notes) {
      y += 4
      doc.setTextColor(...teal)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('NOTES', marginL, y)
      doc.setDrawColor(...teal)
      doc.setLineWidth(0.4)
      doc.line(marginL, y + 1, marginL + 18, y + 1)
      y += 6
      doc.setTextColor(...darkGray)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const noteLines = doc.splitTextToSize(order.notes, contentW)
      doc.text(noteLines, marginL, y)
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)

      // Footer band
      doc.setFillColor(...teal)
      doc.rect(0, 282, pageW, 15, 'F')

      doc.setTextColor(...white)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Thank you for your business!', pageW / 2, 288, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(`Page ${i} of ${pageCount}`, pageW / 2, 293, { align: 'center' })
    }

    const pdfBuffer = doc.output('arraybuffer')

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Quotation-${order.orderNumber}.pdf"`,
      },
    })

  } catch (error) {
    console.error('Error generating quotation:', error)
    return NextResponse.json({ error: 'Failed to generate quotation' }, { status: 500 })
  }
}
