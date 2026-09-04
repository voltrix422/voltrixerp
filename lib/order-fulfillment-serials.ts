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

export type LineDispatchAvailability = {
  orderItemId: string
  description: string
  model: string | null
  orderedQty: number
  availableQty: number
  dispatchableQty: number
  isCustom: boolean
  hasShortage: boolean
}

export type ValidateSerialOptions = {
  /** When true, only require scans up to warehouse availability (partial dispatch). */
  partialDispatch?: boolean
  dispatchableQtyByLineId?: Record<string, number>
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
    // Free / giveaway items are deducted when added — no QR scanning needed.
    if (item.isFreeItem) return false
    return !!resolveOrderItemModel(item)
  })
}

export function getAllocationsForOrderItem(
  order: Pick<Order, "fulfillmentSerialAllocations">,
  orderItemId: string,
): OrderFulfillmentSerialAllocation[] {
  return (order.fulfillmentSerialAllocations ?? []).filter((a) => a.orderItemId === orderItemId)
}

/**
 * Serials for a line, capped to ordered qty when allocations were over-scanned
 * (e.g. replacement adds without removing). Prefer the latest scans.
 */
export function getDisplayAllocationsForOrderItem(
  order: Pick<Order, "fulfillmentSerialAllocations" | "items">,
  orderItemId: string,
): OrderFulfillmentSerialAllocation[] {
  const allocations = getAllocationsForOrderItem(order, orderItemId)
  const item = order.items?.find((i) => i.id === orderItemId)
  const qty = Math.max(0, Math.floor(Number(item?.qty) || 0))
  if (qty > 0 && allocations.length > qty) {
    // Prefer original dispatch scans (first N); extras are usually appended later.
    return allocations.slice(0, qty)
  }
  return allocations
}

export function formatSerialListForLine(
  order: Pick<Order, "fulfillmentSerialAllocations" | "items">,
  orderItemId: string,
): string {
  const serials = getDisplayAllocationsForOrderItem(order, orderItemId)
    .map((a) => a.serialNumber.trim())
    .filter(Boolean)
  if (serials.length === 0) return "—"
  // One serial per line so PDF tables wrap between numbers, not mid-token (e.g. "volt" / "rix86").
  return serials.join("\n")
}

export function orderHasSerialAllocations(order: Pick<Order, "fulfillmentSerialAllocations">): boolean {
  return (order.fulfillmentSerialAllocations?.length ?? 0) > 0
}

export function modelKey(model: string): string {
  return model.trim().toLowerCase()
}

/**
 * Treat catalog vs manual SKUs as the same product:
 * HS-25.6V100AH === MAN-HS-25-6V100AH === HS-25.6V 100Ah
 */
export function normalizeDispatchModelKey(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/^man[-_]?/, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "-")
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

  const orderNorm = normalizeDispatchModelKey(orderModel)
  const raw = modelKey(rawPayload.trim())
  if (raw === order || normalizeDispatchModelKey(rawPayload) === orderNorm) return true

  const scanned = modelKey(scannedModel.trim())
  if (scanned && scanned === order) return true
  if (scanned && normalizeDispatchModelKey(scannedModel) === orderNorm) return true
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

/** Branch POS stock keyed by model / description so warehouse scan UI can validate qty. */
export function branchStockByModelFromProducts(
  rows: Array<{
    model?: string | null
    description?: string | null
    name?: string | null
    availableQty?: number | null
  }>,
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of rows) {
    const qty = Math.max(0, Math.floor(Number(row.availableQty) || 0))
    for (const raw of [row.model, row.description, row.name]) {
      const model = raw?.trim()
      if (!model) continue
      const key = modelKey(model)
      map[key] = Math.max(map[key] ?? 0, qty)
    }
  }
  return map
}

export function branchManualMetaFromProducts(
  rows: Array<{
    id?: string
    model?: string | null
    description?: string | null
    name?: string | null
    availableQty?: number | null
    inventoryId?: string | null
  }>,
): Record<string, ManualDispatchMeta> {
  const map: Record<string, ManualDispatchMeta> = {}
  for (const row of rows) {
    const qty = Math.max(0, Math.floor(Number(row.availableQty) || 0))
    for (const raw of [row.model, row.description, row.name]) {
      const model = raw?.trim()
      if (!model) continue
      const key = modelKey(model)
      const prev = map[key]
      map[key] = {
        availableQty: Math.max(prev?.availableQty ?? 0, qty),
        inventoryStockId: row.inventoryId || prev?.inventoryStockId,
        manualId: row.id || prev?.manualId,
      }
    }
  }
  return map
}

