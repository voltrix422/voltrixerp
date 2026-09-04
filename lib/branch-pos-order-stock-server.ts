import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"

export type BranchPosOrderLine = {
  id?: string
  description?: string
  qty?: number
  unit?: string
  isCustom?: boolean
  inventoryItemId?: string
  branchInventoryId?: string
  /** When POS aggregates duplicates, all matching row ids for FIFO deduct */
  branchInventoryIds?: string[]
  model?: string
}

export type BranchPosOrderStockInput = {
  id: string
  orderNumber: string
  clientName?: string
  createdBy?: string
  branchId: string
  items: BranchPosOrderLine[]
  fulfillmentSerialAllocations?: OrderFulfillmentSerialAllocation[]
}

function serialsForPosLine(
  item: BranchPosOrderLine,
  allocations: OrderFulfillmentSerialAllocation[] | undefined,
): string[] {
  if (!allocations?.length) return []
  const itemId = item.id?.trim()
  if (itemId) {
    const byId = allocations
      .filter((a) => a.orderItemId === itemId)
      .map((a) => String(a.serialNumber || "").trim())
      .filter(Boolean)
    if (byId.length) return byId
  }
  const model = (item.model || item.description || "").trim().toLowerCase()
  if (!model) return []
  return allocations
    .filter((a) => String(a.model || "").trim().toLowerCase() === model)
    .map((a) => String(a.serialNumber || "").trim())
    .filter(Boolean)
}

/** Resolve all matching branch inventory rows (supports duplicate split stock). */
async function resolveBranchRows(
  tx: Prisma.TransactionClient,
  branchId: string,
  item: BranchPosOrderLine,
) {
  const ids = [
    ...(item.branchInventoryIds || []),
    item.branchInventoryId,
  ]
    .map((id) => id?.trim())
    .filter((id): id is string => !!id)

  if (ids.length > 0) {
    const byIds = await tx.erpBranchInventory.findMany({
      where: { branchId, id: { in: [...new Set(ids)] } },
      orderBy: { assignedAt: "asc" },
    })
    if (byIds.length > 0) return byIds
  }

  const inventoryId = item.inventoryItemId?.trim()
  if (inventoryId) {
    const byLink = await tx.erpBranchInventory.findMany({
      where: { branchId, inventoryId },
      orderBy: { assignedAt: "asc" },
    })
    if (byLink.length > 0) return byLink
  }

  const description = item.description?.trim()
  if (description) {
    const byDesc = await tx.erpBranchInventory.findMany({
      where: {
        branchId,
        productDescription: { equals: description, mode: "insensitive" },
      },
      orderBy: { assignedAt: "asc" },
    })
    if (byDesc.length > 0) return byDesc
  }

  const model = item.model?.trim()
  if (model) {
    return tx.erpBranchInventory.findMany({
      where: {
        branchId,
        productDescription: { contains: model, mode: "insensitive" },
      },
      orderBy: { assignedAt: "asc" },
    })
  }

  return []
}

/** Deduct branch inventory only (never main warehouse) when a Branch POS order is delivered. */
export async function deductBranchStockForPosOrder(
  order: BranchPosOrderStockInput,
  txClient?: Prisma.TransactionClient,
): Promise<{ deductedAt: string }> {
  const run = async (tx: Prisma.TransactionClient) => {
    const branch = await tx.erpBranch.findUnique({ where: { id: order.branchId } })
    if (!branch) throw new Error("Branch not found")

    const locationLabel = branch.name
    const createdBy = order.createdBy?.trim() || "Branch POS"
    const lines = order.items.filter((item) => !item.isCustom && (Number(item.qty) || 0) > 0)

    for (const item of lines) {
      const qty = Number(item.qty) || 0
      const rows = await resolveBranchRows(tx, order.branchId, item)
      if (rows.length === 0) {
        throw new Error(`Branch stock not found for ${item.description || item.model || "item"}`)
      }

      const totalAvail = rows.reduce((s, r) => s + r.quantity, 0)
      if (totalAvail < qty) {
        throw new Error(
          `Insufficient branch stock for ${rows[0].productDescription || item.description} (have ${totalAvail}, need ${qty})`,
        )
      }

      const stockBefore = totalAvail
      let remaining = qty

      for (const row of rows) {
        if (remaining <= 0) break
        if (row.quantity <= 0) continue
        const take = Math.min(row.quantity, remaining)
        await tx.erpBranchInventory.update({
          where: { id: row.id },
          data: { quantity: row.quantity - take },
        })
        remaining -= take
      }

      const stockAfter = stockBefore - qty

      const serials = serialsForPosLine(item, order.fulfillmentSerialAllocations)
      const serialNote = serials.length ? ` · ${serials.join(", ")}` : ""

      await tx.erpInventoryHistory.create({
        data: {
          itemDescription: rows[0].productDescription || item.description || item.model || "Item",
          transactionType: "out",
          quantity: qty,
          unit: item.unit || rows[0].unit || "pcs",
          referenceType: "branch_pos_order",
          referenceId: order.id,
          referenceNumber: order.orderNumber,
          notes: `Branch POS delivered${serialNote} · ${branch.name}${order.clientName ? ` · ${order.clientName}` : ""}`,
          stockBefore,
          stockAfter,
          locationLabel,
          createdBy,
        },
      })
    }

    return { deductedAt: new Date().toISOString() }
  }

  if (txClient) return run(txClient)
  return prisma.$transaction(run)
}

