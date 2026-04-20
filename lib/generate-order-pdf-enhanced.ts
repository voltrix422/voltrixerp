import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { type Order } from '@/lib/orders'

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

export function generateOrderPDF(order: Order): Blob {
  const doc = new jsPDF()
  
  // Colors matching website branding
  const primaryColor: [number, number, number] = [26, 159, 154] // #1a9f9a
  const darkGray: [number, number, number] = [64, 64, 64]
  const lightGray: [number, number, number] = [128, 128, 128]
  const backgroundColor: [number, number, number] = [248, 250, 252]

  // Header with logo area and company info
  doc.setFillColor(...backgroundColor)
  doc.rect(0, 0, 210, 40, 'F')
  
  // Company name (since we can't easily embed logo in jsPDF)
  doc.setTextColor(...primaryColor)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('VOLTRIX', 20, 25)
  
  // Order title
  doc.setTextColor(...darkGray)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDER DETAILS', 140, 20)
  
  // Order number and status
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Order #: ${order.orderNumber}`, 140, 28)
  
  // Status badge
  doc.setFillColor(...primaryColor)
  doc.roundedRect(140, 32, 30, 6, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(order.status.toUpperCase(), 142, 36)

  // Customer Information
  let yPos = 55
  doc.setTextColor(...primaryColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('CUSTOMER INFORMATION', 20, yPos)
  
  yPos += 8
  doc.setTextColor(...darkGray)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Name: ${order.clientName}`, 20, yPos)
  
  yPos += 6
  doc.text(`Client ID: ${order.clientId}`, 20, yPos)

  // Order Information
  yPos += 15
  doc.setTextColor(...primaryColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDER INFORMATION', 20, yPos)
  
  yPos += 8
  doc.setTextColor(...darkGray)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Created: ${new Date(order.createdAt).toLocaleDateString()} by ${order.createdBy}`, 20, yPos)
  
  if (order.deliveryDate) {
    yPos += 6
    doc.text(`Delivery Date: ${new Date(order.deliveryDate).toLocaleDateString()}`, 20, yPos)
  }

  // Delivery Information
  if (order.deliveryAddress) {
    yPos += 15
    doc.setTextColor(...primaryColor)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('DELIVERY INFORMATION', 20, yPos)
    
    yPos += 8
    doc.setTextColor(...darkGray)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    // Split long addresses into multiple lines
    const addressLines = doc.splitTextToSize(`Address: ${order.deliveryAddress}`, 170)
    doc.text(addressLines, 20, yPos)
    yPos += addressLines.length * 6
  }

  // Items Table
  yPos += 10
  doc.setTextColor(...primaryColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('ITEMS', 20, yPos)

  const tableData = order.items.map(item => [
    item.description,
    item.isCustom ? 'Custom' : 'Inventory',
    `${item.qty} ${item.unit}`,
    `Rs. ${item.unitPrice.toLocaleString()}`,
    `Rs. ${(item.unitPrice * item.qty).toLocaleString()}`
  ])

  doc.autoTable({
    startY: yPos + 5,
    head: [['Item', 'Type', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: darkGray
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: 20, right: 20 }
  })

  // Order Summary
  yPos = (doc as any).lastAutoTable.finalY + 15
  doc.setTextColor(...primaryColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDER SUMMARY', 20, yPos)

  yPos += 8
  doc.setTextColor(...darkGray)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  // Subtotal
  doc.text('Subtotal:', 120, yPos)
  doc.text(`Rs. ${order.subtotal.toLocaleString()}`, 160, yPos)
  yPos += 6

  // Tax
  if (order.taxPercent > 0) {
    doc.text(`Tax (${order.taxPercent}%):`, 120, yPos)
    doc.text(`Rs. ${order.tax.toLocaleString()}`, 160, yPos)
    yPos += 6
  }

  // Transport Cost
  if (order.transportCost > 0) {
    doc.text(`${order.transportLabel}:`, 120, yPos)
    doc.text(`Rs. ${order.transportCost.toLocaleString()}`, 160, yPos)
    yPos += 6
  }

  // Other Cost
  if (order.otherCost > 0) {
    doc.text(`${order.otherCostLabel}:`, 120, yPos)
    doc.text(`Rs. ${order.otherCost.toLocaleString()}`, 160, yPos)
    yPos += 6
  }

  // Shipping
  if (order.shipping > 0) {
    doc.text('Shipping:', 120, yPos)
    doc.text(`Rs. ${order.shipping.toLocaleString()}`, 160, yPos)
    yPos += 6
  }

  // Discount
  if (order.discount > 0) {
    doc.text('Discount:', 120, yPos)
    doc.setTextColor(220, 38, 38) // Red color for discount
    doc.text(`-Rs. ${order.discount.toLocaleString()}`, 160, yPos)
    doc.setTextColor(...darkGray)
    yPos += 6
  }

  // Total Amount
  yPos += 5
  doc.setFillColor(...primaryColor)
  doc.rect(115, yPos - 3, 75, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL AMOUNT:', 120, yPos + 5)
  doc.text(`Rs. ${order.total.toLocaleString()}`, 160, yPos + 5)

  // Dispatcher
  if (order.dispatcher) {
    yPos += 25
    doc.setTextColor(...primaryColor)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('DISPATCHER', 20, yPos)
    
    yPos += 8
    doc.setTextColor(...darkGray)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Assigned to: ${order.dispatcher}`, 20, yPos)
  }

  // Payments
  if (order.payments && order.payments.length > 0) {
    yPos += 15
    doc.setTextColor(...primaryColor)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('PAYMENTS RECEIVED', 20, yPos)
    
    yPos += 8
    doc.setTextColor(...darkGray)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    order.payments.forEach((payment, index) => {
      doc.text(`${index + 1}. Rs. ${payment.amount.toLocaleString()} - ${payment.method}`, 20, yPos)
      yPos += 5
      doc.text(`   Date: ${new Date(payment.date).toLocaleDateString()}`, 20, yPos)
      if (payment.notes) {
        yPos += 5
        doc.text(`   Notes: ${payment.notes}`, 20, yPos)
      }
      yPos += 8
    })
    
    const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(`Total Paid: Rs. ${totalPaid.toLocaleString()}`, 20, yPos)
    
    if (totalPaid < order.total) {
      yPos += 6
      doc.setTextColor(220, 38, 38) // Red color
      doc.text(`Remaining: Rs. ${(order.total - totalPaid).toLocaleString()}`, 20, yPos)
      doc.setTextColor(...darkGray)
    }
  }

  // Notes
  if (order.notes) {
    yPos += 15
    doc.setTextColor(...primaryColor)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('NOTES', 20, yPos)
    
    yPos += 8
    doc.setTextColor(...darkGray)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const notesLines = doc.splitTextToSize(order.notes, 170)
    doc.text(notesLines, 20, yPos)
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height
  doc.setTextColor(...lightGray)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Generated by Voltrix ERP System', 20, pageHeight - 20)
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, pageHeight - 15)

  return doc.output('blob')
}

export async function downloadOrderPDF(order: Order) {
  const blob = generateOrderPDF(order)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${order.orderNumber}-order-details.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}