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
    const teal:      [number,number,number] = [26, 159, 154]
    const tealDark:  [number,number,number] = [18, 120, 116]
    const white:     [number,number,number] = [255, 255, 255]
    const black:     [number,number,number] = [30, 30, 30]
    const darkGray:  [number,number,number] = [80, 80, 80]
    const lightGray: [number,number,number] = [230, 230, 230]
    const rowAlt:    [number,number,number] = [245, 250, 250]
    const lightBg:   [number,number,number] = [247, 250, 250]
    const green:     [number,number,number] = [34, 139, 34]
    const red:       [number,number,number] = [200, 50, 50]

    const pageW = 210
    const mL = 14
    const mR = 14

    // ── Header band ──────────────────────────────────────────────────────────
    doc.setFillColor(...teal)
    doc.rect(0, 0, pageW, 42, 'F')

    // Logo
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png')
      if (fs.existsSync(logoPath)) {
        const logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
        doc.addImage(logoBase64, 'PNG', mL, 6, 28, 28)
      }
    } catch {}

    // Company info
    doc.setTextColor(...white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text('VOLTRIX BATTERIES', mL + 32, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text('Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad', mL + 32, 20)
    doc.text('Phone: 051-8731661  |  Mobile: +92 303 4927779', mL + 32, 25)
    doc.text('Email: info@voltrix-power.com  |  www.voltrixbatteries.com', mL + 32, 30)

    // INVOICE label (top-right)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.text('INVOICE', pageW - mR, 20, { align: 'right' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(order.orderNumber, pageW - mR, 27, { align: 'right' })

    // ── Meta band ────────────────────────────────────────────────────────────
    doc.setFillColor(...tealDark)
    doc.rect(0, 42, pageW, 16, 'F')

    const metaItems = [
      { label: 'CLIENT', value: order.clientName || '—' },
      { label: 'INVOICE DATE', value: new Date(order.createdAt).toLocaleDateString('en-PK') },
      ...(order.deliveryDate ? [{ label: 'DELIVERY DATE', value: new Date(order.deliveryDate).toLocaleDateString('en-PK') }] : []),
      { label: 'PREPARED BY', value: order.createdBy || '—' },
    ]
    const colW = (pageW - mL - mR) / metaItems.length
    metaItems.forEach((m, i) => {
      const x = mL + i * colW
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(180, 230, 228)
      doc.text(m.label, x, 48)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...white)
      doc.text(m.value, x, 54)
    })

    // ── Bill To section ──────────────────────────────────────────────────────
    let y = 66
    doc.setTextColor(...teal)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('BILL TO', mL, y)
    doc.setDrawColor(...teal)
    doc.setLineWidth(0.4)
    doc.line(mL, y + 1, mL + 22, y + 1)

    y += 6
    doc.setTextColor(...black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(order.clientName || '—', mL, y)

    if (order.deliveryAddress) {
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...darkGray)
      const addrLines = doc.splitTextToSize(order.deliveryAddress, 90)
      doc.text(addrLines, mL, y)
      y += addrLines.length * 4.5
    }

    // ── Items table ──────────────────────────────────────────────────────────
    y = Math.max(y + 8, 92)

    const tableData = order.items.map((item: any, idx: number) => [
      `${idx + 1}`,
      item.description,
      item.qty.toString(),
      item.unit,
      `PKR ${Number(item.unitPrice).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
      `PKR ${(Number(item.unitPrice) * Number(item.qty)).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
    ])

    autoTable(doc, {
      startY: y,
      head: [['#', 'DESCRIPTION', 'QTY', 'UNIT', 'UNIT PRICE', 'AMOUNT']],
      body: tableData,
      theme: 'plain',
      headStyles: {
        fillColor: teal,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 8.5,
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      },
      bodyStyles: {
        fontSize: 9,
        textColor: black,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      },
      alternateRowStyles: { fillColor: rowAlt },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 36, halign: 'right' },
        5: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: mL, right: mR },
      tableLineColor: lightGray,
      tableLineWidth: 0.3,
    })

    y = (doc as any).lastAutoTable.finalY + 6

    // ── Totals block ─────────────────────────────────────────────────────────
    const totW = 82
    const totX = pageW - mR - totW

    // Calculate discount value
    const discountValue = order.discountValue ?? (
      order.discountIsPercentage
        ? (order.subtotal * (order.discount || 0) / 100)
        : (order.discount || 0)
    )
    const transportVal = order.transportCostValue ?? order.transportCost ?? 0
    const otherVal = order.otherCostValue ?? order.otherCost ?? 0

    // Build rows
    type TRow = { label: string; value: string; color?: [number,number,number]; bold?: boolean }
    const rows: TRow[] = []
    rows.push({ label: 'Subtotal', value: `PKR ${Number(order.subtotal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })
    if (discountValue > 0)
      rows.push({ label: `Discount${order.discountIsPercentage ? ` (${order.discount}%)` : ''}`, value: `-PKR ${Number(discountValue).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, color: red })
    if (order.taxPercent > 0)
      rows.push({ label: `Tax (${order.taxPercent}%)`, value: `PKR ${Number(order.tax).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })
    if (transportVal > 0)
      rows.push({ label: order.transportLabel || 'Transport', value: `PKR ${Number(transportVal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })
    if (otherVal > 0)
      rows.push({ label: order.otherCostLabel || 'Other', value: `PKR ${Number(otherVal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })

    const rowH = 7
    const boxH = rows.length * rowH + 16
    doc.setFillColor(...lightBg)
    doc.setDrawColor(...lightGray)
    doc.setLineWidth(0.3)
    doc.roundedRect(totX, y, totW, boxH, 2, 2, 'FD')

    let ry = y + 6
    rows.forEach(row => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...(row.color || darkGray))
      doc.text(row.label, totX + 4, ry)
      doc.setTextColor(...(row.color || black))
      doc.text(row.value, totX + totW - 4, ry, { align: 'right' })
      ry += rowH
    })

    // Divider
    doc.setDrawColor(...lightGray)
    doc.setLineWidth(0.4)
    doc.line(totX + 4, ry - 1, totX + totW - 4, ry - 1)
    ry += 3

    // Total row
    doc.setFillColor(...teal)
    doc.roundedRect(totX, ry - 4, totW, 12, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...white)
    doc.text('TOTAL', totX + 4, ry + 4)
    doc.text(`PKR ${Number(order.total).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, totX + totW - 4, ry + 4, { align: 'right' })

    // ── Notes ────────────────────────────────────────────────────────────────
    if (order.notes) {
      y = ry + 16
      doc.setTextColor(...teal)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('NOTES', mL, y)
      doc.setDrawColor(...teal)
      doc.setLineWidth(0.4)
      doc.line(mL, y + 1, mL + 18, y + 1)
      y += 6
      doc.setTextColor(...darkGray)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const noteLines = doc.splitTextToSize(order.notes, pageW - mL - mR - totW - 10)
      doc.text(noteLines, mL, y)
    }

    // ── Payment status badge ─────────────────────────────────────────────────
    const payments: any[] = order.payments || []
    const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0)
    const balance = Number(order.total) - totalPaid

    if (payments.length > 0) {
      const badgeY = ry + 16
      doc.setFillColor(balance <= 0 ? 34 : 255, balance <= 0 ? 139 : 165, balance <= 0 ? 34 : 0)
      doc.roundedRect(mL, badgeY - 4, 60, 10, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...white)
      doc.text(balance <= 0 ? '✓ PAID IN FULL' : `Balance: PKR ${balance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, mL + 4, badgeY + 2)
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...teal)
    doc.rect(0, pageH - 18, pageW, 18, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...white)
    doc.text('Thank you for your business!', pageW / 2, pageH - 11, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(200, 235, 234)
    doc.text('This is a computer-generated invoice. No signature required.', pageW / 2, pageH - 6, { align: 'center' })

    const pdfBuffer = doc.output('arraybuffer')

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${order.orderNumber}.pdf"`,
      },
    })

  } catch (error) {
    console.error('Error generating invoice:', error)
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 })
  }
}
