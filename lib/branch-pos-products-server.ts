import { prisma } from "@/lib/db"

export type BranchPosProductRow = {
  id: string
  description: string
  name: string
  unit: string
  availableQty: number
  costPrice: number
  inventoryId: string
  branchInventoryId?: string
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
      unit: row.unit || "pcs",
      availableQty: row.availableQty,
      costPrice: row.costPrice,
      inventoryId: row.id,
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

  return rows.map((row) => {
    const stock = stockById.get(row.inventoryId)
    const manual = row.inventoryId.startsWith("man:")
      ? manualById.get(row.inventoryId.slice(4))
      : null
    const costPrice = stock?.costPrice ?? 0
    return {
      id: row.id,
      branchInventoryId: row.id,
      inventoryId: row.inventoryId,
      description: row.productDescription || stock?.description || manual?.name || manual?.model || row.inventoryId,
      name: row.productDescription || stock?.name || manual?.name || manual?.model || row.inventoryId,
      unit: row.unit || stock?.unit || manual?.unit || "pcs",
      availableQty: row.quantity,
      costPrice,
    }
  })
}
