/**
 * One-time reset: return all branch inventory to main warehouse and clear transfer history.
 * Run: node scripts/reset-branch-transfers.mjs
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function returnBranchInventoryToMain() {
  const rows = await prisma.erpBranchInventory.findMany()
  let returned = 0

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
    returned += 1
  }

  const nonMainIds = (
    await prisma.erpBranch.findMany({
      where: { type: { not: "main_warehouse" } },
      select: { id: true },
    })
  ).map((b) => b.id)

  const deleted =
    nonMainIds.length > 0
      ? await prisma.erpBranchInventory.deleteMany({
          where: { branchId: { in: nonMainIds } },
        })
      : { count: 0 }

  return { returned, deletedAssignments: deleted.count }
}

async function main() {
  const inventory = await returnBranchInventoryToMain()
  const history = await prisma.erpBranchInventoryTransfer.deleteMany()
  console.log("Reset complete:", {
    inventoryRowsReturned: inventory.returned,
    branchAssignmentsRemoved: inventory.deletedAssignments,
    transferHistoryDeleted: history.count,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
