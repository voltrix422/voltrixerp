import type { InventorySerialUnit } from "@/lib/inventory-serial-units"
import { serialNumberKey } from "@/lib/inventory-serial-units"
import type { ManualInventoryItem } from "@/lib/manual-inventory"
import {
  type Order,
  type OrderItem,
  isManualDispatchLine,
  resolveOrderItemModel,
} from "@/lib/orders"

export type ManualDispatchMeta = {
  availableQty: number
  inventoryStockId?: string | null
  manualId?: string
}

export type OrderFulfillmentSerialAllocation = {
  orderItemId: string
  model: string
  serialNumber: string
  unitId?: string
}

/** Order lines that need QR scans at dispatch (manual + warehouse). */
export function orderLinesRequiringSerials(order: Pick<Order, "items">): OrderItem[] {
  return order.items.filter((item) => {
    if (item.isCustom) return false
    return !!resolveOrderItemModel(item)
  })
}

export function getAllocationsForOrderItem(
  order: Pick<Order, "fulfillmentSerialAllocations">,
  orderItemId: string,
): OrderFulfillmentSerialAllocation[] {
  return (order.fulfillmentSerialAllocations ?? []).filter((a) => a.orderItemId === orderItemId)
}

export function formatSerialListForLine(
  order: Pick<Order, "fulfillmentSerialAllocations">,
  orderItemId: string,
): string {
  const serials = getAllocationsForOrderItem(order, orderItemId).map((a) => a.serialNumber)
  if (serials.length === 0) return "—"
  return serials.join(", ")
}

export function orderHasSerialAllocations(order: Pick<Order, "fulfillmentSerialAllocations">): boolean {
  return (order.fulfillmentSerialAllocations?.length ?? 0) > 0
}

export function modelKey(model: string): string {
  return model.trim().toLowerCase()
}

/**
 * QR label base model vs order variant (e.g. MAN-LITHIUM-IRON-PHOSPHATE on label,
 * MAN-LITHIUM-IRON-PHOSPHATE-B on order).
 */
function orderAcceptsScannedModelVariant(order: string, scanned: string): boolean {
  if (!scanned || scanned === order) return scanned === order
  if (!order.startsWith(`${scanned}-`)) return false
  const variantTail = order.slice(scanned.length + 1)
  return /^[a-z0-9]{1,8}$/i.test(variantTail)
}

/** Match BarTender-style QR (prefix + SN) against inventory model codes. */
export function dispatchScanModelMatches(
  orderModel: string,
  scannedModel: string,
  serialNumber: string,
  rawPayload: string,
): boolean {
  const order = modelKey(orderModel)
  if (!order) return true

  const raw = modelKey(rawPayload.trim())
  if (raw === order) return true

  const scanned = modelKey(scannedModel.trim())
  if (scanned && scanned === order) return true
  if (scanned && orderAcceptsScannedModelVariant(order, scanned)) return true

  const serial = serialNumber.trim()
  if (scanned && serial && modelKey(`${scannedModel.trim()}-${serial}`) === order) return true

  if (serial) {
    const serialKey = serialNumberKey(serial)
    if (order.endsWith(`-${serialKey}`)) {
      const prefix = orderModel.trim().slice(0, orderModel.trim().length - serial.length - 1)
      if (scanned && modelKey(prefix) === scanned) return true
      if (scanned && orderAcceptsScannedModelVariant(modelKey(prefix), scanned)) return true
    }
  }

  return !scanned
}

export function manualDispatchMetaByModel(
  items: ManualInventoryItem[],
): Record<string, ManualDispatchMeta> {
  const map: Record<string, ManualDispatchMeta> = {}
  for (const item of items) {
    const model = item.model?.trim()
    if (!model) continue
    map[modelKey(model)] = {
      availableQty: item.availableQty ?? 0,
      inventoryStockId: item.inventoryStockId,
      manualId: item.id,
    }
  }
  return map
}

export function warehouseStockByModelFromRows(
  rows: Array<{ model?: string | null; availableQty?: number | null }>,
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of rows) {
    const model = row.model?.trim()
    if (!model) continue
    const key = modelKey(model)
    map[key] = (map[key] ?? 0) + Math.max(0, Math.floor(Number(row.availableQty) || 0))
  }
  return map
}

export function inStockUnitsForOrderLine(
  units: InventorySerialUnit[],
  item: OrderItem,
): InventorySerialUnit[] {
  const model = resolveOrderItemModel(item)
  if (!model) return []
  const key = modelKey(model)
  return units.filter(
    (u) => u.status === "in_stock" && modelKey(u.model || "") === key,
  )
}

export function buildAllocationsFromSelections(
  order: Pick<Order, "items">,
  selections: Record<string, string[]>,
): OrderFulfillmentSerialAllocation[] {
  const allocations: OrderFulfillmentSerialAllocation[] = []

  for (const item of orderLinesRequiringSerials(order)) {
    const model = resolveOrderItemModel(item) || ""
    const serials = selections[item.id] ?? []
    for (const serialNumber of serials) {
      const sn = serialNumber.trim()
      if (!sn) continue
      allocations.push({
        orderItemId: item.id,
        model,
        serialNumber: sn,
      })
    }
  }

  return allocations
}

export function validateSerialSelections(
  order: Pick<Order, "items">,
  selections: Record<string, string[]>,
  manualMeta: Record<string, ManualDispatchMeta> = {},
  warehouseStockByModel: Record<string, number> = {},
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const usedSerials = new Set<string>()

  for (const item of orderLinesRequiringSerials(order)) {
    const model = resolveOrderItemModel(item)!
    const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
    const selected = selections[item.id] ?? []

    if (needQty === 0) continue

    if (selected.length !== needQty) {
      errors.push(
        `${model}: scan ${needQty} serial number(s) (scanned ${selected.length})`,
      )
      continue
    }

    for (const serial of selected) {
      const key = serialNumberKey(serial)
      if (!key) {
        errors.push(`${model}: invalid serial number`)
        continue
      }
      if (usedSerials.has(key)) {
        errors.push(`${model}: duplicate serial ${serial}`)
        continue
      }
      usedSerials.add(key)
    }

    if (isManualDispatchLine(item)) {
      const meta = manualMeta[modelKey(model)]
      const available = meta?.availableQty ?? 0
      if (available < needQty) {
        errors.push(
          `${model}: only ${available} unit(s) available (order needs ${needQty})`,
        )
      }
    } else {
      const key = modelKey(model)
      // Only enforce when stock row exists — serial-tracked models may not have a stock row.
      if (key in warehouseStockByModel) {
        const available = warehouseStockByModel[key]
        if (available < needQty) {
          errors.push(
            `${model}: only ${available} unit(s) in stock (order needs ${needQty})`,
          )
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function selectionsFromAllocations(
  allocations: OrderFulfillmentSerialAllocation[] | undefined,
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const a of allocations ?? []) {
    if (!map[a.orderItemId]) map[a.orderItemId] = []
    map[a.orderItemId].push(a.serialNumber)
  }
  return map
}
