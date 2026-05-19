import { prisma } from "@/lib/db"

/** Return branch-assigned stock to main warehouse (erpInventoryStock). */
export async function returnBranchInventoryToMain(branchId?: string) {
  const where = branchId ? { branchId } : undefined
  const rows = await prisma.erpBranchInventory.findMany({ where })

  for (const row of rows) {
    const branch = await prisma.erpBranch.findUnique({ where: { id: row.branchId } })
    if (branch?.type === "main_warehouse") continue

    const stock = await prisma.erpInventoryStock.findUnique({ where: { id: row.inventoryId } })
    if (!stock) continue

    await prisma.erpInventoryStock.update({
      where: { id: row.inventoryId },
      data: {
        availableQty: stock.availableQty + row.quantity,
        allocatedQty: Math.max(0, stock.allocatedQty - row.quantity),
      },
    })
  }

  const branchIdsToClear = branchId
    ? [branchId]
    : (
        await prisma.erpBranch.findMany({
          where: { type: { not: "main_warehouse" } },
          select: { id: true },
        })
      ).map((b) => b.id)

  if (branchIdsToClear.length === 0) {
    return { returnedRows: rows.length, deletedAssignments: 0 }
  }

  const deleted = await prisma.erpBranchInventory.deleteMany({
    where: { branchId: { in: branchIdsToClear } },
  })

  return { returnedRows: rows.length, deletedAssignments: deleted.count }
}

/** Delete transfer history for one branch or globally. */
export async function clearBranchTransferHistory(branchId?: string) {
  if (!branchId) {
    const result = await prisma.erpBranchInventoryTransfer.deleteMany({})
    return { deleted: result.count }
  }

  const result = await prisma.erpBranchInventoryTransfer.deleteMany({
    where: {
      OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
    },
  })
  return { deleted: result.count }
}

export async function resetAllBranchTransfersAndInventory() {
  const inventory = await returnBranchInventoryToMain()
  const history = await clearBranchTransferHistory()
  return { inventory, history }
}