export function serialCountByModelFromUnits(
  units: Array<{ model?: string | null; status?: string | null }>,
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const unit of units) {
    if (unit.status !== "in_stock") continue
    const model = unit.model?.trim()
    if (!model) continue
    const key = modelKey(model)
    map[key] = (map[key] ?? 0) + 1
  }
  return map
}

export function getLineAvailableQty(
  item: OrderItem,
  manualMeta: Record<string, ManualDispatchMeta>,
  warehouseStockByModel: Record<string, number>,
  serialCountByModel: Record<string, number> = {},
): number {
  if (item.isCustom) return 0
  const model = resolveOrderItemModel(item)
  if (!model) return 0
  const key = modelKey(model)
  if (isManualDispatchLine(item)) {
    return Math.max(0, Math.floor(manualMeta[key]?.availableQty ?? 0))
  }
  const serialCount = serialCountByModel[key] ?? 0
  if (serialCount > 0) return serialCount
  if (key in warehouseStockByModel) {
    return Math.max(0, Math.floor(warehouseStockByModel[key]))
  }
  return 0
}

export function computeOrderDispatchAvailability(
  order: Pick<Order, "items">,
  manualMeta: Record<string, ManualDispatchMeta>,
  warehouseStockByModel: Record<string, number>,
  serialCountByModel: Record<string, number> = {},
): LineDispatchAvailability[] {
  return order.items.map((item) => {
    const orderedQty = Math.max(0, Math.floor(Number(item.qty) || 0))
    const model = resolveOrderItemModel(item)
    const availableQty = getLineAvailableQty(
      item,
      manualMeta,
      warehouseStockByModel,
      serialCountByModel,
    )
    const dispatchableQty = item.isCustom ? 0 : Math.min(orderedQty, availableQty)
    return {
      orderItemId: item.id,
      description: item.description,
      model,
      orderedQty,
      availableQty,
      dispatchableQty,
      isCustom: !!item.isCustom,
      hasShortage: !item.isCustom && availableQty < orderedQty,
    }
  })
}

export function buildDispatchableQtyMap(
  availability: LineDispatchAvailability[],
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const line of availability) {
    if (!line.isCustom) {
      map[line.orderItemId] = line.dispatchableQty
    }
  }
  return map
}

export function orderHasDispatchShortage(availability: LineDispatchAvailability[]): boolean {
  return availability.some((line) => line.hasShortage)
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
  options: ValidateSerialOptions = {},
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const usedSerials = new Set<string>()
  const partial = options.partialDispatch === true
  const dispatchableMap = options.dispatchableQtyByLineId ?? {}

  for (const item of orderLinesRequiringSerials(order)) {
    const model = resolveOrderItemModel(item)!
    const orderQty = Math.max(0, Math.floor(Number(item.qty) || 0))
    const available = getLineAvailableQty(item, manualMeta, warehouseStockByModel)
    const requiredQty = partial
      ? (dispatchableMap[item.id] ?? Math.min(orderQty, available))
      : orderQty
    const selected = selections[item.id] ?? []

    if (orderQty === 0) continue

    if (partial && requiredQty === 0) {
      if (selected.length > 0) {
        errors.push(`${model}: no stock available — remove ${selected.length} scan(s)`)
      }
      continue
    }

    if (selected.length !== requiredQty) {
      errors.push(
        partial
          ? `${model}: scan ${requiredQty} serial number(s) for available stock (scanned ${selected.length})`
          : `${model}: scan ${requiredQty} serial number(s) (scanned ${selected.length})`,
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

    if (!partial && isManualDispatchLine(item)) {
      const meta = manualMeta[modelKey(model)]
      const stockAvailable = meta?.availableQty ?? 0
      if (stockAvailable < orderQty) {
        errors.push(
          `${model}: only ${stockAvailable} unit(s) available (order needs ${orderQty})`,
        )
      }
    } else if (!partial) {
      const key = modelKey(model)
      if (key in warehouseStockByModel) {
        const stockAvailable = warehouseStockByModel[key]
        if (stockAvailable < orderQty) {
          errors.push(
            `${model}: only ${stockAvailable} unit(s) in stock (order needs ${orderQty})`,
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
