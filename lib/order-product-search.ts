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

/** Canonical key for grouping product name variants (e.g. 15.6 KWh battery aliases). */
export function is156BatteryProductFamily(text: string): boolean {
  const n = normalizeProductText(text)
  if (!n) return false
  if (n === "hsld15kw") return true
  if (n.includes("man-15-6") && (n.includes("battery") || n.includes("kwh"))) return true
  if ((n.includes("15.6") || n.includes("15-6")) && n.includes("kwh") && n.includes("battery")) {
    return true
  }
  return false
}

export function productCanonicalKeyFromText(text: string): string {
  const n = normalizeProductText(text)
  if (!n) return "unknown"
  if (is156BatteryProductFamily(n)) return "product:15-6-kwh-battery"
  if (n.startsWith("man-")) return n
  return n
}

function itemCanonicalKeys(item: OrderItem): string[] {
  const keys = new Set<string>()
  for (const value of itemSearchValues(item)) {
    keys.add(productCanonicalKeyFromText(value))
  }
  return [...keys]
}

function filterCanonicalKeys(filter: ProductFilter): string[] {
  const keys = new Set<string>()
  const terms = [...(filter.matchTerms || []), filter.modelKey, filter.query].filter(
    Boolean,
  ) as string[]
  for (const term of terms) {
    keys.add(productCanonicalKeyFromText(term))
  }
  return [...keys].filter((k) => k !== "unknown")
}

function canonicalProductMatch(item: OrderItem, filter: ProductFilter): boolean {
  const itemKeys = itemCanonicalKeys(item)
  const fKeys = filterCanonicalKeys(filter)
  if (!fKeys.length) return false
  return itemKeys.some((ik) => fKeys.some((fk) => ik === fk))
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
    if (orderItemMatchesTerms(item, filter.matchTerms)) return true
    if (canonicalProductMatch(item, filter)) return true
    return false
  }
  if (filter.modelKey?.trim()) {
    if (orderItemMatchesTerm(item, filter.modelKey)) return true
    if (canonicalProductMatch(item, filter)) return true
    return false
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
  /** Sum across confirmed, processing, shipped, and delivered. */
  totalQty: number
  /** Sum for orders with status delivered only. */
  deliveredQty: number
  /** Sum for confirmed, processing, or shipped — not yet delivered. */
  pendingQty: number
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
  let deliveredQty = 0
  let pendingQty = 0
  const clients = new Set<string>()
  let unit = "pcs"
  const matchedOrders = orders.filter((o) => orderMatchesProductFilter(o, filter))

  for (const order of matchedOrders) {
    clients.add(order.clientName)
    const matched = getMatchingOrderItems(order, filter)
    const qty = matchingProductQty(order, filter)
    totalQty += qty
    if (order.status === "delivered") {
      deliveredQty += qty
    } else {
      pendingQty += qty
    }
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
    deliveredQty,
    pendingQty,
    clientCount: clients.size,
    unit,
  }
}

/** Delivered qty for a product — uses the same rows/ matching as the orders table. */
export function computeDeliveredProductQty(
  orders: Order[],
  filter: ProductFilter,
): { qty: number; unit: string } {
  if (!hasProductFilter(filter)) return { qty: 0, unit: "pcs" }

  let qty = 0
  let unit = "pcs"
  for (const order of orders) {
    if (order.status !== "delivered") continue
    if (!orderMatchesProductFilter(order, filter)) continue
    const matched = getMatchingOrderItems(order, filter)
    qty += matchingProductQty(order, filter)
    if (matched[0]?.unit) unit = matched[0].unit
  }
  return { qty, unit }
}

/** Build a synthetic line item from return/replacement snapshots (or live order item). */
function snapshotAsOrderItem(
  order: Order,
  orderItemId: string,
  snapshot?: { description?: string; model?: string; unit?: string },
): OrderItem | null {
  const live = (order.items || []).find((item) => String(item.id) === String(orderItemId))
  if (live) return live

  const description = String(snapshot?.description || "").trim()
  const model = String(snapshot?.model || "").trim()
  if (!description && !model) return null

  return {
    id: orderItemId || "snapshot",
    description: description || model,
    model,
    qty: 0,
    unit: snapshot?.unit || "pcs",
    unitPrice: 0,
    isCustom: false,
  }
}

