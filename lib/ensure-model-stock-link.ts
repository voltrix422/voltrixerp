import { prisma } from "@/lib/db"
import { findManualInventoryByAnyModelOrAlias } from "@/lib/inventory-model-aliases"

/** Find PO stock row that matches a scanned model code. */
export async function findStockByModel(model: string) {
  const m = model.trim()
  if (!m) return null

  const exact = await prisma.erpInventoryStock.findFirst({
    where: {
      OR: [
        { description: { equals: m, mode: "insensitive" } },
        { name: { equals: m, mode: "insensitive" } },
      ],
    },
  })
  if (exact) return exact

  const all = await prisma.erpInventoryStock.findMany({
    orderBy: { description: "asc" },
  })
  const lower = m.toLowerCase()
  return (
    all.find(
      (s) =>
        s.description?.toLowerCase() === lower ||
        s.name?.toLowerCase() === lower ||
        s.description?.toLowerCase().includes(lower) ||
        lower.includes(s.description?.toLowerCase() ?? ""),
    ) ?? null
  )
}

/** Count serial units in main warehouse for a model. */
export async function countInStockSerialsForModel(model: string) {
  return prisma.erpInventorySerialUnit.count({
    where: { model: model.trim(), status: "in_stock" },
  })
}

/**
 * Ensure every scanned model has an erpInventoryStock row and linked serial units
 * so main warehouse can dispatch / send to branches.
 */
export async function ensureInventoryStockForModel(
  model: string,
  productName?: string,
  unit = "pcs",
) {
  const trimmed = model.trim() || "Unknown model"
  const inStockCount = await countInStockSerialsForModel(trimmed)

  const manualItem = await findManualInventoryByAnyModelOrAlias(trimmed)
  if (manualItem?.inventoryStockId) {
    const linked = await prisma.erpInventoryStock.findUnique({
      where: { id: manualItem.inventoryStockId },
    })
    if (linked) {
      const available =
        inStockCount > 0 ? inStockCount : Number(manualItem.availableQty) || 0
      const stock = await prisma.erpInventoryStock.update({
        where: { id: linked.id },
        data: {
          availableQty: available,
          receivedQty: Math.max(linked.receivedQty, manualItem.qty ?? 0, inStockCount),
          name: productName?.trim() || linked.name || manualItem.name || trimmed,
          description: manualItem.model,
          unit: unit || linked.unit,
        },
      })
      return { stock, inStockCount: available }
    }
  }

  let stock = await findStockByModel(trimmed)

  if (!stock) {
    const safeItemId = trimmed.replace(/[^\w.-]+/g, "-").slice(0, 80) || "model"
    stock = await prisma.erpInventoryStock.create({
      data: {
        poNumber: "WH-SYNC",
        itemId: safeItemId,
        name: productName?.trim() || trimmed,
        description: trimmed,
        unit,
        receivedQty: inStockCount,
        availableQty: inStockCount,
        allocatedQty: 0,
      },
    })
  } else {
    stock = await prisma.erpInventoryStock.update({
      where: { id: stock.id },
      data: {
        availableQty: inStockCount,
        receivedQty: Math.max(stock.receivedQty, inStockCount),
        name: productName?.trim() || stock.name || trimmed,
        unit: unit || stock.unit,
      },
    })
  }

  if (inStockCount > 0) {
    await prisma.erpInventorySerialUnit.updateMany({
      where: { model: trimmed, status: "in_stock" },
      data: { inventoryStockId: stock.id },
    })
  }

  return { stock, inStockCount }
}

/** After dispatch, move serial units off main warehouse and sync stock qty. */
export async function allocateSerialUnitsForBranchDispatch(params: {
  model: string
  inventoryStockId: string
  quantity: number
  branchCode: string
}) {
  const trimmed = params.model.trim()
  const units = await prisma.erpInventorySerialUnit.findMany({
    where: {
      model: trimmed,
      status: "in_stock",
    },
    orderBy: { scannedAt: "asc" },
    take: params.quantity,
  })

  if (units.length < params.quantity) {
    throw new Error(
      `Not enough scanned units in stock for "${trimmed}" (need ${params.quantity}, have ${units.length})`,
    )
  }

  await prisma.erpInventorySerialUnit.updateMany({
    where: { id: { in: units.map((u) => u.id) } },
    data: {
      status: "at_branch",
      inventoryStockId: params.inventoryStockId,
      notes: `At branch ${params.branchCode}`,
    },
  })

  const remaining = await countInStockSerialsForModel(trimmed)
  await prisma.erpInventoryStock.update({
    where: { id: params.inventoryStockId },
    data: { availableQty: remaining },
  })

  return units.length
}
