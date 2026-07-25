import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  calculateLandedCost,
  chargeAmountPkr,
  formatPkr,
  importDisplayName,
  parsePsids,
  STATUS_LABELS,
  type CustomsDutyEntry,
  type ImportShipment,
} from "@/lib/import-shipment"

function money(n: number) {
  return Math.round(n || 0).toLocaleString("en-PK")
}

function dutyAmountPkr(d: CustomsDutyEntry, fx: number): number {
  const cur = (d.currency || "PKR").toUpperCase()
  if (cur === "PKR") return Number(d.amount) || 0
  return (Number(d.amount) || 0) * (Number(fx) || 0)
}

function shortItem(desc: string, max = 42) {
  const t = (desc || "—").trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/**
 * Compact one-page import cost report: qty, duties, GST, allocated, totals.
 */
export async function downloadImportShipmentReportPDF(shipment: ImportShipment) {
  const fx = Number(shipment.fxRate) || 0
  const summary = calculateLandedCost(shipment)
  const duties = shipment.customsDuties || []
  const charges = shipment.charges || []
  const containers = shipment.containers || []
  const items = shipment.items || []

  const gstTotal = charges
    .filter(c => c.category === "gst_on_charges")
    .reduce((s, c) => s + chargeAmountPkr(c, fx), 0)
  const cessTotal = charges
    .filter(c => c.category === "cess" || (c.fromDutyId && duties.find(d => d.id === c.fromDutyId)?.category === "cess"))
    .reduce((s, c) => s + chargeAmountPkr(c, fx), 0)

  // Prefer duty-sourced cess if charges not yet synced
  const cessFromDuties = duties
    .filter(d => d.category === "cess")
    .reduce((s, d) => s + dutyAmountPkr(d, fx), 0)
  const cessShared = Math.max(cessTotal, cessFromDuties)

  const sharedTotal = summary.sharedChargesPkr || 0

  const dutyCatsGst = new Set(["sales_tax"])
  const dutyCatsCustoms = new Set([
    "customs_duty",
    "additional_customs_duty",
    "duty_tax_customs_partial",
    "income_tax",
    "fed",
    "regulatory_fee",
    "psw_fee",
    "other",
  ])

  type Row = {
    item: string
    qty: number
    product: number
    customsDuty: number
    itemGst: number
    otherDuty: number
    allocGst: number
    allocCess: number
    allocatedOther: number
    direct: number
    total: number
    unit: number
  }

  const rows: Row[] = summary.lines.map(line => {
    const itemDuties = duties.filter(d => d.itemId === line.itemId && d.category !== "cess")
    let customsDuty = 0
    let itemGst = 0
    let otherDuty = 0
    for (const d of itemDuties) {
      const amt = dutyAmountPkr(d, fx)
      if (dutyCatsGst.has(d.category)) itemGst += amt
      else if (dutyCatsCustoms.has(d.category) || d.category === "customs_duty") {
        if (d.category === "customs_duty" || d.category === "additional_customs_duty" || d.category === "duty_tax_customs_partial") {
          customsDuty += amt
        } else {
          otherDuty += amt
        }
      } else {
        otherDuty += amt
      }
    }

    const allocShare = sharedTotal > 0 ? (line.allocatedChargesPkr || 0) / sharedTotal : 0
    const allocGst = gstTotal * allocShare
    const allocCess = cessShared * allocShare
    const allocatedOther = Math.max(0, (line.allocatedChargesPkr || 0) - allocGst - allocCess)

    return {
      item: shortItem(line.description || items.find(i => i.id === line.itemId)?.description || "Item"),
      qty: line.qty,
      product: line.productCostPkr,
      customsDuty,
      itemGst,
      otherDuty,
      allocGst,
      allocCess,
      allocatedOther,
      direct: line.directChargesPkr,
      total: line.totalLandedPkr,
      unit: line.unitLandedCost,
    }
  })

  // Totals from duties (including shared cess)
  const totalItemDuties = duties
    .filter(d => d.category !== "cess")
    .reduce((s, d) => s + dutyAmountPkr(d, fx), 0)
  const totalItemGst = duties
    .filter(d => d.category === "sales_tax")
    .reduce((s, d) => s + dutyAmountPkr(d, fx), 0)
  const totalCustoms = duties
    .filter(d =>
      d.category === "customs_duty"
      || d.category === "additional_customs_duty"
      || d.category === "duty_tax_customs_partial",
    )
    .reduce((s, d) => s + dutyAmountPkr(d, fx), 0)

  const landingCharges = charges
    .filter(c => !c.fromDutyId && c.category !== "gst_on_charges" && c.category !== "cess")
    .reduce((s, c) => s + chargeAmountPkr(c, fx), 0)

  const otherItemDuties = Math.max(0, totalItemDuties - totalCustoms - totalItemGst)
  /** CD/ACD + item GST/ST + other item duties + shared cess */
  const totalPswDutiesAndCess = totalCustoms + totalItemGst + otherItemDuties + cessShared

  const title = importDisplayName(shipment)
  const psids = parsePsids(shipment).filter(Boolean)

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
  const ink: [number, number, number] = [30, 41, 59]
  const mute: [number, number, number] = [100, 116, 139]
  const head: [number, number, number] = [15, 23, 42]
  const mL = 8
  const mR = 8
  const pageW = 210

  // Compact header bar
  doc.setFillColor(...head)
  doc.rect(0, 0, pageW, 18, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Import landed cost report", mL, 7)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(`${title}  ·  ${shipment.shipmentNumber}`, mL, 12.5)
  doc.text(new Date().toLocaleString("en-PK"), pageW - mR, 12.5, { align: "right" })

  let y = 22
  doc.setTextColor(...ink)
  doc.setFontSize(7.5)
  const meta = [
    `Supplier: ${shipment.supplierName || "—"}`,
    `FX: ${shipment.currency || "USD"} @ ${fx || "—"}`,
    `B/L: ${shipment.blNumber || "—"}`,
    `GD: ${shipment.gdNumber || "—"}`,
    `Status: ${STATUS_LABELS[shipment.status] || shipment.status}`,
    `PSID: ${psids.length ? psids.join(", ") : "—"}`,
    `Containers: ${containers.length}  ·  Items: ${items.length}`,
    `Allocate: ${summary.allocationMethod || "by_value"}`,
  ]
  doc.text(meta.slice(0, 4).join("   |   "), mL, y)
  y += 3.5
  doc.setTextColor(...mute)
  doc.text(meta.slice(4).join("   |   "), mL, y)
  y += 4

  // Summary strip
  autoTable(doc, {
    startY: y,
    head: [["Product", "PSW duties+cess (CD/ACD+GST+other+cess)", "Landing chg", "GST on chg", "Grand landed"]],
    body: [[
      money(summary.productTotalPkr),
      money(totalPswDutiesAndCess),
      money(landingCharges),
      money(gstTotal),
      money(summary.grandTotalPkr),
    ]],
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1.2, halign: "right", textColor: ink, lineColor: [203, 213, 225], lineWidth: 0.1 },
    headStyles: { fillColor: head, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 6 },
    margin: { left: mL, right: mR },
    tableWidth: pageW - mL - mR,
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3.5
  doc.setTextColor(...ink)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text("Per-item breakdown", mL, y)
  y += 1.5

  const body = rows.length > 0
    ? rows.map(r => [
        r.item,
        String(r.qty),
        money(r.product),
        money(r.customsDuty),
        money(r.itemGst),
        money(r.otherDuty),
        money(r.allocGst),
        money(r.allocCess),
        money(r.allocatedOther),
        money(r.total),
        money(r.unit),
      ])
    : [["No invoice items", "", "", "", "", "", "", "", "", "", ""]]

  autoTable(doc, {
    startY: y,
    head: [[
      "Item",
      "Qty",
      "Product",
      "CD/ACD",
      "GST/ST",
      "Other duty",
      "GST chg",
      "Cess",
      "Other shared",
      "Total",
      "Unit",
    ]],
    body,
    theme: "striped",
    styles: { fontSize: 6, cellPadding: 1, textColor: ink, lineColor: [226, 232, 240], lineWidth: 0.1, overflow: "linebreak" },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold", fontSize: 5.5, halign: "center" },
    columnStyles: {
      0: { cellWidth: 38, halign: "left" },
      1: { cellWidth: 8, halign: "right" },
      2: { cellWidth: 16, halign: "right" },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 14, halign: "right" },
      5: { cellWidth: 14, halign: "right" },
      6: { cellWidth: 12, halign: "right" },
      7: { cellWidth: 12, halign: "right" },
      8: { cellWidth: 16, halign: "right" },
      9: { cellWidth: 16, halign: "right" },
      10: { cellWidth: 14, halign: "right" },
    },
    margin: { left: mL, right: mR },
    tableWidth: pageW - mL - mR,
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3

  // Paid / totals block
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(...ink)
  doc.text("Totals paid / landed (PKR)", mL, y)
  y += 1.5

  autoTable(doc, {
    startY: y,
    head: [["Component", "Amount PKR"]],
    body: [
      ["Product (invoice × FX)", money(summary.productTotalPkr)],
      [
        "Total PSW duties & cess (CD/ACD + GST/ST + other + cess)",
        money(totalPswDutiesAndCess),
      ],
      ["Landing charges (freight, THC, transport…)", money(landingCharges)],
      ["GST on landing charges", money(gstTotal)],
      ["GRAND TOTAL LANDED", money(summary.grandTotalPkr)],
    ],
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1.1, textColor: ink, lineColor: [203, 213, 225], lineWidth: 0.1 },
    headStyles: { fillColor: head, textColor: 255, fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 120, halign: "left" },
      1: { cellWidth: 40, halign: "right", fontStyle: "bold" },
    },
    margin: { left: mL, right: mR },
    didParseCell(data) {
      if (data.section === "body" && (data.row.index === 1 || data.row.index === 4)) {
        data.cell.styles.fillColor = [241, 245, 249]
        data.cell.styles.fontStyle = "bold"
      }
    },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3
  doc.setFont("helvetica", "normal")
  doc.setFontSize(5.5)
  doc.setTextColor(...mute)
  const note =
    "Grand total = Product + PSW duties & cess + Landing charges + GST on landing charges (no double-count). " +
    "PSW duties & cess = CD/ACD + item GST/ST + other item duties + shared cess. " +
    "Landing = DO/B/L, THC, transport, clearing, etc. (does not include cess or GST-on-charges)."
  const split = doc.splitTextToSize(note, pageW - mL - mR)
  doc.text(split, mL, y)

  // Keep to one page when possible — if overflow, leave as-is (autotable may add page)
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(5.5)
    doc.setTextColor(...mute)
    doc.text(
      `Page ${i}/${pageCount}  ·  ${formatPkr(summary.grandTotalPkr)}`,
      pageW / 2,
      290,
      { align: "center" },
    )
  }

  const slug = (title || shipment.shipmentNumber || "import")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
  doc.save(`import-report-${slug}.pdf`)
}
