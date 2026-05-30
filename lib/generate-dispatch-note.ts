import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  getAllocationsForOrderItem,
  orderHasSerialAllocations,
} from "@/lib/order-fulfillment-serials"
import type { Order, OrderItem } from "@/lib/orders"
import { resolveOrderItemModel } from "@/lib/orders"

type DispatchNoteOptions = {
  showPricing?: boolean
}

// ── Font helpers (client-side: fetch from /public) ─────────────────────────
async function loadFontBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return ""
    const buf = await res.arrayBuffer()
    let binary = ""
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  } catch { return "" }
}

async function registerGeist(doc: jsPDF): Promise<string> {
  const [reg, bold] = await Promise.all([
    loadFontBase64("/Geist-Regular.ttf"),
    loadFontBase64("/Geist-Bold.ttf"),
  ])
  if (reg)  { doc.addFileToVFS("Geist-Regular.ttf", reg);  doc.addFont("Geist-Regular.ttf", "Geist", "normal") }
  if (bold) { doc.addFileToVFS("Geist-Bold.ttf",    bold); doc.addFont("Geist-Bold.ttf",    "Geist", "bold")   }
  return reg ? "Geist" : "helvetica"
}

function itemLabel(item: OrderItem, model?: string): string {
  const m = model || resolveOrderItemModel(item)
  if (m && m.trim() && m.trim().toLowerCase() !== item.description.trim().toLowerCase()) {
    return `${item.description}\nModel: ${m}`
  }
  return item.description
}

