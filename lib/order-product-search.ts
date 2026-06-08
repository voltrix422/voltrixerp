import type { Order, OrderItem } from "@/lib/orders"
import { resolveOrderItemModel } from "@/lib/orders"

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

export function orderMatchesProductQuery(order: Order, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  return order.items.some((item) => orderItemMatchesProductQuery(item, q))
}

export function getMatchingOrderItems(order: Order, query: string): OrderItem[] {
  const q = query.trim()
  if (!q) return order.items
  return order.items.filter((item) => orderItemMatchesProductQuery(item, q))
}

export function matchingProductQty(order: Order, query: string): number {
  return getMatchingOrderItems(order, query).reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
}

export function matchingProductQtyLabel(order: Order, query: string): string {
  const items = getMatchingOrderItems(order, query)
  if (!items.length) return "—"
  return items.map((item) => `${item.qty} ${item.unit}`).join(", ")
}

export function matchingProductDescription(order: Order, query: string): string {
  const items = getMatchingOrderItems(order, query)
  if (!items.length) return "—"
  const names = [...new Set(items.map((item) => item.description.trim()).filter(Boolean))]
  return names.join(", ")
}

export function matchingProductValue(order: Order, query: string): number {
  return getMatchingOrderItems(order, query).reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
    0,
  )
}

export type ProductOrderSummary = {
  orderCount: number
  totalQty: number
  clientCount: number
  unit: string
}

export function computeProductOrderSummary(orders: Order[], query: string): ProductOrderSummary | null {
  const q = query.trim()
  if (!q) return null

  let totalQty = 0
  const clients = new Set<string>()
  let unit = "pcs"

  for (const order of orders) {
    if (!orderMatchesProductQuery(order, q)) continue
    clients.add(order.clientName)
    const matched = getMatchingOrderItems(order, q)
    totalQty += matchingProductQty(order, q)
    if (matched[0]?.unit) unit = matched[0].unit
  }

  return {
    orderCount: orders.filter((o) => orderMatchesProductQuery(o, q)).length,
    totalQty,
    clientCount: clients.size,
    unit,
  }
}
