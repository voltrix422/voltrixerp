import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export type BranchPosOrderLine = {
  description?: string
  qty?: number
  unit?: string
  isCustom?: boolean
  inventoryItemId?: string
  branchInventoryId?: string
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

async function resolveBranchRow(
  tx: Prisma.TransactionClient,
  branchId: string,
  item: BranchPosOrderLine,
) {
  const branchInventoryId = item.branchInventoryId?.trim()
  if (branchInventoryId) {
    const byId = await tx.erpBranchInventory.findFirst({
      where: { id: branchInventoryId, branchId },
    })
    if (byId) return byId
  }

  const inventoryId = item.inventoryItemId?.trim()
  if (inventoryId) {
    const byLink = await tx.erpBranchInventory.findFirst({
      where: { branchId, inventoryId },
    })
    if (byLink) return byLink
  }

  const description = item.description?.trim()
  if (description) {
    return tx.erpBranchInventory.findFirst({
      where: { branchId, productDescription: description },
    })
  }

  return null
}

/** Deduct branch inventory only (never main warehouse) when a Branch POS order is created. */
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
      const row = await resolveBranchRow(tx, order.branchId, item)
      if (!row) {
        throw new Error(`Branch stock not found for ${item.description || item.model || "item"}`)
      }
      if (row.quantity < qty) {
        throw new Error(
          `Insufficient branch stock for ${row.productDescription || item.description} (have ${row.quantity}, need ${qty})`,
        )
      }

      const stockBefore = row.quantity
      const stockAfter = stockBefore - qty

      await tx.erpBranchInventory.update({
        where: { id: row.id },
        data: { quantity: stockAfter },
      })

      await tx.erpInventoryHistory.create({
        data: {
          itemDescription: row.productDescription || item.description || item.model || "Item",
          transactionType: "out",
          quantity: qty,
          unit: item.unit || row.unit || "pcs",
          referenceType: "branch_pos_order",
          referenceId: order.id,
          referenceNumber: order.orderNumber,
          notes: `Branch POS order · ${branch.name}${order.clientName ? ` · ${order.clientName}` : ""}`,
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

/** Restore branch inventory when a Branch POS order is deleted/cancelled. */
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
      const row = await resolveBranchRow(tx, order.branchId, item)
      if (!row) {
        // Recreate a branch row if the link still exists but qty row was removed
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
            referenceType: "branch_pos_order",
            referenceId: order.id,
            referenceNumber: order.orderNumber,
            notes: `Branch POS order restored · ${branch.name}`,
            stockBefore: 0,
            stockAfter: qty,
            locationLabel,
            createdBy,
          },
        })
        continue
      }

      const stockBefore = row.quantity
      const stockAfter = stockBefore + qty

      await tx.erpBranchInventory.update({
        where: { id: row.id },
        data: { quantity: stockAfter },
      })

      await tx.erpInventoryHistory.create({
        data: {
          itemDescription: row.productDescription || item.description || item.model || "Item",
          transactionType: "in",
          quantity: qty,
          unit: item.unit || row.unit || "pcs",
          referenceType: "branch_pos_order",
          referenceId: order.id,
          referenceNumber: order.orderNumber,
          notes: `Branch POS order restored · ${branch.name}`,
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
