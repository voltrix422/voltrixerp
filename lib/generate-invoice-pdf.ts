import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Order } from "./orders"
import { STATUS_LABELS } from "./orders"

export async function generateInvoicePDF(order: Order): Promise<Blob> {
  const doc = new jsPDF()
  
  // Professional colors
  const black: [number, number, number] = [0, 0, 0]
  const gray: [number, number, number] = [100, 100, 100]
  const lightGray: [number, number, number] = [200, 200, 200]
  const accentColor: [number, number, number] = [26, 159, 154] // Teal color matching your theme
  
  let yPos = 15

  // Header with Logo and Company Info
  doc.setFontSize(24)
  doc.setTextColor(...accentColor)
  doc.setFont("helvetica", "bold")
  doc.text("INVOICE", 105, yPos, { align: "center" })
  
  yPos += 8
  
  // Company Name with styling
  doc.setFontSize(12)
  doc.setTextColor(...black)
  doc.setFont("helvetica", "bold")
  doc.text("VOLTRIX PVT LIMITED", 105, yPos, { align: "center" })
  
  yPos += 5
  
  // Company Address
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  doc.setFont("helvetica", "normal")
  doc.text("Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", 105, yPos, { align: "center" })
  
  yPos += 4
  doc.text("+92 303 4927779", 105, yPos, { align: "center" })
  
  yPos += 6
  
  // Decorative line
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(1)
  doc.line(30, yPos, 180, yPos)
  
  yPos += 8

  yPos = 45

  // Divider line
  doc.setDrawColor(...lightGray)
  doc.setLineWidth(0.5)
  doc.line(15, yPos, 195, yPos)

  yPos += 10

  // Invoice Details - Clean layout
  doc.setFontSize(9)
  doc.setTextColor(...black)
  doc.setFont("helvetica", "bold")
  doc.text("Invoice Number:", 15, yPos)
  doc.setFont("helvetica", "normal")
  doc.text(order.orderNumber, 50, yPos)
  
  doc.setFont("helvetica", "bold")
  doc.text("Date:", 100, yPos)
  doc.setFont("helvetica", "normal")
  doc.text(new Date(order.createdAt).toLocaleDateString(), 115, yPos)
  
  doc.setFont("helvetica", "bold")
  doc.text("Status:", 155, yPos)
  doc.setFont("helvetica", "normal")
  doc.text(STATUS_LABELS[order.status], 170, yPos)
  
  yPos += 6
  
  if (order.deliveryDate) {
    doc.setFont("helvetica", "bold")
    doc.text("Delivery Date:", 15, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(new Date(order.deliveryDate).toLocaleDateString(), 50, yPos)
  }
  
  if (order.dispatcher) {
    doc.setFont("helvetica", "bold")
    doc.text("Dispatcher:", 100, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(order.dispatcher, 125, yPos)
    yPos += 6
  } else if (order.deliveryDate) {
    yPos += 6
  }

  yPos += 5

  // Divider line
  doc.line(15, yPos, 195, yPos)

  yPos += 10

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
    addressLines.forEach((line, i) => {
      doc.text(line, 15, yPos + (i * 5))
    })
    yPos += (addressLines.length * 5) + 5
  } else {
    yPos += 5
  }

  yPos += 5

  // Items Table - Minimal design
  const tableData = order.items.map(item => [
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
  if (order.discount > 0) {
    doc.text("Discount:", totalsX, yPos)
    doc.text(`-PKR ${order.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, totalsX + totalsWidth, yPos, { align: "right" })
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

  // Notes
  if (order.notes) {
    yPos += 15
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
    
    // Divider before notes
    doc.setLineWidth(0.5)
    doc.setDrawColor(...lightGray)
    doc.line(15, yPos, 195, yPos)
    yPos += 8
    
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...gray)
    doc.text("NOTES:", 15, yPos)
    
    yPos += 5
    
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...black)
    const notesLines = doc.splitTextToSize(order.notes, 180)
    doc.text(notesLines, 15, yPos)
  }

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

  return doc.output("blob")
}

export async function downloadInvoicePDF(order: Order): Promise<void> {
  const blob = await generateInvoicePDF(order)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `Invoice-${order.orderNumber}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}