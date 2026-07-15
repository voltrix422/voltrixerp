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
  const doc = new jsPDF("l", "mm", "a4")

  doc.setFontSize(14)
  doc.text("Grand Inventory Report — All Branches", 14, 14)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20)
  doc.text(
    `Products: ${summary.productCount} · Total qty: ${summary.totalQty.toLocaleString()} · Locations: ${summary.locationCount} · Branches: ${summary.branchCount}`,
    14,
    26,
  )

  autoTable(doc, {
    startY: 32,
    head: [["Product", "Model", "Total Available", "Unit", "Locations", "Available Where"]],
    body: summary.products.map((p) => [
      p.item,
      p.model,
      String(p.totalQty),
      p.unit,
      String(p.locationCount),
      p.locationLabel,
    ]),
    styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [31, 172, 166] },
    columnStyles: {
      5: { cellWidth: 90 },
    },
  })

  const detailStartY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 32
  doc.setFontSize(11)
  doc.text("Detail by branch", 14, detailStartY + 10)

  autoTable(doc, {
    startY: detailStartY + 14,
    head: [["Branch", "Code", "Type", "Product", "Model", "Qty", "Unit", "Date"]],
    body: detailRows.map((r) => [
      r.branchName,
      r.branchCode,
      r.branchType.replace(/_/g, " "),
      r.item,
      r.model,
      String(r.qty),
      r.unit,
      r.transferredAt,
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [31, 172, 166] },
  })

  doc.save(`grand-inventory-${new Date().toISOString().slice(0, 10)}.pdf`)
}
