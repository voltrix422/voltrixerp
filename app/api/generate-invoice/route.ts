import { NextRequest, NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/db'
import { formatSerialListForLine, orderHasSerialAllocations } from '@/lib/order-fulfillment-serials'
import { getOrderSourcePdfLabelServer } from '@/lib/order-source-server'
import { resolveOrderItemModel } from '@/lib/orders'
import { formatInvoiceMoney, getInvoicePaymentSummary } from '@/lib/invoice-payment-summary'
import {
  buildInvoiceClientDetailRows,
  formatInvoiceModelCell,
  invoiceClientFromRecord,
  type InvoiceClientProfile,
} from '@/lib/invoice-client-details'

async function resolveInvoiceClient(order: {
  clientId?: string
}): Promise<InvoiceClientProfile | null> {
  if (!order.clientId) return null
  const client = await prisma.erpClient.findUnique({
    where: { id: order.clientId },
  })
  return invoiceClientFromRecord(client as Record<string, unknown> | null)
}

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

const FOOTER_H = 16
const TABLE_BOTTOM_MARGIN = FOOTER_H + 8

function drawInvoiceFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  font: string,
  teal: [number, number, number],
  white: [number, number, number],
) {
  doc.setFillColor(...teal)
  doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, 'F')
  doc.setFont(font, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...white)
  doc.text('Thank you for your business!', pageW / 2, pageH - 9, { align: 'center' })
  doc.setFont(font, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(200, 235, 234)
  doc.text('This is a computer-generated invoice. No signature required.', pageW / 2, pageH - 4, {
    align: 'center',
  })
}

function ensurePageSpace(doc: jsPDF, y: number, needed: number, pageH: number): number {
  if (y + needed > pageH - TABLE_BOTTOM_MARGIN) {
    doc.addPage()
    return 14
  }
  return y
}

function stampFootersOnAllPages(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  font: string,
  teal: [number, number, number],
  white: [number, number, number],
) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    drawInvoiceFooter(doc, pageW, pageH, font, teal, white)
  }
}