/** Restore branch inventory when a delivered Branch POS order is deleted or items are returned. */
export async function restoreBranchStockForPosOrder(
  order: BranchPosOrderStockInput,
  txClient?: Prisma.TransactionClient,
  options?: {
    referenceType?: "branch_pos_restore" | "branch_pos_return"
    notesPrefix?: string
  },
): Promise<void> {
  const referenceType = options?.referenceType ?? "branch_pos_restore"
  const notesPrefix = options?.notesPrefix ?? "Branch POS order deleted · stock restored"
  const run = async (tx: Prisma.TransactionClient) => {
    const branch = await tx.erpBranch.findUnique({ where: { id: order.branchId } })
    if (!branch) throw new Error("Branch not found")

    const locationLabel = branch.name
    const createdBy = order.createdBy?.trim() || "Branch POS"
    const lines = order.items.filter((item) => !item.isCustom && (Number(item.qty) || 0) > 0)

    for (const item of lines) {
      const qty = Number(item.qty) || 0
      const rows = await resolveBranchRows(tx, order.branchId, item)

      if (rows.length === 0) {
        const inventoryId = item.inventoryItemId?.trim() || item.branchInventoryId?.trim()
        if (!inventoryId) continue
        const created = await tx.erpBranchInventory.create({
          data: {
            branchId: order.branchId,
            inventoryId,
            productDescription: item.description || item.model || "Item",
            quantity: qty,
            unit: item.unit || "pcs",
            assignedBy: createdBy,
            notes: `Restored from deleted order ${order.orderNumber}`,
          },
        })
        await tx.erpInventoryHistory.create({
          data: {
            itemDescription: created.productDescription,
            transactionType: "in",
            quantity: qty,
            unit: created.unit || "pcs",
            referenceType,
            referenceId: order.id,
            referenceNumber: order.orderNumber,
            notes: `${notesPrefix} · ${branch.name}`,
            stockBefore: 0,
            stockAfter: qty,
            locationLabel,
            createdBy,
          },
        })
        continue
      }

      // Put stock back on the first (oldest) matching row — no new duplicate row.
      const target = rows[0]
      const stockBefore = rows.reduce((s, r) => s + r.quantity, 0)
      const stockAfter = stockBefore + qty

      await tx.erpBranchInventory.update({
        where: { id: target.id },
        data: { quantity: target.quantity + qty },
      })

      await tx.erpInventoryHistory.create({
        data: {
          itemDescription: target.productDescription || item.description || item.model || "Item",
          transactionType: "in",
          quantity: qty,
          unit: item.unit || target.unit || "pcs",
          referenceType,
          referenceId: order.id,
          referenceNumber: order.orderNumber,
          notes: `${notesPrefix} · ${branch.name}${order.clientName ? ` · ${order.clientName}` : ""}`,
          stockBefore,
          stockAfter,
          locationLabel,
          createdBy,
        },
      })
    }
  }

  if (txClient) {
    await run(txClient)
    return
  }
  await prisma.$transaction(run)
}

export type BranchPosRestoreDelta = {
  orderItemId: string
  qty: number
}

/** Restore specific returned qty back to branch stock (partial or full return). */
export async function restoreBranchStockForPosReturnDelta(
  order: BranchPosOrderStockInput,
  restoreDelta: BranchPosRestoreDelta[],
  txClient?: Prisma.TransactionClient,
): Promise<void> {
  const byId = new Map(
    (order.items || [])
      .filter((item) => item && (item as { id?: string }).id)
      .map((item) => [(item as { id: string }).id, item as BranchPosOrderLine & { id: string }]),
  )
  const restoreItems: BranchPosOrderLine[] = []
  for (const delta of restoreDelta) {
    const item = byId.get(delta.orderItemId)
    const qty = Math.max(0, Math.floor(Number(delta.qty) || 0))
    if (!item || qty <= 0) continue
    restoreItems.push({ ...item, qty })
  }
  if (restoreItems.length === 0) return
  await restoreBranchStockForPosOrder(
    { ...order, items: restoreItems },
    txClient,
    {
      referenceType: "branch_pos_return",
      notesPrefix: `Branch POS return · ${order.orderNumber}`,
    },
  )
}

export function isBranchPosOrderSource(source?: string | null): boolean {
  return String(source || "").trim().toLowerCase() === "branch_pos"
}
