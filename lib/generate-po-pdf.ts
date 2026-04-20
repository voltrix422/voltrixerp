import jsPDF from "jspdf"
import { type PurchaseOrder, type Supplier, STATUS_LABELS } from "@/lib/purchase"

export async function generatePOPdf(po: PurchaseOrder, suppliers: (Supplier | undefined)[], includeSuppliers: boolean = true) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const W = 210
  const margin = 12
  const contentW = W - margin * 2

  let y = margin

  // ── Header ───────────────────────────────────────────────────
  doc.setFont("times", "bold")
  doc.setFontSize(20)
  doc.setTextColor(0, 0, 0)
  doc.text("PURCHASE ORDER", margin, y)
  
  doc.setFont("times", "normal")
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(po.poNumber || "N/A", W - margin, y, { align: "right" })
  
  y += 8
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(margin, y, W - margin, y)
  y += 6

  // ── Meta Information ─────────────────────────────────────────
  const metaItems = [
    { label: "DATE", value: po.createdAt ? new Date(po.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "N/A" },
    { label: "CREATED BY", value: po.createdBy || "N/A" },
    { label: "TYPE", value: po.type ? po.type.charAt(0).toUpperCase() + po.type.slice(1) : "N/A" },
    { label: "STATUS", value: STATUS_LABELS[po.status] || "N/A" },
    ...(po.deliveryDate ? [{ label: "REQUIRED BY", value: po.deliveryDate }] : []),
  ]

  const colW = contentW / metaItems.length
  metaItems.forEach((m, i) => {
    const x = margin + i * colW
    doc.setFont("times", "bold")
    doc.setFontSize(7)
    doc.setTextColor(60, 60, 60)
    doc.text(m.label, x, y)
    doc.setFont("times", "normal")
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.text(m.value, x, y + 4)
  })

  y += 12

  // ── Suppliers section ────────────────────────────────────────
  if (includeSuppliers && suppliers.length > 0) {
    suppliers.forEach((supplier, idx) => {
      if (!supplier) return
      
      doc.setFont("times", "bold")
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      doc.text("SUPPLIER", margin, y)
      
      doc.setFont("times", "bold")
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.text(supplier.name || "N/A", margin, y + 4)
      
      let sy = y + 8
      doc.setFont("times", "normal")
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      
      if (supplier.company) { doc.text(supplier.company, margin, sy); sy += 3.5 }
      if (supplier.contact) { doc.text(supplier.contact, margin, sy); sy += 3.5 }
      if (supplier.email) { doc.text(supplier.email, margin, sy); sy += 3.5 }
      if (supplier.address) {
        const wrapped = doc.splitTextToSize(supplier.address, contentW - 4)
        doc.text(wrapped, margin, sy)
        sy += wrapped.length * 3.5
      }
      
      y = sy + 3
      
      if (idx < suppliers.length - 1) {
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.2)
        doc.line(margin, y, W - margin, y)
        y += 3
      }
    })
    
    y += 2
  }

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(margin, y, W - margin, y)
  y += 5

  // ── Items table ───────────────────────────────────────────────
  doc.setFont("times", "bold")
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text("ORDER ITEMS", margin, y)
  y += 4

  // Table header
  const colWidths = [8, contentW - 35, 13, 14]
  const colXs = [margin, margin + 8, margin + contentW - 27, margin + contentW - 14]
  const rowH = 5

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.4)
  doc.rect(margin, y, contentW, rowH)

  const headers = ["#", "Description", "Qty", "Unit"]
  const aligns: ("left" | "right")[] = ["left", "left", "right", "left"]
  headers.forEach((h, i) => {
    doc.setFont("times", "bold")
    doc.setFontSize(7)
    doc.setTextColor(0, 0, 0)
    const tx = aligns[i] === "right" ? colXs[i] + colWidths[i] - 1 : colXs[i] + 1
    doc.text(h, tx, y + 3.5, { align: aligns[i] })
  })
  y += rowH

  // Table rows
  po.items.forEach((item, idx) => {
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.rect(margin, y, contentW, rowH)

    doc.setFont("times", "normal")
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)

    doc.text(String(idx + 1), colXs[0] + 1, y + 3.5)

    const desc = doc.splitTextToSize(item.description || "N/A", colWidths[1] - 2)[0]
    doc.text(desc, colXs[1] + 1, y + 3.5)

    doc.text(String(item.qty), colXs[2] + colWidths[2] - 1, y + 3.5, { align: "right" })

    doc.text(item.unit || "N/A", colXs[3] + 1, y + 3.5)

    y += rowH
  })

  // Table footer note
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.4)
  doc.line(margin, y, W - margin, y)
  y += 3
  
  doc.setFont("times", "italic")
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text("Prices to be confirmed by supplier upon receipt of this order.", margin, y + 1.5)
  y += 6

  // ── Notes ─────────────────────────────────────────────────────
  if (po.notes) {
    doc.setFont("times", "bold")
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text("NOTES & TERMS", margin, y)
    y += 3
    
    doc.setFont("times", "normal")
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    const wrapped = doc.splitTextToSize(po.notes, contentW)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 3.5 + 2
  }

  // ── Admin note ────────────────────────────────────────────────
  if (po.adminNote) {
    doc.setFont("times", "bold")
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text("ADMIN NOTE", margin, y)
    y += 3
    
    doc.setFont("times", "normal")
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    const wrapped = doc.splitTextToSize(po.adminNote, contentW)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 3.5 + 2
  }

  // ── Signature lines ────────────────────────────────────────────
  const sigY = Math.max(y + 6, 240)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.4)
  doc.line(margin, sigY, margin + 45, sigY)
  doc.line(W - margin - 45, sigY, W - margin, sigY)

  doc.setFont("times", "normal")
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)
  doc.text("Authorized Signature", margin, sigY + 3)
  doc.text("Supplier Acknowledgement", W - margin - 45, sigY + 3)

  // ── Footer ────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, 283, W - margin, 283)
  
  doc.setFont("times", "normal")
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text("VoltrixERP · Enterprise Resource Planning", margin, 288)
  doc.text(`Generated ${new Date().toLocaleString()}`, W - margin, 288, { align: "right" })

  doc.save(`${po.poNumber}-${Date.now()}.pdf`)
}
