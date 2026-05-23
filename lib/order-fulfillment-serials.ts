import type { InventorySerialUnit } from "@/lib/inventory-serial-units"
import {
  type Order,
  type OrderItem,
  resolveOrderItemModel,
} from "@/lib/orders"

export type OrderFulfillmentSerialAllocation = {
  orderItemId: string
  model: string
  serialNumber: string
  unitId: string
}

/** Order lines that should pick serial numbers at dispatch (warehouse stock). */
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

function modelKey(model: string): string {
  return model.trim().toLowerCase()
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
  unitsById: Map<string, InventorySerialUnit>,
): OrderFulfillmentSerialAllocation[] {
  const allocations: OrderFulfillmentSerialAllocation[] = []

  for (const item of orderLinesRequiringSerials(order)) {
    const unitIds = selections[item.id] ?? []
    for (const unitId of unitIds) {
      const unit = unitsById.get(unitId)
      if (!unit) continue
      const model = resolveOrderItemModel(item) || unit.model
      allocations.push({
        orderItemId: item.id,
        model,
        serialNumber: unit.serialNumber,
        unitId: unit.id,
      })
    }
  }

  return allocations
}

export function validateSerialSelections(
  order: Pick<Order, "items">,
  selections: Record<string, string[]>,
  units: InventorySerialUnit[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const unitsById = new Map(units.map((u) => [u.id, u]))
  const usedUnitIds = new Set<string>()

  for (const item of orderLinesRequiringSerials(order)) {
    const model = resolveOrderItemModel(item)!
    const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
    const selected = selections[item.id] ?? []
    const available = inStockUnitsForOrderLine(units, item)

    if (needQty === 0) continue

    if (available.length < needQty) {
      errors.push(
        `${model}: only ${available.length} unit(s) in stock (order needs ${needQty})`,
      )
    }

    if (selected.length !== needQty) {
      errors.push(
        `${model}: select ${needQty} serial number(s) (selected ${selected.length})`,
      )
      continue
    }

    for (const unitId of selected) {
      if (usedUnitIds.has(unitId)) {
        errors.push(`${model}: duplicate serial selection`)
        continue
      }
      usedUnitIds.add(unitId)

      const unit = unitsById.get(unitId)
      if (!unit) {
        errors.push(`${model}: invalid unit selected`)
        continue
      }
      if (unit.status !== "in_stock") {
        errors.push(`${model}: ${unit.serialNumber} is not in stock`)
        continue
      }
      if (modelKey(unit.model || "") !== modelKey(model)) {
        errors.push(`${model}: ${unit.serialNumber} does not match model`)
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
    map[a.orderItemId].push(a.unitId)
  }
  return map
}