/** One table row per scanned unit when serials exist — easier to read on paper. */
function buildDispatchTableRows(
  order: Order,
  showSerialCol: boolean,
  showPricing: boolean,
): string[][] {
  const rows: string[][] = []
  let rowNum = 0

  for (const item of order.items) {
    const allocations = showSerialCol ? getAllocationsForOrderItem(order, item.id) : []
    const serials = allocations.map((a) => a.serialNumber)
    const model = allocations[0]?.model || resolveOrderItemModel(item) || ""

    if (serials.length > 0) {
      for (const sn of serials) {
        rowNum += 1
        const base = [
          `${rowNum}`,
          itemLabel(item, model),
          "1",
          item.unit || "pcs",
        ]
        if (showSerialCol) base.push(sn)
        if (showPricing) {
          base.push(
            `PKR ${Number(item.unitPrice).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
            `PKR ${Number(item.unitPrice).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
          )
        }
        rows.push(base)
      }
      continue
    }

    rowNum += 1
    const base = [
      `${rowNum}`,
      itemLabel(item, model),
      item.qty.toString(),
      item.unit || "pcs",
    ]
    if (showSerialCol) base.push("—")
    if (showPricing) {
      base.push(
        `PKR ${Number(item.unitPrice).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
        `PKR ${(Number(item.unitPrice) * Number(item.qty)).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      )
    }
    rows.push(base)
  }

  return rows
}

export async function generateDispatchNotePDF(
  order: Order,
  dispatcherName?: string,
  dispatchDate?: string,
  options: DispatchNoteOptions = {}
): Promise<Blob> {
  const showPricing = options.showPricing ?? false
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const FONT = await registerGeist(doc)
  doc.setFont(FONT, "normal")
  const taxAmount = Number(order.tax || 0)
  const hasTax = Math.abs(taxAmount) > 0.004

  // ── Palette ────────────────────────────────────────────────────────────────
  const teal:     [number,number,number] = [26, 159, 154]
  const tealDark: [number,number,number] = [18, 120, 116]
  const white:    [number,number,number] = [255, 255, 255]
  const black:    [number,number,number] = [30, 30, 30]
  const darkGray: [number,number,number] = [80, 80, 80]
  const lightGray:[number,number,number] = [230, 230, 230]
  const lightBg:  [number,number,number] = [247, 250, 250]
  const rowAlt:   [number,number,number] = [245, 250, 250]
  const red:      [number,number,number] = [200, 50, 50]

  const pageW = 210
  const pageH = 297
  const mL = 14
  const mR = 14

  // ── Header band ────────────────────────────────────────────────────────────
  doc.setFillColor(...teal)
  doc.rect(0, 0, pageW, 42, "F")

  // Logo
  try {
    const logoBlob = await fetch("/logo.png").then(r => r.blob())
    const logoBase64 = await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(logoBlob)
    })
    doc.addImage(logoBase64, "PNG", mL, 6, 28, 28)
  } catch {}

  // Company info
  doc.setTextColor(...white)
  doc.setFont(FONT, "bold")
  doc.setFontSize(15)
  doc.text("VOLTRIX BATTERIES", mL + 32, 14)
  doc.setFont(FONT, "normal")
  doc.setFontSize(7.5)
  doc.text("Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", mL + 32, 20)
  doc.text("Phone: 051-8731661  |  Mobile: +92 303 4927779", mL + 32, 25)
  doc.text("Email: info@voltrixbatteries.com  |  www.voltrixbatteries.com", mL + 32, 30)

  // DISPATCH NOTE label (top-right)
  doc.setFont(FONT, "bold")
  doc.setFontSize(20)
  doc.text("DISPATCH NOTE", pageW - mR, 19, { align: "right" })
  doc.setFontSize(8.5)
  doc.setFont(FONT, "normal")
  doc.text(`DN-${order.orderNumber}`, pageW - mR, 26, { align: "right" })

  // ── Meta band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...tealDark)
  doc.rect(0, 42, pageW, 16, "F")

  const dispDate = dispatchDate || new Date().toLocaleDateString("en-PK")
  const delDate  = order.deliveryDate
    ? new Date(order.deliveryDate).toLocaleDateString("en-PK")
    : "—"

  const metaItems = [
    { label: "ORDER #",       value: order.orderNumber },
    { label: "DISPATCH DATE", value: dispDate },
    { label: "DELIVERY DATE", value: delDate },
    { label: "STATUS",        value: order.status.replace(/_/g, " ").toUpperCase() },
    { label: "DISPATCHER",    value: dispatcherName || order.dispatcher || "—" },
  ]
  const colW = (pageW - mL - mR) / metaItems.length
  metaItems.forEach((m, i) => {
    const x = mL + i * colW
    doc.setFont(FONT, "bold")
    doc.setFontSize(6.5)
    doc.setTextColor(180, 230, 228)
    doc.text(m.label, x, 48)
    doc.setFont(FONT, "normal")
    doc.setFontSize(8)
    doc.setTextColor(...white)
    doc.text(m.value, x, 54)
  })

  // ── Client + Delivery Address ──────────────────────────────────────────────
  let y = 66
  doc.setTextColor(...teal)
  doc.setFont(FONT, "bold")
  doc.setFontSize(8)
  doc.text("DELIVER TO", mL, y)
  doc.setDrawColor(...teal)
  doc.setLineWidth(0.4)
  doc.line(mL, y + 1, mL + 26, y + 1)

  y += 6
  doc.setTextColor(...black)
  doc.setFont(FONT, "bold")
  doc.setFontSize(12)
  doc.text(order.clientName || "—", mL, y)

  if (order.deliveryAddress) {
    y += 5
    doc.setFont(FONT, "normal")
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    const addrLines = doc.splitTextToSize(order.deliveryAddress, 90)
    doc.text(addrLines, mL, y)
    y += addrLines.length * 4.5
  }

  // ── Items table ────────────────────────────────────────────────────────────
  y = Math.max(y + 8, 92)

  const showSerialCol = orderHasSerialAllocations(order)

  const tableData = buildDispatchTableRows(order, showSerialCol, showPricing)

  const dispatchHead = showPricing
    ? ["#", "ITEM DESCRIPTION", "QTY", "UNIT", "UNIT PRICE", "TOTAL"]
    : ["#", "ITEM DESCRIPTION", "QTY", "UNIT"]
  if (showSerialCol) {
    const insertAt = 4
    dispatchHead.splice(insertAt, 0, "SERIAL NO.")
  }

  const serialColIdx = showSerialCol ? 4 : -1

  autoTable(doc, {
    startY: y,
    head: [dispatchHead],
    body: tableData,
    theme: "plain",
    headStyles: {
      fillColor: teal,
      textColor: white,
      fontStyle: "bold",
      fontSize: 8.5,
      font: FONT,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: black,
      font: FONT,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      valign: "middle",
    },
    alternateRowStyles: { fillColor: rowAlt },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: showSerialCol ? 58 : "auto" },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      ...(showSerialCol
        ? {
            [serialColIdx]: {
              cellWidth: 42,
              fontSize: 8,
              halign: "left" as const,
              overflow: "linebreak" as const,
            },
          }
        : {}),
      ...(showPricing
        ? {
            [showSerialCol ? 5 : 4]: { cellWidth: 30, halign: "right" as const },
            [showSerialCol ? 6 : 5]: {
              cellWidth: 30,
              halign: "right" as const,
              fontStyle: "bold" as const,
            },
          }
        : {}),
    },
    ...(showPricing ? {
      foot: [[
        { content: "SUBTOTAL", colSpan: 5, styles: { halign: "right", fontStyle: "bold", fillColor: lightBg, textColor: black } },
        { content: `PKR ${Number(order.subtotal).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, styles: { halign: "right", fontStyle: "bold", fillColor: lightBg, textColor: black } },
      ]],
    } : {}),
    margin: { left: mL, right: mR },
    tableLineColor: lightGray,
    tableLineWidth: 0.3,
  })

  y = (doc as any).lastAutoTable.finalY + 8

  // ── Info section ────────────────────────────────────────────────────────────
  const leftW  = showPricing ? 88 : pageW - mL - mR
  const rightW = 82
  const rightX = pageW - mR - rightW
  const boxH   = 58

  // Left box — Order Information
  doc.setFillColor(...lightBg)
  doc.setDrawColor(...lightGray)
  doc.setLineWidth(0.3)
  doc.roundedRect(mL, y, leftW, boxH, 2, 2, "FD")

  doc.setFillColor(...teal)
  doc.roundedRect(mL, y, leftW, 8, 2, 2, "F")
  doc.rect(mL, y + 4, leftW, 4, "F") // flatten bottom corners of header
  doc.setFont(FONT, "bold")
  doc.setFontSize(8)
  doc.setTextColor(...white)
  doc.text("ORDER INFORMATION", mL + leftW / 2, y + 5.5, { align: "center" })

  const totalQty = order.items.reduce((s, i) => s + i.qty, 0)
  const totalSerials = (order.fulfillmentSerialAllocations ?? []).length
  const infoRows = [
    ["Total Line Items:", `${order.items.length}`],
    ["Total Quantity:", `${totalQty} units`],
    ...(totalSerials > 0 ? [["Serial Numbers:", `${totalSerials} scanned`]] : []),
    ["Order Status:", order.status.replace(/_/g, " ").toUpperCase()],
    ["Created By:", order.createdBy || "—"],
  ]
  doc.setFontSize(8.5)
  infoRows.forEach(([label, val], i) => {
    const ry = y + 14 + i * 8
    doc.setFont(FONT, "bold")
    doc.setTextColor(...darkGray)
    doc.text(label, mL + 4, ry)
    doc.setFont(FONT, "normal")
    doc.setTextColor(...black)
    doc.text(val, mL + leftW - 4, ry, { align: "right" })
  })

  if (showPricing) {
    // Right box — Payment Summary
    const discountValue = order.discountValue ?? (
      order.discountIsPercentage
        ? (order.subtotal * (order.discount || 0) / 100)
        : (order.discount || 0)
    )
    const transportVal = order.transportCostValue ?? order.transportCost ?? 0
    const otherVal     = order.otherCostValue ?? order.otherCost ?? 0

    doc.setFillColor(...lightBg)
    doc.setDrawColor(...lightGray)
    doc.roundedRect(rightX, y, rightW, boxH, 2, 2, "FD")

    doc.setFillColor(...teal)
    doc.roundedRect(rightX, y, rightW, 8, 2, 2, "F")
    doc.rect(rightX, y + 4, rightW, 4, "F")
    doc.setFont(FONT, "bold")
    doc.setFontSize(8)
    doc.setTextColor(...white)
    doc.text("PAYMENT SUMMARY", rightX + rightW / 2, y + 5.5, { align: "center" })

    type PRow = { label: string; value: string; color?: [number, number, number] }
    const payRows: PRow[] = [
      { label: "Subtotal:", value: `PKR ${Number(order.subtotal).toLocaleString("en-PK", { minimumFractionDigits: 2 })}` },
    ]
    if (discountValue > 0) {
      payRows.push({
        label: `Discount${order.discountIsPercentage ? ` (${order.discount}%)` : ""}:`,
        value: `-PKR ${Number(discountValue).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
        color: red,
      })
    }
    if (hasTax) {
      payRows.push({ label: `Tax (${order.taxPercent}%):`, value: `PKR ${taxAmount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}` })
    }
    if (transportVal > 0) {
      payRows.push({ label: `${order.transportLabel || "Transport"}:`, value: `PKR ${Number(transportVal).toLocaleString("en-PK", { minimumFractionDigits: 2 })}` })
    }
    if (otherVal > 0) {
      payRows.push({ label: `${order.otherCostLabel || "Other"}:`, value: `PKR ${Number(otherVal).toLocaleString("en-PK", { minimumFractionDigits: 2 })}` })
    }

    let ry2 = y + 14
    payRows.forEach(row => {
      doc.setFont(FONT, "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...(row.color || darkGray))
      doc.text(row.label, rightX + 4, ry2)
      doc.setTextColor(...(row.color || black))
      doc.text(row.value, rightX + rightW - 4, ry2, { align: "right" })
      ry2 += 7
    })

    const totalY = y + boxH - 12
    doc.setFillColor(...teal)
    doc.roundedRect(rightX + 2, totalY - 3, rightW - 4, 10, 1.5, 1.5, "F")
    doc.setFont(FONT, "bold")
    doc.setFontSize(10)
    doc.setTextColor(...white)
    doc.text("TOTAL", rightX + 6, totalY + 4)
    doc.text(`PKR ${Number(order.total).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, rightX + rightW - 6, totalY + 4, { align: "right" })
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  y += boxH + 8
  if (order.notes) {
    doc.setFillColor(...lightBg)
    doc.setDrawColor(...lightGray)
    doc.roundedRect(mL, y, pageW - mL - mR, 16, 2, 2, "FD")
    doc.setFont(FONT, "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(...darkGray)
    doc.text("NOTES", mL + 4, y + 5)
    doc.setFont(FONT, "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...black)
    const noteLines = doc.splitTextToSize(order.notes, pageW - mL - mR - 8)
    doc.text(noteLines.slice(0, 2), mL + 4, y + 11)
    y += 22
  }

  // ── Signature section ──────────────────────────────────────────────────────
  y += 4
  const sigBoxW = (pageW - mL - mR - 10) / 2
  const recvName0 = order.fulfillmentReceiverName?.trim()
  const recvCnic0 = order.fulfillmentReceiverCnic?.trim()
  const recvVeh0 = order.fulfillmentVehicleNumber?.trim()
  const sigBoxH = recvName0 || recvCnic0 || recvVeh0 ? 34 : 28
  const recvDateStr = order.fulfillmentDate
    ? new Date(order.fulfillmentDate).toLocaleDateString("en-PK")
    : dispDate

  // Dispatcher box
  doc.setFillColor(...lightBg)
  doc.setDrawColor(...lightGray)
  doc.roundedRect(mL, y, sigBoxW, sigBoxH, 2, 2, "FD")
  doc.setFillColor(...teal)
  doc.roundedRect(mL, y, sigBoxW, 7, 2, 2, "F")
  doc.rect(mL, y + 3, sigBoxW, 4, "F")
  doc.setFont(FONT, "bold")
  doc.setFontSize(8)
  doc.setTextColor(...white)
  doc.text("DISPATCHER", mL + sigBoxW / 2, y + 5, { align: "center" })

  doc.setFont(FONT, "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...black)
  doc.text(`Name: ${dispatcherName || order.dispatcher || "—"}`, mL + 4, y + 14)
  doc.text(`Date: ${dispDate}`, mL + 4, y + 21)

  // Receiver box
  const rx = mL + sigBoxW + 10
  doc.setFillColor(...lightBg)
  doc.setDrawColor(...lightGray)
  doc.roundedRect(rx, y, sigBoxW, sigBoxH, 2, 2, "FD")
  doc.setFillColor(...teal)
  doc.roundedRect(rx, y, sigBoxW, 7, 2, 2, "F")
  doc.rect(rx, y + 3, sigBoxW, 4, "F")
  doc.setFont(FONT, "bold")
  doc.setFontSize(8)
  doc.setTextColor(...white)
  doc.text("RECEIVER", rx + sigBoxW / 2, y + 5, { align: "center" })

  doc.setFont(FONT, "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...black)
  const recvLineY = y + 12
  if (recvName0) {
    doc.text(`Name: ${recvName0}`, rx + 4, recvLineY)
  } else {
    doc.setTextColor(...darkGray)
    doc.text("Name:", rx + 4, recvLineY)
    doc.setDrawColor(...darkGray)
    doc.setLineWidth(0.3)
    doc.line(rx + 16, recvLineY, rx + sigBoxW - 4, recvLineY)
    doc.setTextColor(...black)
  }
  if (recvCnic0) {
    doc.setFontSize(7.5)
    doc.text(`CNIC: ${recvCnic0}`, rx + 4, y + 17)
  }
  if (recvVeh0) {
    doc.setFontSize(7.5)
    doc.text(`Vehicle: ${recvVeh0}`, rx + 4, recvCnic0 ? y + 22 : y + 17)
  }
  doc.setFontSize(8)
  doc.setTextColor(...darkGray)
  doc.text(`Date: ${recvDateStr}`, rx + 4, y + (recvCnic0 && recvVeh0 ? 27 : recvCnic0 || recvVeh0 ? 22 : 21))

  // Signature lines
  doc.setDrawColor(...lightGray)
  doc.setLineWidth(0.4)
  doc.line(mL + 4, y + sigBoxH - 2, mL + sigBoxW - 4, y + sigBoxH - 2)
  doc.line(rx + 4, y + sigBoxH - 2, rx + sigBoxW - 4, y + sigBoxH - 2)

  // ── Footer ─────────────────────────────────────────────────────────────────
  doc.setFillColor(...teal)
  doc.rect(0, pageH - 18, pageW, 18, "F")
  doc.setFont(FONT, "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(...white)
  doc.text(showPricing ? "Please verify all items and amounts upon delivery." : "Please verify all delivered items upon delivery.", pageW / 2, pageH - 11, { align: "center" })
  doc.setFont(FONT, "normal")
  doc.setFontSize(7)
  doc.setTextColor(200, 235, 234)
  doc.text(
    `This is a computer-generated dispatch note.  |  Generated on ${new Date().toLocaleString()}`,
    pageW / 2, pageH - 5, { align: "center" }
  )

  return doc.output("blob")
}

export async function downloadDispatchNote(order: Order): Promise<void> {
  const dispatcherName = prompt("Enter Dispatcher Name:", order.dispatcher || "")
  if (!dispatcherName) {
    alert("Dispatcher name is required.")
    return
  }
  const dispatchDate = prompt("Enter Dispatch Date:", new Date().toLocaleDateString())
  if (!dispatchDate) {
    alert("Dispatch date is required.")
    return
  }

  let updatedOrder: Order = { ...order, dispatcher: dispatcherName, status: "delivered" }
  const { applySalesCommissionOnDelivery } = await import("@/lib/sales-commission")
  updatedOrder = await applySalesCommissionOnDelivery(updatedOrder)
  await import("@/lib/orders").then(m => m.saveOrder(updatedOrder))

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
