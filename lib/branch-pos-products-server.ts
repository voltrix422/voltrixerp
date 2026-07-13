import { prisma } from "@/lib/db"

export type BranchPosProductRow = {
  id: string
  description: string
  name: string
  model: string
  unit: string
  availableQty: number
  costPrice: number
  inventoryId: string
  branchInventoryId?: string
  /** All branch inventory row ids merged into this display line (do not delete — display aggregate only). */
  branchInventoryIds: string[]
  isManual: boolean
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Group duplicate branch rows by inventory link / model so POS matches a single qty line (no data deleted). */
function aggregateBranchRows(
  mapped: Omit<BranchPosProductRow, "branchInventoryIds">[],
): BranchPosProductRow[] {
  const groups = new Map<string, BranchPosProductRow>()

  for (const row of mapped) {
    const key =
      (row.inventoryId ? `inv:${normalizeKey(row.inventoryId)}` : "") ||
      `model:${normalizeKey(row.model || row.description)}`
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        ...row,
        branchInventoryIds: [row.id],
        branchInventoryId: row.branchInventoryId || row.id,
      })
      continue
    }
    existing.availableQty += row.availableQty
    existing.branchInventoryIds.push(row.id)
    if (!existing.costPrice && row.costPrice) existing.costPrice = row.costPrice
    // Prefer the longer / clearer description
    if ((row.description || "").length > (existing.description || "").length) {
      existing.description = row.description
      existing.name = row.name
    }
  }

  return [...groups.values()].sort((a, b) =>
    a.description.localeCompare(b.description, undefined, { sensitivity: "base" }),
  )
}

export async function getBranchPosProducts(
  branchId: string,
  opts?: { all?: boolean },
): Promise<BranchPosProductRow[]> {
  const branch = await prisma.erpBranch.findUnique({ where: { id: branchId } })
  if (!branch) return []

  if (branch.type === "main_warehouse") {
    const rows = await prisma.erpInventoryStock.findMany({
      where: opts?.all ? undefined : { availableQty: { gt: 0 } },
      orderBy: { description: "asc" },
    })
    return rows.map((row) => ({
      id: row.id,
      description: row.description,
      name: row.name || row.description,
      model: row.description,
      unit: row.unit || "pcs",
      availableQty: row.availableQty,
      costPrice: row.costPrice,
      inventoryId: row.id,
      branchInventoryIds: [row.id],
      isManual: false,
    }))
  }

  const rows = await prisma.erpBranchInventory.findMany({
    where: {
      branchId,
      ...(opts?.all ? {} : { quantity: { gt: 0 } }),
    },
    orderBy: { productDescription: "asc" },
  })

  const inventoryIds = [...new Set(rows.map((r) => r.inventoryId).filter(Boolean))]
  const stockRows = inventoryIds.length
    ? await prisma.erpInventoryStock.findMany({
        where: { id: { in: inventoryIds } },
      })
    : []
  const stockById = new Map(stockRows.map((s) => [s.id, s]))

  const manualIds = inventoryIds
    .filter((id) => id.startsWith("man:"))
    .map((id) => id.slice(4))
  const manualRows = manualIds.length
    ? await prisma.erpManualInventoryItem.findMany({
        where: { id: { in: manualIds } },
      })
    : []
  const manualById = new Map(manualRows.map((m) => [m.id, m]))

  const mapped = rows.map((row) => {
    const stock = stockById.get(row.inventoryId)
    const manual = row.inventoryId.startsWith("man:")
      ? manualById.get(row.inventoryId.slice(4))
      : null
    const model = manual?.model || stock?.description || row.productDescription || row.inventoryId
    const costPrice = stock?.costPrice ?? 0
    return {
      id: row.id,
      branchInventoryId: row.id,
      inventoryId: row.inventoryId,
      model,
      description: row.productDescription || manual?.name || stock?.description || model,
      name: row.productDescription || manual?.name || stock?.name || model,
      unit: row.unit || stock?.unit || manual?.unit || "pcs",
      availableQty: row.quantity,
      costPrice,
      isManual: !!manual || row.inventoryId.startsWith("man:"),
    }
  })

  return aggregateBranchRows(mapped)
}
