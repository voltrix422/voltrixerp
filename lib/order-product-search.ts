import type { Order, OrderItem } from "@/lib/orders"
import { resolveOrderItemModel } from "@/lib/orders"

export type ProductFilter = {
  modelKey?: string
  matchTerms?: string[]
  query?: string
}

export function normalizeProductText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function hasProductFilter(filter: ProductFilter): boolean {
  return !!(filter.matchTerms?.length || filter.modelKey?.trim() || filter.query?.trim())
}

function itemSearchValues(item: OrderItem): string[] {
  const values = new Set<string>()
  const add = (value?: string | null) => {
    const trimmed = value?.trim()
    if (trimmed) values.add(normalizeProductText(trimmed))
  }

  add(item.description)
  add(resolveOrderItemModel(item))

  const inventoryId = item.inventoryItemId?.trim()
  if (inventoryId) {
    add(inventoryId)
    if (inventoryId.startsWith("wh:")) add(inventoryId.slice(3))
    if (inventoryId.startsWith("man:")) add(inventoryId.slice(4))
  }

  return [...values]
}

function valuesMatchTerm(values: string[], term: string): boolean {
  const normalizedTerm = normalizeProductText(term)
  if (!normalizedTerm) return false

  for (const value of values) {
    if (!value) continue
    if (value === normalizedTerm) return true
    if (value.includes(normalizedTerm) || normalizedTerm.includes(value)) return true
  }

  return false
}

export function orderItemMatchesTerm(item: OrderItem, term: string): boolean {
  return valuesMatchTerm(itemSearchValues(item), term)
}

export function orderItemMatchesTerms(item: OrderItem, terms: string[]): boolean {
  if (!terms.length) return false
  const values = itemSearchValues(item)
  return terms.some((term) => valuesMatchTerm(values, term))
}

export function orderItemMatchesProductQuery(item: OrderItem, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  return orderItemMatchesTerm(item, q)
}

export function orderItemMatchesProductFilter(item: OrderItem, filter: ProductFilter): boolean {
  if (filter.matchTerms?.length) {
    return orderItemMatchesTerms(item, filter.matchTerms)
  }
  if (filter.modelKey?.trim()) {
    return orderItemMatchesTerm(item, filter.modelKey)
  }
  if (filter.query?.trim()) {
    return orderItemMatchesProductQuery(item, filter.query)
  }
  return true
}

export function orderMatchesProductFilter(order: Order, filter: ProductFilter): boolean {
  if (!hasProductFilter(filter)) return true
  return order.items.some((item) => orderItemMatchesProductFilter(item, filter))
}

/** @deprecated use orderMatchesProductFilter */
export function orderMatchesProductQuery(order: Order, query: string): boolean {
  return orderMatchesProductFilter(order, { query })
}

export function getMatchingOrderItems(order: Order, filter: ProductFilter): OrderItem[] {
  if (!hasProductFilter(filter)) return order.items
  return order.items.filter((item) => orderItemMatchesProductFilter(item, filter))
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
