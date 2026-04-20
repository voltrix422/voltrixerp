import jsPDF from 'jspdf'
import 'jspdf-autotable'

interface OrderItem {
  id: string
  description: string
  specs?: string
  qty: number
  unit: string
  unitPrice: number
  total: number
}

interface CourierService {
  type: "own_driver" | "courier_company"
  driver?: string
  phone?: string
  vehicle?: string
  company?: string
}

interface OrderData {
  orderNumber: string
  status: "pending" | "approved" | "dispatched" | "delivered" | "cancelled"
  customer: {
    name: string
    phone: string
  }
  deliveryAddress: string
  items: OrderItem[]
  totalAmount: number
  courierService: CourierService
  dates: {
    dispatched?: string
    expected?: string
  }
  notes?: string
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

export function generateOrderPDF(order: OrderData): Blob {
  const doc = new jsPDF()
  
  // Colors matching website branding
  const primaryColor = [26, 159, 154] // #1a9f9a
  const darkGray = [64, 64, 64]
  const lightGray = [128, 128, 128]
  const backgroundColor = [248, 250, 252]

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
  doc.text(`Name: ${order.customer.name}`, 20, yPos)
  
  yPos += 6
  doc.text(`Phone: ${order.customer.phone}`, 20, yPos)

  // Delivery Information
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

  // Items Table
  yPos += 10
  doc.setTextColor(...primaryColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('ITEMS', 20, yPos)

  const tableData = order.items.map(item => [
    item.description,
    item.specs || '-',
    `${item.qty} ${item.unit}`,
    `Rs. ${item.unitPrice.toLocaleString()}`,
    `Rs. ${item.total.toLocaleString()}`
  ])

  doc.autoTable({
    startY: yPos + 5,
    head: [['Item', 'Specs', 'Qty', 'Unit Price', 'Total']],
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
      0: { cellWidth: 60 },
      1: { cellWidth: 40 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: 20, right: 20 }
  })

  // Total Amount
  yPos = (doc as any).lastAutoTable.finalY + 10
  doc.setFillColor(...primaryColor)
  doc.rect(20, yPos, 170, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL AMOUNT:', 25, yPos + 8)
  doc.text(`Rs. ${order.totalAmount.toLocaleString()}`, 160, yPos + 8)

  // Courier Service
  yPos += 25
  doc.setTextColor(...primaryColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('COURIER SERVICE', 20, yPos)
  
  yPos += 8
  doc.setTextColor(...darkGray)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Service Type: ${order.courierService.type.replace('_', ' ').toUpperCase()}`, 20, yPos)
  
  if (order.courierService.driver) {
    yPos += 6
    doc.text(`Driver: ${order.courierService.driver}`, 20, yPos)
  }
  
  if (order.courierService.phone) {
    yPos += 6
    doc.text(`Phone: ${order.courierService.phone}`, 20, yPos)
  }
  
  if (order.courierService.vehicle) {
    yPos += 6
    doc.text(`Vehicle: ${order.courierService.vehicle}`, 20, yPos)
  }

  // Dates
  if (order.dates.dispatched || order.dates.expected) {
    yPos += 15
    doc.setTextColor(...primaryColor)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('DATES', 20, yPos)
    
    yPos += 8
    doc.setTextColor(...darkGray)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    if (order.dates.dispatched) {
      doc.text(`Dispatched: ${new Date(order.dates.dispatched).toLocaleDateString()}`, 20, yPos)
      yPos += 6
    }
    
    if (order.dates.expected) {
      doc.text(`Expected: ${new Date(order.dates.expected).toLocaleDateString()}`, 20, yPos)
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

export async function downloadOrderPDF(order: OrderData) {
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