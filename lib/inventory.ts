import { type Order, type OrderItem, resolveOrderItemModel } from "@/lib/orders"
import { logInventoryTransaction } from "@/lib/inventory-history"

type StockRow = {
  id: string
  description?: string
  name?: string
  itemId?: string
  availableQty?: number
  available_qty?: number
  unit?: string
  poNumber?: string
  po_number?: string
}

export type InventoryDeductionResult = {
  success: boolean
  alreadyDeducted: boolean
  deductedLines: number
  failedLines: string[]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
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

function stockRowMatchesKeys(stock: StockRow, keys: string[]): boolean {
  if (keys.length === 0) return false

  const normalizedKeys = keys.map(normalizeKey)
  const fields = [
    stock.description,
    stock.name,
    stock.itemId,
    stock.itemId?.startsWith("wh:") ? stock.itemId.slice(3) : undefined,
  ]
    .filter(Boolean)
    .map((v) => normalizeKey(String(v)))

  return normalizedKeys.some((key) => fields.some((field) => field === key || field.includes(key)))
}

async function fetchAllStockRows(): Promise<StockRow[]> {
  const res = await fetch("/api/db/inventory-stock")
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function hasInventoryOutTransactionsForOrder(orderId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/inventory-history?referenceId=${encodeURIComponent(orderId)}`)
    if (!res.ok) return false
    const rows = await res.json()
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

export async function orderNeedsInventoryDeduction(order: Order): Promise<boolean> {
  if (order.inventoryDeductedAt) return false
  if (order.items.every((item) => item.isCustom)) return false
  return !(await hasInventoryOutTransactionsForOrder(order.id))
}

/**
 * Deduct inventory quantities from inventory-stock when an order is dispatched/delivered.
 * Matches by description, model number, and inventory item id (e.g. wh:MODEL).
 */
export async function deductInventoryForOrder(order: Order): Promise<InventoryDeductionResult> {
  const failedLines: string[] = []
  let deductedLines = 0

  if (order.inventoryDeductedAt) {
    return { success: true, alreadyDeducted: true, deductedLines: 0, failedLines: [] }
  }

  const hasHistory = await hasInventoryOutTransactionsForOrder(order.id)
  if (hasHistory) {
    return { success: true, alreadyDeducted: true, deductedLines: 0, failedLines: [] }
  }

  const allStock = await fetchAllStockRows()
  if (allStock.length === 0) {
    return {
      success: false,
      alreadyDeducted: false,
      deductedLines: 0,
      failedLines: ["No inventory stock records found."],
    }
  }

  for (const orderItem of order.items) {
    if (orderItem.isCustom) continue

    const matchKeys = getOrderItemStockMatchKeys(orderItem)
    const stockItems = allStock.filter((stock) => stockRowMatchesKeys(stock, matchKeys))

    if (stockItems.length === 0) {
      const label = resolveOrderItemModel(orderItem) || orderItem.description
      failedLines.push(`${label} (no matching stock)`)
      continue
    }

    let remainingQty = orderItem.qty
    let lineDeducted = 0

    for (const stockItem of stockItems) {
      if (remainingQty <= 0) break

      const currentQty = stockItem.availableQty ?? stockItem.available_qty ?? 0
      if (currentQty <= 0) continue

      const deductQty = Math.min(remainingQty, currentQty)
      const newAvailableQty = Math.max(0, currentQty - deductQty)

      const updateRes = await fetch("/api/db/inventory-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: stockItem.id,
          data: { availableQty: newAvailableQty },
        }),
      })

      if (!updateRes.ok) {
        failedLines.push(`${orderItem.description} (failed to update stock ${stockItem.id})`)
        continue
      }

      stockItem.availableQty = newAvailableQty
      stockItem.available_qty = newAvailableQty
      remainingQty -= deductQty
      lineDeducted += deductQty

      try {
        await logInventoryTransaction(
          stockItem.description || orderItem.description,
          "out",
          deductQty,
          orderItem.unit,
          "order",
          order.id,
          order.orderNumber,
          order.createdBy || "System",
          `Delivered to ${order.clientName} (PO: ${stockItem.poNumber || stockItem.po_number || "—"})`
        )
      } catch {
        // logging failure should not block deduction
      }
    }

    if (lineDeducted > 0) {
      deductedLines += 1
    }
    if (remainingQty > 0) {
      const label = resolveOrderItemModel(orderItem) || orderItem.description
      failedLines.push(`${label} (short by ${remainingQty} ${orderItem.unit})`)
    }
  }

  const nonCustomCount = order.items.filter((i) => !i.isCustom).length
  const success = deductedLines > 0 && failedLines.length === 0

  return {
    success,
    alreadyDeducted: false,
    deductedLines,
    failedLines,
  }
}

/**
 * Restore inventory quantities to stock table when a delivered order is cancelled/deleted
 */
export async function restoreInventoryForOrder(order: Order): Promise<void> {
  if (order.status !== "delivered") return

  const allStock = await fetchAllStockRows()

  for (const item of order.items) {
    if (item.isCustom) continue

    const matchKeys = getOrderItemStockMatchKeys(item)
    const stockItem = allStock.find((stock) => stockRowMatchesKeys(stock, matchKeys))
    if (!stockItem) continue

    const currentQty = stockItem.availableQty ?? stockItem.available_qty ?? 0
    const newAvailableQty = currentQty + item.qty

    await fetch("/api/db/inventory-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: stockItem.id,
        data: { availableQty: newAvailableQty },
      }),
    })

    try {
      await logInventoryTransaction(
        stockItem.description || item.description,
        "in",
        item.qty,
        item.unit,
        "order",
        order.id,
        order.orderNumber,
        order.createdBy || "System",
        `Restored from cancelled/deleted order ${order.orderNumber}`
      )
    } catch {
      // ignore
    }
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