export function returnLineMatchesProductFilter(
  order: Order,
  line: NonNullable<Order["returnLines"]>[number],
  filter: ProductFilter,
): boolean {
  if (!hasProductFilter(filter)) return false
  const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
  if (qty <= 0) return false
  const item = snapshotAsOrderItem(order, String(line.orderItemId || ""), line)
  return item ? orderItemMatchesProductFilter(item, filter) : false
}

export function replacementLineMatchesProductFilter(
  order: Order,
  line: NonNullable<Order["replacementLines"]>[number],
  filter: ProductFilter,
): boolean {
  if (!hasProductFilter(filter)) return false
  const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
  if (qty <= 0) return false
  const item = snapshotAsOrderItem(order, String(line.orderItemId || ""), line)
  return item ? orderItemMatchesProductFilter(item, filter) : false
}

/** True if order currently has the product, or returned/replaced it. */
export function orderTouchesProductFilter(order: Order, filter: ProductFilter): boolean {
  if (!hasProductFilter(filter)) return true
  if (orderMatchesProductFilter(order, filter)) return true
  if ((order.returnLines || []).some((line) => returnLineMatchesProductFilter(order, line, filter))) {
    return true
  }
  if (
    (order.replacementLines || []).some((line) =>
      replacementLineMatchesProductFilter(order, line, filter),
    )
  ) {
    return true
  }
  return false
}

export type ProductReturnEvent = {
  orderNumber: string
  clientName: string
  qty: number
  unit: string
  returnedAt: string
  returnedBy: string
  description: string
}

export type ProductReplaceEvent = {
  orderNumber: string
  clientName: string
  qty: number
  unit: string
  replacedAt: string
  replacedBy: string
  reason: string
  disposition: string
  oldSerialNumber: string
  newSerialNumber: string
  description: string
}

export type ProductReturnReplaceSummary = {
  returnedQty: number
  replacedQty: number
  unit: string
  returns: ProductReturnEvent[]
  replacements: ProductReplaceEvent[]
}

/** Returns / replacements for a product across orders (includes fully returned lines). */
export function computeProductReturnReplaceSummary(
  orders: Order[],
  filter: ProductFilter,
): ProductReturnReplaceSummary {
  const empty: ProductReturnReplaceSummary = {
    returnedQty: 0,
    replacedQty: 0,
    unit: "pcs",
    returns: [],
    replacements: [],
  }
  if (!hasProductFilter(filter)) return empty

  let returnedQty = 0
  let replacedQty = 0
  let unit = "pcs"
  const returns: ProductReturnEvent[] = []
  const replacements: ProductReplaceEvent[] = []

  for (const order of orders) {
    for (const line of order.returnLines || []) {
      if (!returnLineMatchesProductFilter(order, line, filter)) continue
      const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
      const lineUnit = line.unit || "pcs"
      unit = lineUnit
      returnedQty += qty
      const item = snapshotAsOrderItem(order, String(line.orderItemId || ""), line)
      returns.push({
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        qty,
        unit: lineUnit,
        returnedAt: line.returnedAt || order.returnedAt || "",
        returnedBy: line.returnedBy || order.returnedBy || "",
        description: item?.description || line.description || line.model || "Product",
      })
    }

    for (const line of order.replacementLines || []) {
      if (!replacementLineMatchesProductFilter(order, line, filter)) continue
      const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
      const lineUnit = line.unit || "pcs"
      unit = lineUnit
      replacedQty += qty
      const item = snapshotAsOrderItem(order, String(line.orderItemId || ""), line)
      replacements.push({
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        qty,
        unit: lineUnit,
        replacedAt: line.replacedAt || "",
        replacedBy: line.replacedBy || "",
        reason: line.reason || "",
        disposition: line.disposition || "",
        oldSerialNumber: line.oldSerialNumber || "",
        newSerialNumber: line.newSerialNumber || "",
        description: item?.description || line.description || line.model || "Product",
      })
    }
  }

  returns.sort((a, b) => String(b.returnedAt).localeCompare(String(a.returnedAt)))
  replacements.sort((a, b) => String(b.replacedAt).localeCompare(String(a.replacedAt)))

  return { returnedQty, replacedQty, unit, returns, replacements }
}
