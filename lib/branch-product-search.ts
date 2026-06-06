import { prisma } from "@/lib/db"

export type BranchProductSearchResult = {
  branchId: string
  branchName: string
  branchCode: string
  branchType: string
  itemName: string
  model: string
  quantity: number
  unit: string
  assignedAt: string | null
}

function matchesQuery(query: string, values: Array<string | null | undefined>): boolean {
  const lower = query.trim().toLowerCase()
  if (!lower) return false
  return values.some((value) => (value || "").toLowerCase().includes(lower))
}

export async function searchProductAcrossBranches(
  query: string,
): Promise<BranchProductSearchResult[]> {
  const q = query.trim()
  if (!q || q.length < 2) return []

  const [branches, inventoryRows, manualItems, labels, stockRows, serialCounts] =
    await Promise.all([
      prisma.erpBranch.findMany({ orderBy: { name: "asc" } }),
      prisma.erpBranchInventory.findMany({ orderBy: { assignedAt: "desc" } }),
      prisma.erpManualInventoryItem.findMany(),
      prisma.erpInventoryModelLabel.findMany(),
      prisma.erpInventoryStock.findMany(),
      prisma.erpInventorySerialUnit.groupBy({
        by: ["model", "status"],
        _count: { id: true },
        where: { status: { in: ["in_stock", "at_branch"] } },
      }),
    ])

  const branchById = new Map(branches.map((b) => [b.id, b]))
  const stockById = new Map(stockRows.map((s) => [s.id, s]))
  const labelByModel = new Map(
    labels.map((l) => [l.model.trim().toLowerCase(), l.displayName.trim()]),
  )
  const manualByModel = new Map(
    manualItems.map((m) => [m.model.trim().toLowerCase(), m]),
  )

  const serialInStockByModel = new Map<string, number>()
  for (const row of serialCounts) {
    const key = row.model.trim().toLowerCase()
    if (!key) continue
    serialInStockByModel.set(key, (serialInStockByModel.get(key) ?? 0) + row._count.id)
  }

  const results: BranchProductSearchResult[] = []
  const seen = new Set<string>()

  function pushResult(entry: BranchProductSearchResult) {
    const key = `${entry.branchId}:${entry.model}:${entry.quantity}`
    if (seen.has(key)) return
    seen.add(key)
    results.push(entry)
  }

  for (const row of inventoryRows) {
    const branch = branchById.get(row.branchId)
    if (!branch || row.quantity <= 0) continue

    const stock = stockById.get(row.inventoryId)
    const model = (stock?.description || row.productDescription || "").trim()
    const manual = manualByModel.get(model.toLowerCase())
    const itemName =
      manual?.name ||
      labelByModel.get(model.toLowerCase()) ||
      stock?.name ||
      row.productDescription ||
      model

    if (
      !matchesQuery(q, [
        row.productDescription,
        itemName,
        model,
        stock?.name,
        stock?.description,
        manual?.name,
        manual?.model,
      ])
    ) {
      continue
    }

    pushResult({
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      branchType: branch.type,
      itemName,
      model: model || row.productDescription,
      quantity: row.quantity,
      unit: row.unit || stock?.unit || "pcs",
      assignedAt: row.assignedAt?.toISOString() ?? null,
    })
  }

  const mainBranch = branches.find((b) => b.type === "main_warehouse")
  if (mainBranch) {
    for (const manual of manualItems) {
      const qty = manual.availableQty ?? manual.qty ?? 0
      if (qty <= 0) continue
      const model = manual.model.trim()
      const itemName = manual.name.trim() || labelByModel.get(model.toLowerCase()) || model
      if (!matchesQuery(q, [itemName, model, manual.name])) continue

      pushResult({
        branchId: mainBranch.id,
        branchName: mainBranch.name,
        branchCode: mainBranch.code,
        branchType: mainBranch.type,
        itemName,
        model,
        quantity: qty,
        unit: manual.unit || "pcs",
        assignedAt: manual.updatedAt?.toISOString() ?? null,
      })
    }

    for (const stock of stockRows) {
      const model = (stock.description || stock.name || "").trim()
      if (!model) continue
      const serialQty = serialInStockByModel.get(model.toLowerCase()) ?? 0
      const qty = serialQty > 0 ? serialQty : Math.max(0, stock.availableQty ?? 0)
      if (qty <= 0) continue

      const manual = manualByModel.get(model.toLowerCase())
      const itemName =
        manual?.name || labelByModel.get(model.toLowerCase()) || stock.name || model

      if (!matchesQuery(q, [itemName, model, stock.name, stock.description])) continue

      const alreadyFromManual = results.some(
        (r) =>
          r.branchId === mainBranch.id &&
          r.model.toLowerCase() === model.toLowerCase(),
      )
      if (alreadyFromManual) continue

      pushResult({
        branchId: mainBranch.id,
        branchName: mainBranch.name,
        branchCode: mainBranch.code,
        branchType: mainBranch.type,
        itemName,
        model,
        quantity: qty,
        unit: stock.unit || "pcs",
        assignedAt: null,
      })
    }
  }

  return results.sort((a, b) => {
    const byBranch = a.branchName.localeCompare(b.branchName)
    if (byBranch !== 0) return byBranch
    return a.itemName.localeCompare(b.itemName)
  })
}
