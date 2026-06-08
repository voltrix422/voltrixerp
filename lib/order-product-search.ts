import type { Order, OrderItem } from "@/lib/orders"
import { resolveOrderItemModel } from "@/lib/orders"

export type ProductFilter = {
  modelKey?: string
  query?: string
}

export function hasProductFilter(filter: ProductFilter): boolean {
  return !!(filter.modelKey?.trim() || filter.query?.trim())
}

export function orderItemMatchesProductModel(item: OrderItem, modelKey: string): boolean {
  const key = modelKey.trim().toLowerCase()
  if (!key) return false
  const model = resolveOrderItemModel(item)?.toLowerCase()
  if (model === key) return true
  if (item.description.trim().toLowerCase() === key) return true
  return item.description.toLowerCase().includes(key)
}

export function orderItemMatchesProductQuery(item: OrderItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const model = resolveOrderItemModel(item)
  return (
    item.description.toLowerCase().includes(q) ||
    (model?.toLowerCase().includes(q) ?? false) ||
    (item.inventoryItemId?.toLowerCase().includes(q) ?? false)
  )
}

export function orderMatchesProductFilter(order: Order, filter: ProductFilter): boolean {
  const modelKey = filter.modelKey?.trim() || ""
  const query = filter.query?.trim() || ""
  if (!modelKey && !query) return true

  return order.items.some((item) => {
    if (modelKey && orderItemMatchesProductModel(item, modelKey)) return true
    if (!modelKey && query && orderItemMatchesProductQuery(item, query)) return true
    return false
  })
}

/** @deprecated use orderMatchesProductFilter */
export function orderMatchesProductQuery(order: Order, query: string): boolean {
  return orderMatchesProductFilter(order, { query })
}

export function getMatchingOrderItems(order: Order, filter: ProductFilter): OrderItem[] {
  const modelKey = filter.modelKey?.trim() || ""
  const query = filter.query?.trim() || ""
  if (!modelKey && !query) return order.items
  if (modelKey) {
    return order.items.filter((item) => orderItemMatchesProductModel(item, modelKey))
  }
  return order.items.filter((item) => orderItemMatchesProductQuery(item, query))
}

export function matchingProductQty(order: Order, filter: ProductFilter): number {
  return getMatchingOrderItems(order, filter).reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
}

export function matchingProductQtyLabel(order: Order, filter: ProductFilter): string {
  const items = getMatchingOrderItems(order, filter)
  if (!items.length) return "—"
  return items.map((item) => `${item.qty} ${item.unit}`).join(", ")
}

export function matchingProductDescription(order: Order, filter: ProductFilter): string {
  const items = getMatchingOrderItems(order, filter)
  if (!items.length) return "—"
  const names = [...new Set(items.map((item) => item.description.trim()).filter(Boolean))]
  return names.join(", ")
}

export function matchingProductValue(order: Order, filter: ProductFilter): number {
  return getMatchingOrderItems(order, filter).reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
    0,
  )
}

export type ProductOrderSummary = {
  label: string
  orderCount: number
  totalQty: number
  clientCount: number
  unit: string
}

export function computeProductOrderSummary(
  orders: Order[],
  filter: ProductFilter,
  label?: string,
): ProductOrderSummary | null {
  if (!hasProductFilter(filter)) return null

  let totalQty = 0
  const clients = new Set<string>()
  let unit = "pcs"
  const matchedOrders = orders.filter((o) => orderMatchesProductFilter(o, filter))

  for (const order of matchedOrders) {
    clients.add(order.clientName)
    const matched = getMatchingOrderItems(order, filter)
    totalQty += matchingProductQty(order, filter)
    if (matched[0]?.unit) unit = matched[0].unit
  }

  const displayLabel =
    label?.trim() ||
    filter.modelKey?.trim() ||
    filter.query?.trim() ||
    "Product"

  return {
    label: displayLabel,
    orderCount: matchedOrders.length,
    totalQty,
    clientCount: clients.size,
    unit,
  }
}