export async function POST(request: NextRequest) {
  try {
    const order = await request.json()
    const client = await resolveInvoiceClient(order)
    const clientDetailRows = buildInvoiceClientDetailRows(order, client)
    const pay = getInvoicePaymentSummary(order)
    const isProformaInvoice = pay.balanceDue > 0.004
    const documentTitle = isProformaInvoice ? "PROFORMA INVOICE" : "INVOICE"
    const taxAmount = Number(order.tax || 0)
    const hasTax = Math.abs(taxAmount) > 0.004

    const orderSourceLabel = await getOrderSourcePdfLabelServer(order)

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
    doc.text('Email: sale@voltrixbatteries.com  |  www.voltrixbatteries.com', mL + 30, 31)

    doc.setFont(FONT, 'bold')
    doc.setFontSize(isProformaInvoice ? 18 : 26)
    doc.text(documentTitle, pageW - mR, 22, { align: 'right' })
    doc.setFont(FONT, 'normal')
    doc.setFontSize(8.5)
    doc.text(order.orderNumber, pageW - mR, 29, { align: 'right' })

    // ── Meta band ─────────────────────────────────────────────────────────────
    doc.setFillColor(...tealDark)
    doc.rect(0, 44, pageW, 15, 'F')

    const metaItems = [
      { label: 'INVOICE DATE',  value: new Date(order.createdAt).toLocaleDateString('en-PK') },
      ...(order.deliveryDate ? [{ label: 'DELIVERY DATE', value: new Date(order.deliveryDate).toLocaleDateString('en-PK') }] : []),
      { label: 'STATUS',        value: (order.status || '').replace(/_/g, ' ').toUpperCase().substring(0, 16) },
      { label: 'PREPARED BY',   value: order.createdBy || '—' },
      { label: 'ORDER SOURCE',  value: orderSourceLabel.substring(0, 22) },
      ...(pay.showPaymentSection ? [{ label: 'PAYMENT', value: pay.paymentStatusLabel }] : []),
    ]
    const colW = (pageW - mL - mR) / metaItems.length
    metaItems.forEach((m, i) => {
      const x = mL + i * colW
      doc.setFont(FONT, 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(180, 230, 228)
      doc.text(m.label, x, 49.5)
      doc.setFont(FONT, 'normal')
      const valueSize = m.value.length > 16 ? 7 : 8
      doc.setFontSize(valueSize)
      doc.setTextColor(...white)
      const valueLines = doc.splitTextToSize(m.value, colW - 2)
      doc.text(valueLines[0], x, 55.5)
    })

    // ── Bill To + Invoice Info ────────────────────────────────────────────────
    let y = 64
    const contentW = pageW - mL - mR
    const billW = contentW * 0.58
    const infoW = contentW - billW - 6
    const infoX = mL + billW + 6

    const companyLine =
      client?.company &&
      client.company.trim().toLowerCase() !== (order.clientName || '').trim().toLowerCase()
        ? 1
        : 0
    const infoRows = [
      ['Invoice #', order.orderNumber],
      ['Issue date', new Date(order.createdAt).toLocaleDateString('en-PK')],
      ...(order.deliveryDate ? [['Delivery date', new Date(order.deliveryDate).toLocaleDateString('en-PK')]] : []),
      ['Status', (order.status || '').replace(/_/g, ' ').toUpperCase()],
      ['Prepared by', order.createdBy || '—'],
      ['Source', orderSourceLabel],
      ...(pay.showPaymentSection ? [['Payment', pay.paymentStatusLabel]] : []),
    ]
    const detailRowH = 5.6
    const billContentH = Math.max(42, 24 + companyLine * 5.5 + clientDetailRows.length * detailRowH)
    const infoContentH = Math.max(42, 15 + infoRows.length * 7.2)
    const billBoxH = Math.max(billContentH, infoContentH)
    doc.setFillColor(...lightBg)
    doc.setDrawColor(...lightGray)
    doc.setLineWidth(0.3)
    doc.roundedRect(mL, y, billW, billBoxH, 2, 2, 'FD')

    doc.setFillColor(...teal)
    doc.roundedRect(mL, y, billW, 7, 2, 2, 'F')
    doc.rect(mL, y + 3, billW, 4, 'F')
    doc.setFont(FONT, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...white)
    doc.text('BILL TO — CLIENT', mL + 4, y + 5)

    let by = y + 14
    doc.setFont(FONT, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...black)
    doc.text(order.clientName || '—', mL + 4, by)

    if (companyLine > 0) {
      by += 5.5
      doc.setFont(FONT, 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...gray)
      doc.text(client!.company, mL + 4, by)
    }

    if (clientDetailRows.length > 0) {
      by += 6
      doc.setFontSize(7.5)
      doc.setTextColor(...gray)
      clientDetailRows.forEach((row) => {
        const labelText = `${row.label}: `
        doc.setFont(FONT, 'bold')
        const labelW = doc.getTextWidth(labelText)
        doc.text(labelText, mL + 4, by)
        doc.setFont(FONT, 'normal')
        const valueLines = doc.splitTextToSize(row.value, billW - 10 - labelW)
        doc.text(valueLines[0] || row.value, mL + 4 + labelW, by)
        if (valueLines.length > 1) {
          for (let i = 1; i < valueLines.length; i++) {
            by += 4.2
            doc.text(valueLines[i], mL + 4 + labelW, by)
          }
        }
        by += detailRowH
      })
    }

    // Invoice details (right)
    doc.setFillColor(...lightBg)
    doc.setDrawColor(...lightGray)
    doc.roundedRect(infoX, y, infoW, billBoxH, 2, 2, 'FD')

    doc.setFillColor(...teal)
    doc.roundedRect(infoX, y, infoW, 7, 2, 2, 'F')
    doc.rect(infoX, y + 3, infoW, 4, 'F')
    doc.setFont(FONT, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...white)
    doc.text('INVOICE DETAILS', infoX + 4, y + 5)

    infoRows.forEach(([label, val], i) => {
      const ry = y + 14 + i * 7.2
      doc.setFont(FONT, 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...gray)
      doc.text(`${label}:`, infoX + 4, ry)
      doc.setFont(FONT, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...black)
      const valLines = doc.splitTextToSize(String(val), infoW - 28)
      doc.text(valLines[0], infoX + infoW - 4, ry, { align: 'right' })
    })

    // ── Items table ───────────────────────────────────────────────────────────
    y += billBoxH + 8

    const itemsWithModel = order.items.map((item: any) => ({
      item,
      model: resolveOrderItemModel(item),
    }))
    const showSerialCol = orderHasSerialAllocations(order)

    // Column order with serials: # | MODEL | SERIAL | QTY | UNIT | PRICE | AMOUNT
    const tableData = itemsWithModel.map(({ item, model }: { item: any; model: string | null }, idx: number) => {
      const row = [
        `${idx + 1}`,
        formatInvoiceModelCell(item.description, model),
        item.qty.toString(),
        item.unit,
        `PKR ${Number(item.unitPrice).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
        `PKR ${(Number(item.unitPrice) * Number(item.qty)).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`,
      ]
      if (showSerialCol) row.splice(2, 0, formatSerialListForLine(order, item.id))
      return row
    })

    const headRow = ['#', 'MODEL / PRODUCT', 'QTY', 'UNIT', 'UNIT PRICE', 'AMOUNT']
    if (showSerialCol) headRow.splice(2, 0, 'SERIAL NO.')

    // contentW = 182mm — widths must match column indices after SERIAL insert
    const columnStyles: Record<string, object> = showSerialCol
      ? {
          0: { cellWidth: 8, halign: 'center' as const },
          1: { cellWidth: 46, overflow: 'linebreak' as const, valign: 'top' as const },
          2: {
            cellWidth: 48,
            fontSize: 7,
            overflow: 'linebreak' as const,
            valign: 'top' as const,
          },
          3: { cellWidth: 10,halign: 'center' as const, valign: 'top' as const },
          4: { cellWidth: 12, halign: 'center' as const, valign: 'top' as const },
          5: { cellWidth: 29,halign: 'right' as const, fontSize: 7.5, overflow: 'linebreak' as const, valign: 'top' as const },
          6: { cellWidth: 29,halign: 'right' as const, fontSize: 7.5, fontStyle: 'bold' as const, overflow: 'linebreak' as const, valign: 'top' as const },
        }
      : {
          0: { cellWidth: 7,halign: 'center' as const },
          1: { cellWidth: 76, overflow: 'linebreak' as const, valign: 'top' as const },
          2: { cellWidth: 11,halign: 'center' as const },
          3: { cellWidth: 13,halign: 'center' as const },
          4: { cellWidth: 36,halign: 'right' as const, fontSize: 7.5, overflow: 'linebreak' as const },
          5: { cellWidth: 39,halign: 'right' as const, fontSize: 7.5, fontStyle: 'bold' as const, overflow: 'linebreak' as const },
        }

    const serialColIndex = showSerialCol ? 2 : -1

    autoTable(doc, {
      startY: y,
      head: [headRow],
      body: tableData,
      theme: 'plain',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      tableWidth: contentW,
      headStyles: {
        fillColor: teal,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 7.5,
        font: FONT,
        cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
        overflow: 'linebreak' as const,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: black,
        font: FONT,
        cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
        valign: 'top' as const,
        minCellHeight: 7,
      },
      alternateRowStyles: { fillColor: rowAlt },
      columnStyles: columnStyles as Record<string, object>,
      margin: { left: mL, right: mR, bottom: TABLE_BOTTOM_MARGIN },
      tableLineColor: lightGray,
      tableLineWidth: 0.25,
      didParseCell: (data) => {
        if (data.section !== 'body') return
        const raw = String(data.cell.raw ?? '')
        if (data.column.index === 1 && raw.includes('\n')) {
          data.cell.styles.fontSize = 7.5
        }
        if (data.column.index === serialColIndex) {
          data.cell.styles.fontSize = 7
          data.cell.styles.overflow = 'linebreak'
          // Prefer breaking only on newlines between serials
          data.cell.styles.cellPadding = { top: 2.5, bottom: 2.5, left: 2, right: 2 }
        }
      },
    })

    // Keep totals close under the items table (avoid a large empty gap)
    y = (doc as any).lastAutoTable.finalY + 5

    // ── Discount calculation ──────────────────────────────────────────────────
    const rawDiscount = Number(order.discount) || 0
    let discountValue = 0
    if (order.discountValue !== undefined && order.discountValue !== null && Number(order.discountValue) > 0) {
      discountValue = Number(order.discountValue)
    } else if (order.discountIsPercentage === true) {
      discountValue = Number(order.subtotal) * rawDiscount / 100
    } else if (order.discountIsPercentage === false) {
      discountValue = rawDiscount
    } else {
      // Backward compatibility for older records without an explicit mode.
      discountValue = rawDiscount <= 100 ? Number(order.subtotal) * rawDiscount / 100 : rawDiscount
    }
    const discountLabel =
      order.discountIsPercentage === true
        ? `Discount (${rawDiscount}%)`
        : "Discount"
    const transportVal  = Number(order.transportCostValue ?? order.transportCost ?? 0)
    const otherVal      = Number(order.otherCostValue ?? order.otherCost ?? 0)
    const subtotalAfterDiscount = Math.max(0, Number(order.subtotal || 0) - discountValue)

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
    if (discountValue > 0)
      totRows.push({ label: 'Subtotal After Discount', value: `PKR ${subtotalAfterDiscount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })
    if (hasTax)
      totRows.push({ label: `Included GST (${order.taxPercent}%)`, value: `PKR ${taxAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })
    if (transportVal > 0)
      totRows.push({ label: order.transportLabel || 'Transport', value: `PKR ${transportVal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })
    if (otherVal > 0)
      totRows.push({ label: order.otherCostLabel || 'Other', value: `PKR ${otherVal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` })

    const rowH   = 7
    const totBoxH = totRows.length * rowH + 18
    const payments: { id?: string; amount?: number; method?: string; date?: string; notes?: string }[] =
      order.payments || []
    const showBankDetails = pay.balanceDue > 0.004
    const showCreditBanner = pay.hasOutstanding && pay.isOnCredit
    const paymentLinesH = payments.length > 0 ? 5 + Math.min(payments.length, 4) * 5 : 0
    const bankBlockH = showBankDetails ? 34 : 0
    const creditBannerH = showCreditBanner ? 12 : pay.isPaidInFull ? 12 : 0
    const payBoxH = pay.showPaymentSection
      ? 30 + paymentLinesH + bankBlockH + creditBannerH + 4
      : 0

    // Only reserve space for totals here — payment block can start on the next page
    y = ensurePageSpace(doc, y, totBoxH + 2, pageH)

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

    // ── Payment / credit block ────────────────────────────────────────────────
    if (pay.showPaymentSection) {
      const payY = ensurePageSpace(doc, y + totBoxH + 5, payBoxH, pageH)
      const payW = pageW - mL - mR
      doc.setFillColor(...lightBg)
      doc.setDrawColor(...teal)
      doc.setLineWidth(0.4)
      doc.roundedRect(mL, payY, payW, payBoxH, 2, 2, 'FD')

      doc.setFillColor(...teal)
      doc.roundedRect(mL, payY, payW, 8, 2, 2, 'F')
      doc.rect(mL, payY + 4, payW, 4, 'F')
      doc.setFont(FONT, 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...white)
      doc.text('PAYMENT INFORMATION', mL + 4, payY + 5.5)

      let py = payY + 14
      const col1 = mL + 4
      const col2 = mL + payW * 0.5

      doc.setFont(FONT, 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(100, 100, 100)
      doc.text('AMOUNT PAID', col1, py)
      doc.text('AMOUNT TO PAY', col2, py)
      py += 5

      doc.setFont(FONT, 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...black)
      doc.text(formatInvoiceMoney(pay.amountPaid), col1, py)
      if (pay.hasOutstanding) doc.setTextColor(180, 90, 20)
      else if (pay.isPaidInFull) doc.setTextColor(34, 120, 60)
      doc.text(
        pay.isPaidInFull ? formatInvoiceMoney(0) : formatInvoiceMoney(pay.balanceDue),
        col2,
        py,
      )
      py += 7

      if (payments.length > 0) {
        doc.setFont(FONT, 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(100, 100, 100)
        doc.text('PAYMENT DETAILS', col1, py)
        py += 4.5
        doc.setFont(FONT, 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...gray)
        payments.slice(0, 4).forEach((p) => {
          const line = `${p.method || 'Payment'} · ${p.date ? new Date(p.date).toLocaleDateString('en-PK') : '—'} — PKR ${Number(p.amount || 0).toLocaleString('en-PK')}`
          doc.text(line.substring(0, 95), col1, py)
          py += 5
        })
      }

      if (showBankDetails) {
        py += 2
        const bankBoxH = 28
        doc.setFillColor(241, 249, 248)
        doc.roundedRect(mL + 3, py, payW - 6, bankBoxH, 1.5, 1.5, 'F')
        doc.setDrawColor(...lightGray)
        doc.setLineWidth(0.2)
        doc.roundedRect(mL + 3, py, payW - 6, bankBoxH, 1.5, 1.5, 'S')

        doc.setFont(FONT, 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...tealDark)
        doc.text('BANK DETAILS', mL + 6, py + 5)

        doc.setFont(FONT, 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...black)
        doc.text('Bank: UBL', mL + 6, py + 10)
        doc.text('Account #: 0109000340713349', mL + 6, py + 14.5)
        doc.text('Title: Voltrix Batteries Pvt Limited', mL + 6, py + 19)
        doc.text('IBAN: PK29UNIL0109000340713349', mL + 6, py + 23.5)

        doc.setFont(FONT, 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(180, 40, 40)
        const warnLines = doc.splitTextToSize(
          'Double-check details before sending · Send screenshot after payment',
          payW * 0.42,
        )
        doc.text(warnLines, mL + payW - 6, py + 10, { align: 'right' })
        py += bankBoxH + 3
      }

      if (pay.isPaidInFull) {
        doc.setFillColor(34, 139, 34)
        doc.roundedRect(mL + payW - 56, py, 52, 9, 2, 2, 'F')
        doc.setFont(FONT, 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...white)
        doc.text('PAID IN FULL', mL + payW - 52, py + 6)
      } else if (showCreditBanner) {
        doc.setFillColor(255, 243, 224)
        doc.roundedRect(mL + 3, py, payW - 6, 9, 1.5, 1.5, 'F')
        doc.setFont(FONT, 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(140, 80, 10)
        doc.text(
          'Credit invoice — balance payable to Voltrix Batteries.',
          col1,
          py + 6,
        )
      }
    }

    stampFootersOnAllPages(doc, pageW, pageH, FONT, teal, white)

    const pdfBuffer = doc.output('arraybuffer')
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${isProformaInvoice ? 'Proforma-Invoice' : 'Invoice'}-${order.orderNumber}.pdf"`,
      },
    })

  } catch (error) {
    console.error('Error generating invoice:', error)
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 })
  }
}
