import { type Order, type OrderItem, resolveOrderItemModel } from "@/lib/orders"
import { logInventoryTransaction } from "@/lib/inventory-history"

export type InventoryDeductionResult = {
  success: boolean
  alreadyDeducted: boolean
  deductedLines: number
  failedLines: string[]
}

/** Keys used to match an order line to inventory-stock rows. */
export function getOrderItemStockMatchKeys(item: OrderItem): string[] {
  const keys = new Set<string>()
  const description = item.description?.trim()
  if (description) keys.add(description)

  const model = resolveOrderItemModel(item)
  if (model) keys.add(model)

  const inventoryItemId = item.inventoryItemId?.trim()
  if (inventoryItemId) {
    keys.add(inventoryItemId)
    if (inventoryItemId.startsWith("wh:")) {
      const modelFromId = inventoryItemId.slice(3).trim()
      if (modelFromId) keys.add(modelFromId)
    }
  }

  return [...keys]
}

export async function orderNeedsInventoryDeduction(order: Order): Promise<boolean> {
  if (order.items.every((item) => item.isCustom)) return false
  try {
    const res = await fetch("/api/db/inventory-order-deduct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", order }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return !order.inventoryDeductedAt
    return Boolean((data as { needsDeduction?: boolean }).needsDeduction)
  } catch {
    return !order.inventoryDeductedAt
  }
}

/**
 * Deduct inventory when an order is dispatched/delivered.
 * Updates scanned serial units (warehouse inventory UI) and stock rows.
 */
export async function deductInventoryForOrder(order: Order): Promise<InventoryDeductionResult> {
  const res = await fetch("/api/db/inventory-order-deduct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deduct", order }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      success: false,
      alreadyDeducted: false,
      deductedLines: 0,
      failedLines: [(data as { error?: string }).error || "Inventory deduction failed"],
    }
  }
  return {
    success: Boolean((data as InventoryDeductionResult).success),
    alreadyDeducted: Boolean((data as InventoryDeductionResult).alreadyDeducted),
    deductedLines: Number((data as InventoryDeductionResult).deductedLines) || 0,
    failedLines: Array.isArray((data as InventoryDeductionResult).failedLines)
      ? (data as InventoryDeductionResult).failedLines
      : [],
  }
}

/** Whether deleting/cancelling this order should try to put stock back. */
export function orderMayHaveInventoryDeduction(order: Order): boolean {
  if (order.items.every((item) => item.isCustom)) return false
  return !!(
    order.inventoryDeductedAt ||
    (order.dispatcher || "").trim() ||
    (order.fulfillmentDispatcher || "").trim() ||
    order.status === "processing" ||
    order.status === "shipped" ||
    order.status === "delivered"
  )
}

/**
 * Restore serial units and stock when an order is deleted or cancelled after dispatch.
 */
export async function restoreInventoryForOrder(order: Order): Promise<void> {
  if (!orderMayHaveInventoryDeduction(order)) return

  const res = await fetch("/api/db/inventory-order-deduct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "restore", order }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || "Failed to restore inventory")
  }
}

/**
 * Add stock when PO items are received in inventory
 */
export async function addStockFromPO(
  poId: string,
  poNumber: string,
  items: { id?: string; description: string; qty: number; unit: string; unitPrice?: number }[],
  supplierName: string = "",
  poType: string = "local"
): Promise<void> {
  for (const item of items) {
    const stockId = `${poId}-${item.id || Date.now()}`

    const res = await fetch("/api/db/inventory-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "insert",
        data: {
          id: stockId,
          poId,
          poNumber,
          itemId: item.id || stockId,
          description: item.description,
          unit: item.unit,
          receivedQty: item.qty,
          availableQty: item.qty,
          allocatedQty: 0,
          costPrice: item.unitPrice || 0,
          supplierName,
          poType,
        },
      }),
    })
    if (!res.ok) continue

    try {
      await logInventoryTransaction(
        item.description,
        "in",
        item.qty,
        item.unit,
        "po",
        poId,
        poNumber,
        "System",
        `Stock added from PO ${poNumber} (${supplierName})`
      )
    } catch {
      // ignore
    }
  }
}

/**
 * Get current stock levels for items
 */
export async function getStockLevels(itemDescriptions: string[]): Promise<Record<string, number>> {
  try {
    const res = await fetch(`/api/db/inventory-stock?descriptions=${encodeURIComponent(itemDescriptions.join(","))}`)
    const stockItems = await res.json()
    const stockLevels: Record<string, number> = {}
    if (stockItems) {
      for (const item of stockItems) {
        stockLevels[item.description] = (stockLevels[item.description] || 0) + item.availableQty
      }
    }
    return stockLevels
  } catch {
    return {}
  }
}
