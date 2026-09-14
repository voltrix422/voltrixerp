export type GrandInventoryDetailRow = {
  branchName: string
  branchCode: string
  branchType: string
  item: string
  model: string
  qty: number
  unit: string
  transferredAt: string
}

export type GrandInventoryLocationRow = {
  branchName: string
  branchCode: string
  qty: number
  unit: string
}

export type GrandInventoryProductSummary = {
  item: string
  model: string
  unit: string
  totalQty: number
  locationCount: number
  locations: GrandInventoryLocationRow[]
  locationLabel: string
}

export type GrandInventorySummary = {
  productCount: number
  totalQty: number
  locationCount: number
  branchCount: number
  products: GrandInventoryProductSummary[]
}

export function resolveGrandInventoryProductFields(
  source: {
    itemName?: string | null
    model?: string | null
    productDescription?: string | null
    inventoryId?: string | null
  },
  labelMap: Record<string, string> = {},
): { item: string; model: string } {
  const explicitName = String(source.itemName ?? "").trim()
  const explicitModel = String(source.model ?? "").trim()
  const desc = String(source.productDescription ?? "").trim()

  if (desc.includes(" · ")) {
    const dotIdx = desc.lastIndexOf(" · ")
    const namePart = desc.slice(0, dotIdx).trim()
    const modelPart = desc.slice(dotIdx + 3).trim()
    const model = explicitModel || modelPart || "—"
    const item =
      explicitName ||
      labelMap[model] ||
      labelMap[modelPart] ||
      namePart ||
      model
    return { item, model }
  }

  const model = explicitModel || desc || String(source.inventoryId ?? "").trim() || "—"
  const item =
    explicitName ||
    labelMap[model] ||
    (desc && desc !== model ? desc : "") ||
    model

  return { item, model }
}

function productKey(row: Pick<GrandInventoryDetailRow, "item" | "model">) {
  const model = row.model.trim().toLowerCase()
  const item = row.item.trim().toLowerCase()
  return model || item
}

export function summarizeGrandInventory(rows: GrandInventoryDetailRow[]): GrandInventorySummary {
  const byProduct = new Map<string, GrandInventoryProductSummary>()
  const branchCodes = new Set<string>()

  for (const row of rows) {
    if (row.qty <= 0) continue
    branchCodes.add(row.branchCode)
    const key = productKey(row)
    const existing = byProduct.get(key)
    if (!existing) {
      byProduct.set(key, {
        item: row.item,
        model: row.model || row.item,
        unit: row.unit || "pcs",
        totalQty: row.qty,
        locationCount: 1,
        locations: [
          {
            branchName: row.branchName,
            branchCode: row.branchCode,
            qty: row.qty,
            unit: row.unit || "pcs",
          },
        ],
        locationLabel: "",
      })
      continue
    }

    existing.totalQty += row.qty
    const loc = existing.locations.find((l) => l.branchCode === row.branchCode)
    if (loc) {
      loc.qty += row.qty
    } else {
      existing.locations.push({
        branchName: row.branchName,
        branchCode: row.branchCode,
        qty: row.qty,
        unit: row.unit || "pcs",
      })
      existing.locationCount += 1
    }
  }

  const products = [...byProduct.values()]
    .map((p) => ({
      ...p,
      locationCount: p.locations.length,
      locationLabel: p.locations
        .sort((a, b) => a.branchName.localeCompare(b.branchName))
        .map((l) => `${l.branchName} (${l.branchCode}): ${l.qty} ${l.unit}`)
        .join(" · "),
    }))
    .sort((a, b) => a.item.localeCompare(b.item))

  return {
    productCount: products.length,
    totalQty: products.reduce((sum, p) => sum + p.totalQty, 0),
    locationCount: rows.filter((r) => r.qty > 0).length,
    branchCount: branchCodes.size,
    products,
  }
}

function escCsvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "").replace(/"/g, '""')
  if (/[,"\r\n]/.test(s)) return `"${s}"`
  return s
}

function downloadCsv(filename: string, csvBody: string) {
  if (typeof document === "undefined") return
  const blob = new Blob(["\ufeff" + csvBody], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function rowsToCsv(headers: string[], rows: (string | number)[][]) {
  return [
    headers.map((h) => escCsvCell(h)).join(","),
    ...rows.map((r) => r.map((c) => escCsvCell(c)).join(",")),
  ].join("\r\n")
}

export function downloadGrandInventoryExcel(
  detailRows: GrandInventoryDetailRow[],
  summary: GrandInventorySummary,
  exportedBy?: string,
) {
  const date = new Date().toISOString().slice(0, 10)
  const meta = exportedBy?.trim()
    ? `${escCsvCell("Exported by")},${escCsvCell(exportedBy)}\r\n${escCsvCell("Export time")},${escCsvCell(new Date().toLocaleString())}\r\n\r\n`
    : ""

  const overview = rowsToCsv(
    ["Metric", "Value"],
    [
      ["Products in stock", summary.productCount],
      ["Total quantity", summary.totalQty],
      ["Stock locations", summary.locationCount],
      ["Branches with stock", summary.branchCount],
    ],
  )

  const byProduct = rowsToCsv(
    ["Product", "Model", "Total Available", "Unit", "Locations", "Available Where"],
    summary.products.map((p) => [
      p.item,
      p.model,
      p.totalQty,
      p.unit,
      p.locationCount,
      p.locationLabel,
    ]),
  )

  const byLocation = rowsToCsv(
    ["Branch", "Code", "Type", "Product", "Model", "Qty", "Unit", "Date"],
    detailRows.map((r) => [
      r.branchName,
      r.branchCode,
      r.branchType,
      r.item,
      r.model,
      r.qty,
      r.unit,
      r.transferredAt,
    ]),
  )

  downloadCsv(
    `grand-inventory-${date}.csv`,
    `${meta}${overview}\r\n\r\n${byProduct}\r\n\r\n${byLocation}`,
  )
}

export async function downloadGrandInventoryPDF(
  detailRows: GrandInventoryDetailRow[],
  summary: GrandInventorySummary,
) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  const autoTable = (autoTableModule as any).default || autoTableModule

  const doc = new jsPDF("p", "mm", "a4")
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 10
  const gap = 3
  const colW = (pageW - margin * 2 - gap) / 2
  const black: [number, number, number] = [0, 0, 0]
  const muted: [number, number, number] = [90, 90, 90]
  const cardPad = 2.5
  const lineH = 3.6

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    doc.setDrawColor(...black)
    doc.setLineWidth(0.25)
    doc.line(x1, y1, x2, y2)
  }

  const measureCardHeight = (item: string, locationCount: number) => {
    const titleLines = doc.splitTextToSize(item, colW - cardPad * 2 - 22)
    return cardPad + titleLines.length * 3.4 + 5.5 + locationCount * lineH + cardPad
  }

  // Header
  let y = margin
  doc.setTextColor(...black)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("Grand Inventory", margin, y + 4)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text(new Date().toLocaleString(), pageW - margin, y + 4, { align: "right" })
  y += 7
  drawLine(margin, y, pageW - margin, y)
  y += 5

  const chips: [string, string][] = [
    ["Products", String(summary.productCount)],
    ["Total qty", summary.totalQty.toLocaleString()],
    ["Locations", String(summary.locationCount)],
    ["Branches", String(summary.branchCount)],
  ]
  const chipW = (pageW - margin * 2 - gap * 3) / 4
  chips.forEach(([label, value], i) => {
    const x = margin + i * (chipW + gap)
    doc.setDrawColor(...black)
    doc.setLineWidth(0.3)
    doc.rect(x, y, chipW, 10)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(...muted)
    doc.text(label, x + 2, y + 3.5)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(...black)
    doc.text(value, x + 2, y + 8)
  })
  y += 14

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...black)
  doc.text("By product", margin, y)
  y += 4

  type CardPlan = {
    product: GrandInventoryProductSummary
    locations: GrandInventoryLocationRow[]
    height: number
  }

  const plans: CardPlan[] = summary.products.map((product) => {
    const locations = [...product.locations].sort((a, b) =>
      a.branchName.localeCompare(b.branchName),
    )
    return {
      product,
      locations,
      height: measureCardHeight(product.item, locations.length),
    }
  })

  for (let i = 0; i < plans.length; i += 2) {
    const left = plans[i]
    const right = plans[i + 1]
    const rowH = Math.max(left.height, right?.height ?? 0)

    if (y + rowH > pageH - margin) {
      doc.addPage()
      y = margin
    }

    const drawCard = (plan: CardPlan, x: number) => {
      const { product, locations, height } = plan
      doc.setDrawColor(...black)
      doc.setLineWidth(0.35)
      doc.rect(x, y, colW, height)

      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(...black)
      const titleLines: string[] = doc.splitTextToSize(product.item, colW - cardPad * 2 - 22)
      doc.text(titleLines, x + cardPad, y + cardPad + 2.8)

      doc.setFontSize(9)
      doc.text(product.totalQty.toLocaleString(), x + colW - cardPad, y + cardPad + 2.8, {
        align: "right",
      })
      doc.setFont("helvetica", "normal")
      doc.setFontSize(6)
      doc.setTextColor(...muted)
      doc.text(product.unit, x + colW - cardPad, y + cardPad + 5.8, { align: "right" })

      let cy = y + cardPad + titleLines.length * 3.4 + 1.5
      doc.text(product.model, x + cardPad, cy)
      cy += 1.2
      drawLine(x + cardPad, cy, x + colW - cardPad, cy)
      cy += 3.2

      doc.setFontSize(6.5)
      for (const loc of locations) {
        doc.setTextColor(...muted)
        doc.setFont("helvetica", "normal")
        const label = `${loc.branchName} (${loc.branchCode})`
        const clipped = doc.splitTextToSize(label, colW - cardPad * 2 - 18)[0] as string
        doc.text(clipped, x + cardPad, cy)
        doc.setTextColor(...black)
        doc.setFont("helvetica", "bold")
        doc.text(`${loc.qty.toLocaleString()} ${loc.unit}`, x + colW - cardPad, cy, {
          align: "right",
        })
        cy += lineH
      }
    }

    drawCard(left, margin)
    if (right) drawCard(right, margin + colW + gap)
    y += rowH + gap
  }

  // Detail table — black stroke, no fill
  if (y + 28 > pageH - margin) {
    doc.addPage()
    y = margin
  } else {
    y += 4
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...black)
  doc.text("Detail by branch", margin, y)
  y += 3

  autoTable(doc, {
    startY: y,
    head: [["Branch", "Code", "Type", "Product", "Model", "Qty", "Unit", "Date"]],
    body: detailRows.map((r) => [
      r.branchName,
      r.branchCode,
      r.branchType.replace(/_/g, " "),
      r.item,
      r.model,
      String(r.qty),
      r.unit,
      r.transferredAt || "—",
    ]),
    theme: "grid",
    styles: {
      fontSize: 6.5,
      cellPadding: 1.4,
      textColor: black,
      lineColor: black,
      lineWidth: 0.2,
      overflow: "linebreak",
      valign: "top",
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: black,
      lineColor: black,
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 14 },
      2: { cellWidth: 22 },
      3: { cellWidth: 42 },
      4: { cellWidth: 38 },
      5: { cellWidth: 12, halign: "right" },
      6: { cellWidth: 10 },
      7: { cellWidth: 18 },
    },
    margin: { left: margin, right: margin },
    tableLineColor: black,
    tableLineWidth: 0.25,
  })

  doc.save(`grand-inventory-${new Date().toISOString().slice(0, 10)}.pdf`)
}
