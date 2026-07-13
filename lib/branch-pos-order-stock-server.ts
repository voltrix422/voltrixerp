import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export type BranchPosOrderLine = {
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

      await tx.erpInventoryHistory.create({
        data: {
          itemDescription: rows[0].productDescription || item.description || item.model || "Item",
          transactionType: "out",
          quantity: qty,
          unit: item.unit || rows[0].unit || "pcs",
          referenceType: "branch_pos_order",
          referenceId: order.id,
          referenceNumber: order.orderNumber,
          notes: `Branch POS delivered · ${branch.name}${order.clientName ? ` · ${order.clientName}` : ""}`,
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

/** Restore branch inventory when a delivered Branch POS order is deleted (stock was deducted). */
export async function restoreBranchStockForPosOrder(
  order: BranchPosOrderStockInput,
  txClient?: Prisma.TransactionClient,
): Promise<void> {
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
            referenceType: "branch_pos_restore",
            referenceId: order.id,
            referenceNumber: order.orderNumber,
            notes: `Branch POS order deleted · stock restored · ${branch.name}`,
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
          referenceType: "branch_pos_restore",
          referenceId: order.id,
          referenceNumber: order.orderNumber,
          notes: `Branch POS order deleted · stock restored · ${branch.name}`,
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

export function isBranchPosOrderSource(source?: string | null): boolean {
  return String(source || "").trim().toLowerCase() === "branch_pos"
}
