import { NextRequest, NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import fs from 'fs'
import path from 'path'

function loadFont(filename: string): string {
  try {
    const p = path.join(process.cwd(), 'public', filename)
    if (fs.existsSync(p)) return fs.readFileSync(p).toString('base64')
  } catch {}
  return ''
}

const geistRegularB64 = loadFont('Geist-Regular.ttf')
const geistBoldB64    = loadFont('Geist-Bold.ttf')

function registerGeist(doc: jsPDF) {
  if (geistRegularB64) { doc.addFileToVFS('Geist-Regular.ttf', geistRegularB64); doc.addFont('Geist-Regular.ttf', 'Geist', 'normal') }
  if (geistBoldB64)    { doc.addFileToVFS('Geist-Bold.ttf',    geistBoldB64);    doc.addFont('Geist-Bold.ttf',    'Geist', 'bold')   }
}

const FONT = geistRegularB64 ? 'Geist' : 'helvetica'

export async function POST(request: NextRequest) {
  try {
    const order = await request.json()
    const taxAmount = Number(order.tax || 0)
    const hasTax = Math.abs(taxAmount) > 0.004

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    registerGeist(doc)
    doc.setFont(FONT, 'normal')

    const teal:     [number,number,number] = [26, 159, 154]
    const tealDark: [number,number,number] = [18, 120, 116]
    const white:    [number,number,number] = [255, 255, 255]
    const black:    [number,number,number] = [30, 30, 30]
    const gray:     [number,number,number] = [90, 90, 90]
    const lightGray:[number,number,number] = [230, 230, 230]
    const lightBg:  [number,number,number] = [247, 250, 250]
    const rowAlt:   [number,number,number] = [245, 250, 250]
    const red:      [number,number,number] = [200, 50, 50]

    const pageW = 210
    const pageH = doc.internal.pageSize.getHeight()
    const mL = 14
    const mR = 14

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFillColor(...teal)
    doc.rect(0, 0, pageW, 44, 'F')

    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png')
      if (fs.existsSync(logoPath)) {
        const b64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
        doc.addImage(b64, 'PNG', mL, 7, 26, 26)
      }
    } catch {}

    doc.setTextColor(...white)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(14)
    doc.text('VOLTRIX BATTERIES', mL + 30, 15)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(7)
    doc.text('Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad', mL + 30, 21)
    doc.text('Phone: 051-8731661  |  Mobile: +92 303 4927779', mL + 30, 26)
    doc.text('Email: info@voltrix-power.com  |  www.voltrixbatteries.com', mL + 30, 31)

    doc.setFont(FONT, 'bold')
    doc.setFontSize(26)
    doc.text('INVOICE', pageW - mR, 22, { align: 'right' })
    doc.setFont(FONT, 'normal')
    doc.setFontSize(8.5)
    doc.text(order.orderNumber, pageW - mR, 29, { align: 'right' })

    // ── Meta band ─────────────────────────────────────────────────────────────
    doc.setFillColor(...tealDark)
    doc.rect(0, 44, pageW, 15, 'F')

    const metaItems = [
      { label: 'CLIENT',        value: (order.clientName || '—').substring(0, 22) },
      { label: 'INVOICE DATE',  value: new Date(order.createdAt).toLocaleDateString('en-PK') },
      ...(order.deliveryDate ? [{ label: 'DELIVERY DATE', value: new Date(order.deliveryDate).toLocaleDateString('en-PK') }] : []),
      { label: 'PREPARED BY',   value: order.createdBy || '—' },
    ]
    const colW = (pageW - mL - mR) / metaItems.length
    metaItems.forEach((m, i) => {
      const x = mL + i * colW
      doc.setFont(FONT, 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(180, 230, 228)
      doc.text(m.label, x, 49.5)
      doc.setFont(FONT, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...white)
      doc.text(m.value, x, 55.5)
    })

    // ── Bill To + Invoice Info (two columns) ──────────────────────────────────
    let y = 67
    const billW  = 90
    const infoW  = pageW - mL - mR - billW - 8
    const infoX  = mL + billW + 8

    // Bill To box
    doc.setFillColor(...lightBg)
    doc.setDrawColor(...lightGray)
    doc.setLineWidth(0.3)
    doc.roundedRect(mL, y, billW, 28, 2, 2, 'FD')

    // Bill To header strip
    doc.setFillColor(...teal)
    doc.roundedRect(mL, y, billW, 7, 2, 2, 'F')
    doc.rect(mL, y + 3, billW, 4, 'F')
    doc.setFont(FONT, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...white)
    doc.text('BILL TO', mL + 4, y + 5)

    doc.setFont(FONT, 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...black)
    doc.text(order.clientName || '—', mL + 4, y + 14)

    if (order.deliveryAddress) {
      doc.setFont(FONT, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...gray)
      const addrLines = doc.splitTextToSize(order.deliveryAddress, billW - 8)
      doc.text(addrLines.slice(0, 2), mL + 4, y + 20)
    }

    // Invoice Info box (right side)
    doc.setFillColor(...lightBg)
    doc.setDrawColor(...lightGray)
    doc.roundedRect(infoX, y, infoW, 28, 2, 2, 'FD')

    doc.setFillColor(...teal)
    doc.roundedRect(infoX, y, infoW, 7, 2, 2, 'F')
    doc.rect(infoX, y + 3, infoW, 4, 'F')
    doc.setFont(FONT, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...white)
    doc.text('INVOICE DETAILS', infoX + 4, y + 5)

    const infoRows = [
      ['Invoice #:', order.orderNumber],
      ['Date:', new Date(order.createdAt).toLocaleDateString('en-PK')],
      ...(order.deliveryDate ? [['Delivery:', new Date(order.deliveryDate).toLocaleDateString('en-PK')]] : []),
      ['Status:', (order.status || '').replace(/_/g, ' ').toUpperCase()],
    ]
    infoRows.forEach(([label, val], i) => {
      const ry = y + 13 + i * 6
      doc.setFont(FONT, 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...gray)
      doc.text(label, infoX + 4, ry)
      doc.setFont(FONT, 'normal')
      doc.setTextColor(...black)
      doc.text(val, infoX + infoW - 4, ry, { align: 'right' })
    })

    // ── Items table ───────────────────────────────────────────────────────────
    y += 34

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
      headStyles: { fillColor: teal, textColor: white, fontStyle: 'bold', fontSize: 8, font: FONT, cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 } },
      bodyStyles: { fontSize: 8.5, textColor: black, font: FONT, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
      alternateRowStyles: { fillColor: rowAlt },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 13, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 34, halign: 'right' },
        5: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: mL, right: mR },
      tableLineColor: lightGray,
      tableLineWidth: 0.25,
    })

    y = (doc as any).lastAutoTable.finalY + 8

    // ── Discount calculation ──────────────────────────────────────────────────
    const rawDiscount = Number(order.discount) || 0
    let discountValue: number
    if (order.discountValue !== undefined && order.discountValue !== null && Number(order.discountValue) > 0) {
      discountValue = Number(order.discountValue)
    } else if (order.discountIsPercentage === true) {
      discountValue = Number(order.subtotal) * rawDiscount / 100
    } else if (order.discountIsPercentage === false) {
      discountValue = rawDiscount
    } else {
      discountValue = rawDiscount <= 100 ? Number(order.subtotal) * rawDiscount / 100 : rawDiscount
    }
    const discountLabel = `Discount${rawDiscount > 0 && rawDiscount <= 100 ? ` (${rawDiscount}%)` : ''}`
    const transportVal  = Number(order.transportCostValue ?? order.transportCost ?? 0)
    const otherVal      = Number(order.otherCostValue ?? order.otherCost ?? 0)

    // ── Two-column bottom: Notes (left) + Totals (right) ─────────────────────
    const totW  = 84
    const totX  = pageW - mR - totW
    const noteW = totX - mL - 6

    // Build totals rows
    type TRow = { label: string; value: string; color?: [number,number,number] }
    const totRows: TRow[] = [
      { label: 'Subtotal', value: `PKR ${Number(order.subtotal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` },
    ]
    if (discountValue > 0)
      totRows.push({ label: discountLabel, value: `-PKR ${discountValue.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, color: red })
    if (hasTax)
      totRows.push({ label: `Tax (${order.taxPercent}%)`, value: `PKR ${taxAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })
    if (transportVal > 0)
      totRows.push({ label: order.transportLabel || 'Transport', value: `PKR ${transportVal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })
    if (otherVal > 0)
      totRows.push({ label: order.otherCostLabel || 'Other', value: `PKR ${otherVal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })

    const rowH   = 7
    const totBoxH = totRows.length * rowH + 18
    const payments: any[] = order.payments || []
    const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0)
    const balance   = Number(order.total) - totalPaid

    // Notes box (left)
    if (order.notes) {
      doc.setFillColor(...lightBg)
      doc.setDrawColor(...lightGray)
      doc.setLineWidth(0.3)
      doc.roundedRect(mL, y, noteW, totBoxH, 2, 2, 'FD')

      doc.setFillColor(...teal)
      doc.roundedRect(mL, y, noteW, 7, 2, 2, 'F')
      doc.rect(mL, y + 3, noteW, 4, 'F')
      doc.setFont(FONT, 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...white)
      doc.text('NOTES', mL + 4, y + 5)

      doc.setFont(FONT, 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...gray)
      const noteLines = doc.splitTextToSize(order.notes, noteW - 8)
      doc.text(noteLines, mL + 4, y + 13)
    }

    // Totals box (right)
    doc.setFillColor(...lightBg)
    doc.setDrawColor(...lightGray)
    doc.setLineWidth(0.3)
    doc.roundedRect(totX, y, totW, totBoxH, 2, 2, 'FD')

    let ry = y + 7
    totRows.forEach(row => {
      doc.setFont(FONT, 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...(row.color || gray))
      doc.text(row.label, totX + 4, ry)
      doc.setTextColor(...(row.color || black))
      doc.text(row.value, totX + totW - 4, ry, { align: 'right' })
      ry += rowH
    })

    // Divider
    doc.setDrawColor(...lightGray)
    doc.setLineWidth(0.4)
    doc.line(totX + 4, ry, totX + totW - 4, ry)
    ry += 4

    // Total row
    doc.setFillColor(...teal)
    doc.roundedRect(totX + 2, ry - 3, totW - 4, 11, 1.5, 1.5, 'F')
    doc.setFont(FONT, 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...white)
    doc.text('TOTAL', totX + 6, ry + 4.5)
    doc.text(`PKR ${Number(order.total).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, totX + totW - 6, ry + 4.5, { align: 'right' })

    // ── Payment badge ─────────────────────────────────────────────────────────
    if (payments.length > 0) {
      const badgeY = y + totBoxH + 6
      if (balance <= 0) {
        doc.setFillColor(34, 139, 34)
      } else {
        doc.setFillColor(230, 100, 30)
      }
      doc.roundedRect(mL, badgeY, 72, 9, 2, 2, 'F')
      doc.setFont(FONT, 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...white)
      const badgeText = balance <= 0
        ? '✓  PAID IN FULL'
        : `Balance Due: PKR ${balance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`
      doc.text(badgeText, mL + 4, badgeY + 6)
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.setFillColor(...teal)
    doc.rect(0, pageH - 16, pageW, 16, 'F')
    doc.setFont(FONT, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...white)
    doc.text('Thank you for your business!', pageW / 2, pageH - 9, { align: 'center' })
    doc.setFont(FONT, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(200, 235, 234)
    doc.text('This is a computer-generated invoice. No signature required.', pageW / 2, pageH - 4, { align: 'center' })

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
