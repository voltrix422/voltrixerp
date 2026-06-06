import { prisma } from "@/lib/db"

async function deleteSerialUnitAndWarranties(unit: {
  id: string
  warrantyId: string | null
  serialNumber: string | null
}) {
  await prisma.erpWarrantyClaim.deleteMany({ where: { unitId: unit.id } })
  if (unit.warrantyId) {
    await prisma.erpWarranty.deleteMany({ where: { warrantyId: unit.warrantyId } })
  }
  if (unit.serialNumber) {
    await prisma.erpWarranty.deleteMany({ where: { serialNumber: unit.serialNumber } })
  }
  await prisma.erpInventorySerialUnit.delete({ where: { id: unit.id } })
}

async function deleteAtBranchSerialUnitsForRow(
  branchInventory: { inventoryId: string; quantity: number },
  branchCode: string,
) {
  const qty = Math.max(0, Math.round(branchInventory.quantity))
  if (qty <= 0) return 0

  const stock = await prisma.erpInventoryStock.findUnique({
    where: { id: branchInventory.inventoryId },
    select: { description: true },
  })
  const modelKey = stock?.description?.trim() || ""

  let units = await prisma.erpInventorySerialUnit.findMany({
    where: {
      status: "at_branch",
      inventoryStockId: branchInventory.inventoryId,
      ...(branchCode ? { notes: { contains: branchCode } } : {}),
    },
    orderBy: { scannedAt: "asc" },
    take: qty,
  })

  if (units.length < qty && modelKey) {
    const extra = await prisma.erpInventorySerialUnit.findMany({
      where: {
        status: "at_branch",
        model: modelKey,
        id: { notIn: units.map((u) => u.id) },
      },
      orderBy: { scannedAt: "asc" },
      take: qty - units.length,
    })
    units = [...units, ...extra]
  }

  for (const unit of units) {
    await deleteSerialUnitAndWarranties(unit)
  }

  return units.length
}

/** Permanently remove one branch assignment — stock does not return to main warehouse. */
export async function permanentlyDeleteBranchInventoryRow(rowId: string) {
  const branchInventory = await prisma.erpBranchInventory.findUnique({
    where: { id: rowId },
  })
  if (!branchInventory) {
    return { deleted: false, serialUnitsRemoved: 0 }
  }

  const branch = await prisma.erpBranch.findUnique({
    where: { id: branchInventory.branchId },
    select: { type: true, code: true },
  })

  if (branch?.type !== "main_warehouse") {
    const serialUnitsRemoved = await deleteAtBranchSerialUnitsForRow(
      branchInventory,
      branch?.code || "",
    )

    const stock = await prisma.erpInventoryStock.findUnique({
      where: { id: branchInventory.inventoryId },
      select: { allocatedQty: true },
    })
    if (stock) {
      await prisma.erpInventoryStock.update({
        where: { id: branchInventory.inventoryId },
        data: {
          allocatedQty: Math.max(0, stock.allocatedQty - branchInventory.quantity),
        },
      })
    }

    await prisma.erpBranchInventory.delete({ where: { id: rowId } })
    return { deleted: true, serialUnitsRemoved }
  }

  await prisma.erpBranchInventory.delete({ where: { id: rowId } })
  return { deleted: true, serialUnitsRemoved: 0 }
}

/** Permanently remove all branch assignments for one branch (or all non-main branches). */
export async function permanentlyDeleteAllBranchInventory(branchId?: string) {
  const rows = await prisma.erpBranchInventory.findMany({
    where: branchId ? { branchId } : undefined,
  })

  let deletedAssignments = 0
  let serialUnitsRemoved = 0

  for (const row of rows) {
    const branch = await prisma.erpBranch.findUnique({
      where: { id: row.branchId },
      select: { type: true },
    })
    if (branch?.type === "main_warehouse") continue

    const result = await permanentlyDeleteBranchInventoryRow(row.id)
    if (result.deleted) {
      deletedAssignments++
      serialUnitsRemoved += result.serialUnitsRemoved
    }
  }

  return { deletedAssignments, serialUnitsRemoved }
}
