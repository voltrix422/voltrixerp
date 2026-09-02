import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { ClientLedgerPayload } from "@/lib/client-order-ledger"
import { slugLedgerClientName } from "@/lib/client-order-ledger"

const TEAL: [number, number, number] = [31, 172, 166]
const TEAL_DARK: [number, number, number] = [22, 140, 136]
const SLATE: [number, number, number] = [51, 65, 85]
const MUTED: [number, number, number] = [100, 116, 139]
const MARGIN = 12

type JsDoc = jsPDF & { lastAutoTable?: { finalY: number } }

function fmt(n: number) {
  return (n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })
}

function money(n: number) {
  return `PKR ${fmt(n)}`
}

function safeText(s: string | null | undefined, max = 80) {
  const t = String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
  if (!t) return "—"
  if (/[\u0600-\u06FF]/.test(t)) {
    const latin = t.replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g, "…").trim()
    return (latin || "Note").slice(0, max)
  }
  return t.slice(0, max)
}

async function loadImageBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return ""
    const blob = await res.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(blob)
    })
  } catch {
    return ""
  }
}

function drawFooter(doc: JsDoc) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...TEAL)
    doc.rect(0, pageH - 9, pageW, 9, "F")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(255, 255, 255)
    doc.text("Voltrix Batteries Pvt. Ltd.  ·  Client account ledger", MARGIN, pageH - 3.6)
    doc.text(`Page ${i} of ${pages}`, pageW - MARGIN, pageH - 3.6, { align: "right" })
  }
}

function drawCards(
  doc: JsDoc,
  y: number,
  pageW: number,
  cards: { label: string; value: string; fill: [number, number, number] }[],
) {
  const gap = 2.5
  const cardW = (pageW - MARGIN * 2 - gap * (cards.length - 1)) / cards.length
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + gap)
    doc.setFillColor(...c.fill)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(x, y, cardW, 15, 1.2, 1.2, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6)
    doc.setTextColor(...MUTED)
    doc.text(c.label.toUpperCase(), x + 2.5, y + 4.5)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(...SLATE)
    doc.text(c.value, x + 2.5, y + 11)
  })
  return y + 18
}

