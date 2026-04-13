import jsPDF from "jspdf"
import { type PurchaseOrder } from "@/lib/purchase"

export function generateGRN(po: PurchaseOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const W = 210
  const margin = 14
  const cW = W - margin * 2
  let y = margin

  const receivedStep = po.flowHistory.findLast(h => h.step === "Items Received")
  const receivedAt = receivedStep ? new Date(receivedStep.doneAt).toLocaleString() : new Date().toLocaleString()
  const grnNumber = `GRN-${po.poNumber}-${Date.now().toString().slice(-5)}`

  // ── Header ───────────────────────────────────────────────────
  doc.setFont("times", "bold")
  doc.setFontSize(20)
  doc.text("GOODS RECEIPT NOTE", margin, y)

  doc.setFont("times", "normal")
  doc.setFontSize(9)
  doc.text(grnNumber, W - margin, y, { align: "right" })

  y += 7
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  doc.line(margin, y, W - margin, y)
  y += 6

  // ── Meta ─────────────────────────────────────────────────────
  const meta = [
    { label: "PO NUMBER", value: po.poNumber },
    { label: "SUPPLIER", value: po.importedSupplierName ?? "—" },
    { label: "PSSID", value: po.pssid ?? "—" },
    { label: "RECEIVED ON", value: receivedAt },
  ]
  const colW = cW / meta.length
  meta.forEach((m, i) => {
    const x = margin + i * colW
    doc.setFont("times", "bold")
    doc.setFontSize(7)
    doc.setTextColor(60, 60, 60)
    doc.text(m.label, x, y)
    doc.setFont("times", "normal")
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    const wrapped = doc.splitTextToSize(m.value, colW - 2)
    doc.text(wrapped[0], x, y + 4)
  })
  y += 14

  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.line(margin, y, W - margin, y)
  y += 5

  // ── Items table ───────────────────────────────────────────────
  doc.setFont("times", "bold")
  doc.setFontSize(9)
  doc.text("RECEIVED ITEMS", margin, y)
  y += 4

  const cols = [
    { label: "#",          w: 8,        align: "left"  as const },
    { label: "Description",w: cW - 62,  align: "left"  as const },
    { label: "Qty",        w: 14,       align: "right" as const },
    { label: "Unit",       w: 14,       align: "left"  as const },
    { label: "Unit Price", w: 26,       align: "right" as const },
  ]
  const rowH = 5.5

  // header row
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.rect(margin, y, cW, rowH)
  let cx = margin
  cols.forEach(c => {
    doc.setFont("times", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(0)
    const tx = c.align === "right" ? cx + c.w - 1 : cx + 1
    doc.text(c.label, tx, y + 3.8, { align: c.align })
    cx += c.w
  })
  y += rowH

  let grandTotal = 0
  po.importedItems.forEach((item, idx) => {
    const lineTotal = item.unitPrice * item.qty
    grandTotal += lineTotal
    doc.setDrawColor(180)
    doc.setLineWidth(0.2)
    doc.rect(margin, y, cW, rowH)
    doc.setFont("times", "normal")
    doc.setFontSize(8)
    doc.setTextColor(0)

    const vals = [
      String(idx + 1),
      item.description,
      String(item.qty),
      item.unit,
      `PKR ${item.unitPrice.toLocaleString()}`,
    ]
    cx = margin
    cols.forEach((c, ci) => {
      const tx = c.align === "right" ? cx + c.w - 1 : cx + 1
      const text = doc.splitTextToSize(vals[ci], c.w - 2)[0]
      doc.text(text, tx, y + 3.8, { align: c.align })
      cx += c.w
    })
    y += rowH
  })

  // total row
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.rect(margin, y, cW, rowH)
  doc.setFont("times", "bold")
  doc.setFontSize(8.5)
  doc.text("TOTAL", margin + 1, y + 3.8)
  doc.text(`PKR ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + cW - 1, y + 3.8, { align: "right" })
  y += rowH + 6

  // ── Payments ─────────────────────────────────────────────────
  if ((po.payments ?? []).length > 0) {
    doc.setFont("times", "bold")
    doc.setFontSize(9)
    doc.setTextColor(0)
    doc.text("PAYMENT SUMMARY", margin, y)
    y += 4

    const totalPaid = po.payments.reduce((s, p) => s + Number(p.amount), 0)
    po.payments.forEach(p => {
      doc.setFont("times", "normal")
      doc.setFontSize(8)
      doc.text(`PKR ${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}  ·  ${p.method}  ·  ${p.date}${p.notes ? "  ·  " + p.notes : ""}`, margin, y)
      y += 4
    })
    doc.setFont("times", "bold")
    doc.setFontSize(8.5)
    doc.text(`Total Paid: PKR ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin, y)
    y += 8
  }

  // ── Signature lines ───────────────────────────────────────────
  const sigY = Math.max(y + 10, 240)
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.line(margin, sigY, margin + 50, sigY)
  doc.line(W - margin - 50, sigY, W - margin, sigY)
  doc.setFont("times", "normal")
  doc.setFontSize(7)
  doc.text("Received By", margin, sigY + 3.5)
  doc.text("Authorized Signature", W - margin - 50, sigY + 3.5)

  // ── Footer ────────────────────────────────────────────────────
  doc.setDrawColor(180)
  doc.setLineWidth(0.3)
  doc.line(margin, 283, W - margin, 283)
  doc.setFont("times", "normal")
  doc.setFontSize(7)
  doc.setTextColor(100)
  doc.text("VoltrixERP · Goods Receipt Note", margin, 288)
  doc.text(`Generated ${new Date().toLocaleString()}`, W - margin, 288, { align: "right" })

  doc.save(`${grnNumber}.pdf`)
}
