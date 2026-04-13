import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Order } from "@/lib/orders"

export async function generateDispatchNotePDF(order: Order, dispatcherName?: string, dispatchDate?: string): Promise<Blob> {
  const doc = new jsPDF()
  
  // Add logo
  try {
    const logoImg = await fetch("/logo.png").then(r => r.blob()).then(b => 
      new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(b)
      })
    )
    doc.addImage(logoImg, "PNG", 15, 10, 30, 30)
  } catch (e) {
    console.error("Failed to load logo:", e)
  }

  // Company header
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("DISPATCH NOTE", 105, 25, { align: "center" })
  
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Your Company Name", 105, 32, { align: "center" })
  doc.text("Address Line 1, City, Country", 105, 37, { align: "center" })
  doc.text("Phone: +92 XXX XXXXXXX | Email: info@company.com", 105, 42, { align: "center" })

  // Dispatch details box
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(245, 245, 245)
  doc.rect(15, 50, 180, 30, "FD")
  
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("Dispatch Note #:", 20, 57)
  doc.text("Order #:", 20, 63)
  doc.text("Dispatch Date:", 20, 69)
  doc.text("Delivery Date:", 20, 75)
  
  doc.setFont("helvetica", "normal")
  doc.text(`DN-${order.orderNumber}`, 55, 57)
  doc.text(order.orderNumber, 55, 63)
  doc.text(dispatchDate || new Date().toLocaleDateString(), 55, 69)
  doc.text(order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—", 55, 75)
  
  doc.setFont("helvetica", "bold")
  doc.text("Status:", 120, 57)
  doc.text("Dispatcher:", 120, 63)
  doc.text("Client:", 120, 69)
  
  doc.setFont("helvetica", "normal")
  doc.text(order.status.toUpperCase(), 150, 57)
  doc.text(dispatcherName || order.dispatcher || "—", 150, 63)
  doc.text(order.clientName, 150, 69)

  // Delivery Address
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("DELIVERY ADDRESS:", 15, 90)
  
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  if (order.deliveryAddress) {
    const addressLines = doc.splitTextToSize(order.deliveryAddress, 180)
    doc.text(addressLines, 15, 96)
  } else {
    doc.text("No delivery address provided", 15, 96)
  }

  // Items table with pricing
  const tableStartY = 110
  
  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Item Description", "Qty", "Unit", "Unit Price", "Total"]],
    body: order.items.map((item, index) => [
      (index + 1).toString(),
      item.description,
      item.qty.toString(),
      item.unit,
      `PKR ${item.unitPrice.toLocaleString()}`,
      `PKR ${(item.unitPrice * item.qty).toLocaleString()}`
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "center"
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 70 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 35, halign: "right" },
      5: { cellWidth: 35, halign: "right" }
    },
    foot: [[
      { content: "SUBTOTAL", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
      { content: `PKR ${order.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { halign: "right", fontStyle: "bold" } }
    ]]
  })

  // Financial summary
  const finalY = (doc as any).lastAutoTable.finalY + 10
  
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(250, 250, 250)
  doc.rect(120, finalY, 75, 50, "FD")
  
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("PAYMENT SUMMARY", 157.5, finalY + 7, { align: "center" })
  
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  
  let yPos = finalY + 15
  doc.text("Subtotal:", 125, yPos)
  doc.text(`PKR ${order.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: "right" })
  
  if (order.taxPercent > 0) {
    yPos += 6
    doc.text(`Tax (${order.taxPercent}%):`, 125, yPos)
    doc.text(`PKR ${order.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: "right" })
  }
  
  if (order.transportCost > 0) {
    yPos += 6
    doc.text(`${order.transportLabel}:`, 125, yPos)
    doc.text(`PKR ${order.transportCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: "right" })
  }
  
  if (order.otherCost > 0) {
    yPos += 6
    doc.text(`${order.otherCostLabel}:`, 125, yPos)
    doc.text(`PKR ${order.otherCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: "right" })
  }
  
  yPos += 8
  doc.setDrawColor(100, 100, 100)
  doc.line(125, yPos - 2, 190, yPos - 2)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("TOTAL:", 125, yPos)
  doc.text(`PKR ${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: "right" })

  // Order info box
  const infoY = finalY
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(250, 250, 250)
  doc.rect(15, infoY, 100, 50, "FD")
  
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("ORDER INFORMATION", 65, infoY + 7, { align: "center" })
  
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`Total Items: ${order.items.length}`, 20, infoY + 17)
  doc.text(`Total Quantity: ${order.items.reduce((sum, item) => sum + item.qty, 0)} units`, 20, infoY + 24)
  
  if (order.notes) {
    doc.setFont("helvetica", "bold")
    doc.text("Notes:", 20, infoY + 32)
    doc.setFont("helvetica", "normal")
    const notesLines = doc.splitTextToSize(order.notes, 90)
    doc.text(notesLines.slice(0, 2), 20, infoY + 38)
  }

  // Signature section
  const signatureY = finalY + 60
  
  doc.setDrawColor(100, 100, 100)
  doc.line(15, signatureY, 70, signatureY)
  doc.line(140, signatureY, 195, signatureY)
  
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("DISPATCHER", 42.5, signatureY + 5, { align: "center" })
  doc.text("RECEIVER", 167.5, signatureY + 5, { align: "center" })
  
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(`Name: ${dispatcherName || "_________________"}`, 15, signatureY + 11)
  doc.text(`Date: ${dispatchDate || "_________________"}`, 15, signatureY + 17)
  doc.text("Name: _________________", 140, signatureY + 11)
  doc.text("Date: _________________", 140, signatureY + 17)

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(128, 128, 128)
  doc.text("This is a computer-generated dispatch note. Please verify all items and amounts upon delivery.", 105, 280, { align: "center" })
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, { align: "center" })

  return doc.output("blob")
}

export async function downloadDispatchNote(order: Order): Promise<void> {
  // Prompt for dispatcher name and date
  const dispatcherName = prompt("Enter Dispatcher Name:", order.dispatcher || "")
  if (!dispatcherName) {
    alert("Dispatcher name is required to generate dispatch note.")
    return
  }
  
  const dispatchDate = prompt("Enter Dispatch Date (MM/DD/YYYY):", new Date().toLocaleDateString())
  if (!dispatchDate) {
    alert("Dispatch date is required to generate dispatch note.")
    return
  }
  
  const blob = await generateDispatchNotePDF(order, dispatcherName, dispatchDate)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Dispatch-Note-${order.orderNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