export async function downloadClientLedgerPdf(data: ClientLedgerPayload) {
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsDoc
  const pageW = doc.internal.pageSize.getWidth()
  const { client, stats } = data

  doc.setFillColor(...TEAL_DARK)
  doc.rect(0, 0, pageW, 32, "F")

  const logo = await loadImageBase64("/logo.png")
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGIN, 6, 18, 18)
    } catch {
      /* ignore */
    }
  }
  const textX = logo ? MARGIN + 22 : MARGIN
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("VOLTRIX BATTERIES", textX, 12)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.text("Plot # 73, Street 14, Industrial Area I-9/2, Islamabad", textX, 17.5)
  doc.text("051-8731661  ·  sale@voltrixbatteries.com", textX, 22)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("CLIENT LEDGER", pageW - MARGIN, 13, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.text("Account statement  ·  Official copy", pageW - MARGIN, 19, { align: "right" })

  let y = 40
  doc.setTextColor(...SLATE)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(safeText(client.name, 52), MARGIN, y)
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  const meta: string[] = []
  if (client.company) meta.push(client.company)
  if (client.contactPerson) meta.push(client.contactPerson)
  if (client.phone) meta.push(client.phone)
  if (client.email) meta.push(client.email)
  if (client.ntn) meta.push(`NTN ${client.ntn}`)
  doc.text(meta.length ? meta.join("  ·  ") : "No extra contact details on file", MARGIN, y, {
    maxWidth: pageW - MARGIN * 2,
  })
  y += 5
  const place = [client.address, client.city, client.country].filter(Boolean).join(", ")
  if (place) {
    doc.text(place, MARGIN, y, { maxWidth: pageW - MARGIN * 2 })
    y += 5
  }
  doc.text(
    `Generated ${data.generatedAt}  ·  ${safeText(data.generatedBy, 28)}  ·  ${data.orders.length} order${data.orders.length === 1 ? "" : "s"}`,
    MARGIN,
    y,
  )
  y += 7

  y = drawCards(doc, y, pageW, [
    { label: "Billed", value: money(stats.totalOrderValue), fill: [240, 253, 250] },
    { label: "Received", value: money(stats.totalReceived), fill: [236, 253, 245] },
    { label: "Outstanding", value: money(stats.totalOutstanding), fill: [255, 247, 237] },
    { label: "Orders", value: String(data.orders.length), fill: [248, 250, 252] },
  ])

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(
    `Fully paid ${data.fullyPaidCount}  ·  Partial ${data.partialCount}  ·  On credit ${data.onCreditCount}  ·  Returned ${stats.returnedCount}`,
    MARGIN,
    y,
  )
  y += 6

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...SLATE)
  doc.text("ORDERS", MARGIN, y)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y + 1.3, MARGIN + 18, y + 1.3)
  y += 4

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: {
      fontSize: 6.5,
      cellPadding: 1.4,
      textColor: SLATE,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.5,
      cellPadding: 1.6,
    },
    alternateRowStyles: { fillColor: [248, 250, 250] },
    margin: { left: MARGIN, right: MARGIN, bottom: 14 },
    head: [["Order #", "Date", "Status", "Qty", "Total", "Paid", "Balance", "Payment"]],
    body:
      data.orders.length > 0
        ? data.orders.map((row) => [
            row.orderNumber,
            row.date,
            safeText(row.status, 28),
            safeText(row.qtyLabel, 28),
            fmt(row.billed),
            fmt(row.paid),
            fmt(row.balance),
            safeText(row.paymentLabel, 22),
          ])
        : [["—", "No orders", "", "", "", "", "", ""]],
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 20 },
      2: { cellWidth: 32 },
      3: { cellWidth: 24 },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 20 },
    },
    foot: [[
      "TOTAL",
      "",
      "",
      `${data.orders.length} order${data.orders.length === 1 ? "" : "s"}`,
      fmt(stats.totalOrderValue),
      fmt(stats.totalReceived),
      fmt(stats.totalOutstanding),
      "",
    ]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: SLATE,
      fontStyle: "bold",
      fontSize: 6.5,
    },
  })

  y = (doc.lastAutoTable?.finalY || y) + 8
  const pageH = doc.internal.pageSize.getHeight()
  if (y > pageH - 40) {
    doc.addPage()
    y = 16
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...SLATE)
  doc.text("PAYMENTS & ADJUSTMENTS", MARGIN, y)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y + 1.3, MARGIN + 42, y + 1.3)
  y += 4

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: {
      fontSize: 6.5,
      cellPadding: 1.4,
      textColor: SLATE,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: TEAL_DARK,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.5,
      cellPadding: 1.6,
    },
    alternateRowStyles: { fillColor: [248, 250, 250] },
    margin: { left: MARGIN, right: MARGIN, bottom: 14 },
    head: [["Date", "Order #", "Type", "Method", "Amount", "Status", "Notes"]],
    body:
      data.payments.length > 0
        ? data.payments.map((row) => [
            row.date,
            row.orderNumber,
            safeText(row.type, 20),
            safeText(row.method, 22),
            fmt(row.amount),
            safeText(row.status, 16),
            safeText(row.notes, 42),
          ])
        : [["—", "", "No payments recorded", "", "", "", ""]],
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 24 },
      2: { cellWidth: 26 },
      3: { cellWidth: 26 },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 20 },
    },
  })

  y = (doc.lastAutoTable?.finalY || y) + 6
  if (y > pageH - 18) {
    doc.addPage()
    y = 16
  }
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text(
    "Balance is still owed on each order. Partial = some paid, some outstanding. Credit = payment terms on credit. Refunds and cashback are listed under payments.",
    MARGIN,
    y,
    { maxWidth: pageW - MARGIN * 2 },
  )

  drawFooter(doc)
  doc.save(`Voltrix-Client-Ledger-${slugLedgerClientName(client.name)}.pdf`)
}
