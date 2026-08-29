// DB access via /api/db routes (Prisma)

import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"
import {
  calculateGstInclusiveTotals,
  DEFAULT_GST_PERCENT,
} from "@/lib/gst-inclusive-pricing"

export type { OrderFulfillmentSerialAllocation }

export type OrderStatus = "draft" | "pending_approval" | "approved" | "rejected" | "finalized" | "payment_added" | "confirmed" | "processing" | "shipped" | "delivered" | "returned" | "cancelled"

export type OrderPaymentTerms = "full" | "credit"

export interface OrderItem {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  isCustom: boolean // true if custom item, false if from inventory
  inventoryItemId?: string // reference to inventory item if not custom
  /** Branch inventory row id (Branch POS) — used to deduct local stock */
  branchInventoryId?: string
  /** All duplicate branch row ids for FIFO deduct when inventory is aggregated */
  branchInventoryIds?: string[]
  model?: string // warehouse model number when from inventory
  availableQty?: number // available quantity in stock (for validation, not saved to DB)
  costPrice?: number // cost price from inventory (for reference, not saved to DB)
  /**
   * Branch POS: company price-list amount (what company sets).
   * `unitPrice` is what the customer is actually charged.
   */
  companyPrice?: number
  /**
   * Free / giveaway item: price 0, excluded from QR scanning at dispatch.
   * Inventory qty is deducted immediately when the free item is added.
   */
  isFreeItem?: boolean
}

export function isFreeOrderItem(item: Pick<OrderItem, "isFreeItem">): boolean {
  return item.isFreeItem === true
}

export function resolveOrderItemModel(item: Pick<OrderItem, "model" | "inventoryItemId">): string | null {
  if (item.model?.trim()) return item.model.trim()
  const id = item.inventoryItemId?.trim()
  if (id?.startsWith("wh:")) {
    const model = id.slice(3).trim()
    return model || null
  }
  if (id?.startsWith("man:")) {
    return item.model?.trim() || null
  }
  return null
}

export function isManualInventoryOrderItem(item: Pick<OrderItem, "inventoryItemId">): boolean {
  return !!item.inventoryItemId?.trim().startsWith("man:")
}

/** Manual-added stock: qty tracked without pre-scanned serials; SNs are captured at dispatch. */
export function isManualDispatchLine(
  item: Pick<OrderItem, "inventoryItemId" | "model">,
): boolean {
  if (isManualInventoryOrderItem(item)) return true
  const model = item.model?.trim()
  return !!model?.toUpperCase().startsWith("MAN-")
}

export function parseManualInventoryOrderItemId(inventoryItemId?: string): string | null {
  const id = inventoryItemId?.trim()
  if (!id?.startsWith("man:")) return null
  const manualId = id.slice(4).trim()
  return manualId || null
}

export function orderHasInvoiceDetails(order: Pick<Order, "tax" | "transportCost" | "otherCost" | "dispatcher">): boolean {
  return (
    Math.abs(Number(order.tax || 0)) > 0.004 ||
    order.transportCost > 0 ||
    order.otherCost > 0 ||
    !!order.dispatcher
  )
}

export function canShowOrderInvoiceActions(order: Order): boolean {
  if (!orderHasInvoiceDetails(order)) return false
  return ["finalized", "payment_added", "approved", "confirmed", "processing", "shipped", "delivered", "returned"].includes(order.status)
}

/** Money returned to the client when an order is returned. */
export interface OrderReturnPayment {
  id: string
  amount: number
  method: string
  date: string
  notes: string
  proofUrl?: string
  proofUrls?: string[]
  createdAt: string
  createdBy: string
}

/** Cashback / bonus paid to client — tied to order balance or separate goodwill. */
export type OrderCashbackSource = "order" | "other"

export interface OrderCashbackPayment {
  id: string
  amount: number
  method: string
  date: string
  notes: string
  /** "order" reduces order balance; "other" is goodwill bonus outside order value. */
  source: OrderCashbackSource
  proofUrl?: string
  proofUrls?: string[]
  createdAt: string
  createdBy: string
}

/** One batch of returned qty for a single order line (supports partial returns). */
export interface OrderReturnLine {
  id: string
  orderItemId: string
  qty: number
  returnedAt: string
  returnedBy: string
  /** Snapshot at return time (kept after line is removed from order items). */
  description?: string
  model?: string
  unit?: string
  unitPrice?: number
}

export interface Order {
  id: string
  orderNumber: string
  clientId: string
  clientName: string
  /** Person or company who starts/owns the warranty (not the CRM client). */
  warrantyHolderName?: string
  items: OrderItem[]
  subtotal: number
  taxPercent: number // Tax as percentage (e.g., 18 for 18%)
  tax: number // Calculated tax amount
  transportCost: number
  transportLabel: string // Label for transport cost
  transportIsPercentage?: boolean
  transportCostValue?: number // Calculated transport amount
  otherCost: number
  otherCostLabel: string // Label for other cost
  otherCostIsPercentage?: boolean
  otherCostValue?: number // Calculated other cost amount
  shipping: number
  discount: number
  discountIsPercentage?: boolean
  discountValue?: number // Calculated discount amount
  total: number
  status: OrderStatus
  notes: string
  createdAt: string
  createdBy: string
  ownerUserId?: string
  salesAgentCommissionPercent?: number
  salesAgentCommissionAmount?: number
  deliveryAddress: string
  deliveryDate: string
  dispatcher?: string // Assigned dispatcher
  pdfUrl?: string // URL to generated PDF
  payments?: OrderPayment[] // Payment records
  paymentTerms?: OrderPaymentTerms
  creditApprovedAt?: string
  creditApprovedBy?: string
  creditNote?: string
  // Fulfillment details (saved when order is fulfilled)
  fulfillmentDispatcher?: string
  fulfillmentReceiverName?: string
  fulfillmentReceiverCnic?: string
  fulfillmentVehicleNumber?: string
  fulfillmentDate?: string
  fulfillmentReceiverImageUrl?: string
  fulfillmentReceiverCnicImageUrl?: string
  fulfillmentVehicleImageUrl?: string
  fulfillmentProductImageUrls?: string[]
  fulfillmentSerialAllocations?: OrderFulfillmentSerialAllocation[]
  inventoryDeductedAt?: string
  /** Branch that owns this order when created from Branch POS */
  branchId?: string
  /** "branch_pos" when created from Branch POS */
  source?: string
  /** When the order was returned from CRM */
  returnedAt?: string
  returnedBy?: string
  returnReason?: string
  /** Set after inventory was restored for a full return */
  inventoryReturnedAt?: string
  /** Refunds / money sent back to the client for a returned order */
  returnPayments?: OrderReturnPayment[]
  /** Cashback / bonus payments — from order balance or separate goodwill amount. */
  cashbackPayments?: OrderCashbackPayment[]
  /** Line quantities returned (partial or full). Accumulates across return batches. */
  returnLines?: OrderReturnLine[]
  /**
   * When true, `items` / totals already exclude returned qty.
   * Remaining returnable qty is simply each item's current `qty`.
   */
  returnMerchandiseApplied?: boolean
  /** Swap faulty/damaged units on delivered orders without changing order qty. */
  replacementLines?: OrderReplacementLine[]
}

export type OrderReplacementDisposition = "main" | "faulty"

export interface OrderReplacementLine {
  id: string
  orderItemId: string
  oldSerialNumber?: string
  newSerialNumber?: string
  qty: number
  disposition: OrderReplacementDisposition
  reason: string
  photoUrls?: string[]
  replacedAt: string
  replacedBy: string
  description?: string
  model?: string
  unit?: string
}

export type PaymentSubmissionStatus = "draft" | "pending_approval" | "approved"

export interface OrderPayment {
  id: string
  amount: number
  method: string
  date: string
  notes: string
  proofUrl?: string
  proofUrls?: string[]
  createdAt: string
  createdBy: string
  submissionStatus?: PaymentSubmissionStatus
  /** Post-delivery proof attachment only — does not affect order balance. */
  proofOnly?: boolean
}

export function isProofOnlyPayment(payment: OrderPayment) {
  return Boolean(payment.proofOnly)
}

export function paymentCountsTowardBalance(
  payment: OrderPayment,
  orderStatus?: Order["status"],
) {
  if (isProofOnlyPayment(payment)) return false
  const status = getPaymentSubmissionStatus(payment, orderStatus)
  return status === "pending_approval" || status === "approved"
}

export function getPaymentSubmissionStatus(payment: OrderPayment, orderStatus?: Order["status"]): PaymentSubmissionStatus {
  if (payment.submissionStatus) return payment.submissionStatus
  if (orderStatus === "confirmed" || orderStatus === "processing" || orderStatus === "shipped" || orderStatus === "delivered") {
    return "approved"
  }
  if (orderStatus === "payment_added") return "pending_approval"
  if (orderStatus === "approved" || orderStatus === "finalized") return "draft"
  return "approved"
}

export function isPaymentEditable(payment: OrderPayment, orderStatus?: Order["status"]) {
  if (isProofOnlyPayment(payment)) {
    return orderStatus === "delivered"
  }
  const status = getPaymentSubmissionStatus(payment, orderStatus)
  return status === "draft" || status === "pending_approval"
}

/** Delivered orders: any payment or proof row can be removed without changing order status. */
export function isPaymentDeletable(payment: OrderPayment, orderStatus?: Order["status"]) {
  if (orderStatus === "delivered") return true
  return isPaymentEditable(payment, orderStatus)
}

export function getOrderAmountPaid(order: Pick<Order, "payments" | "status">) {
  return getBalanceSubmittedPayments(order.payments, order.status).reduce(
    (sum, p) => sum + p.amount,
    0,
  )
}

export function getOrderReturnAmount(order: Pick<Order, "returnPayments">) {
  return (order.returnPayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
}

export function getOrderCashbackAmount(
  order: Pick<Order, "cashbackPayments">,
  source?: OrderCashbackSource,
) {
  const list = order.cashbackPayments || []
  if (!source) {
    return list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  }
  return list
    .filter((p) => (p.source || "order") === source)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
}

/** Order-sourced cashback + payments − refunds = effective settlement toward order total. */
export function getOrderEffectivePaid(
  order: Pick<Order, "payments" | "status" | "returnPayments" | "cashbackPayments">,
) {
  const paid = getOrderAmountPaid(order)
  const refunded = getOrderReturnAmount(order)
  const orderCashback = getOrderCashbackAmount(order, "order")
  return Math.max(0, paid + orderCashback - refunded)
}

export function getOrderCreditBalance(
  order: Pick<Order, "total" | "payments" | "status" | "returnPayments" | "cashbackPayments">,
) {
  return Math.max(0, Number(order.total) - getOrderEffectivePaid(order))
}

/** Max cashback from this order: payments received minus refunds and prior order cashback. */
export function getOrderCashbackRemainingFromOrder(
  order: Pick<Order, "total" | "payments" | "status" | "returnPayments" | "cashbackPayments">,
) {
  const paid = getOrderAmountPaid(order)
  const refunded = getOrderReturnAmount(order)
  const already = getOrderCashbackAmount(order, "order")
  return Math.max(0, paid - refunded - already)
}

export function orderHasCashback(order: Pick<Order, "cashbackPayments">) {
  return (order.cashbackPayments || []).length > 0
}

export function getOrderCashbackPaymentProofUrls(payment: OrderCashbackPayment): string[] {
  if (payment.proofUrls && payment.proofUrls.length > 0) return payment.proofUrls
  if (payment.proofUrl) return [payment.proofUrl]
  return []
}

/** Orders that can receive cashback (confirmed through delivered). */
export function canAddCashback(order: Pick<Order, "status">) {
  return ["confirmed", "processing", "shipped", "delivered", "returned"].includes(order.status)
}

/** Mistaken cashback rows can be removed when cashback can still be managed. */
export function isCashbackDeletable(order: Pick<Order, "status">) {
  return canAddCashback(order)
}

export function isOrderReturned(order: Pick<Order, "status">) {
  return order.status === "returned"
}

/** Total returned qty per order item id (from returnLines). */
export function getReturnedQtyByItemId(
  order: Pick<Order, "items" | "returnLines" | "status">,
): Map<string, number> {
  const map = new Map<string, number>()
  const lines = order.returnLines || []
  if (lines.length > 0) {
    for (const line of lines) {
      const itemId = String(line.orderItemId || "").trim()
      if (!itemId) continue
      const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
      if (qty <= 0) continue
      map.set(itemId, (map.get(itemId) || 0) + qty)
    }
    return map
  }
  // Legacy full returns (status returned, no returnLines): treat every line as fully returned.
  if (isOrderReturned(order)) {
    for (const item of order.items || []) {
      if (!item.id) continue
      map.set(item.id, Math.max(0, Math.floor(Number(item.qty) || 0)))
    }
  }
  return map
}

export function getItemReturnedQty(
  order: Pick<Order, "items" | "returnLines" | "status">,
  orderItemId: string,
): number {
  return getReturnedQtyByItemId(order).get(orderItemId) || 0
}

export function getItemRemainingReturnableQty(
  order: Pick<Order, "items" | "returnLines" | "status" | "returnMerchandiseApplied">,
  item: Pick<OrderItem, "id" | "qty">,
): number {
  const current = Math.max(0, Math.floor(Number(item.qty) || 0))
  // After merchandise apply, items already hold remaining qty only.
  if (order.returnMerchandiseApplied) return current
  const returned = getItemReturnedQty(order, item.id)
  return Math.max(0, current - returned)
}

/** Original ordered qty for display (remaining + returned). */
export function getItemOriginalQty(
  order: Pick<Order, "items" | "returnLines" | "status" | "returnMerchandiseApplied">,
  item: Pick<OrderItem, "id" | "qty">,
): number {
  const current = Math.max(0, Math.floor(Number(item.qty) || 0))
  if (!order.returnMerchandiseApplied) return current
  return current + getItemReturnedQty(order, item.id)
}

export function orderHasReturnableQty(
  order: Pick<Order, "items" | "returnLines" | "status" | "returnMerchandiseApplied">,
): boolean {
  return (order.items || []).some((item) => getItemRemainingReturnableQty(order, item) > 0)
}

export function orderHasAnyReturns(
  order: Pick<Order, "items" | "returnLines" | "status" | "returnedAt">,
): boolean {
  if (isOrderReturned(order)) return true
  if (order.returnedAt) return true
  return (order.returnLines || []).some((l) => Math.max(0, Math.floor(Number(l.qty) || 0)) > 0)
}

/** Whether every ordered line qty has been returned. */
export function isOrderFullyReturnedByLines(
  order: Pick<Order, "items" | "returnLines" | "status" | "returnMerchandiseApplied">,
): boolean {
  const items = order.items || []
  if (items.length === 0) return true
  return items.every((item) => getItemRemainingReturnableQty(order, item) <= 0)
}

/** Aggregated returned lines for history UI (survives item removal). */
export function getReturnedLinesSummary(
  order: Pick<Order, "items" | "returnLines" | "status">,
): Array<{
  orderItemId: string
  qty: number
  description: string
  model?: string
  unit: string
  unitPrice: number
}> {
  const byId = new Map<
    string,
    { orderItemId: string; qty: number; description: string; model?: string; unit: string; unitPrice: number }
  >()
  for (const line of order.returnLines || []) {
    const itemId = String(line.orderItemId || "").trim()
    if (!itemId) continue
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
    if (qty <= 0) continue
    const item = (order.items || []).find((i) => i.id === itemId)
    const prev = byId.get(itemId)
    if (prev) {
      prev.qty += qty
      continue
    }
    byId.set(itemId, {
      orderItemId: itemId,
      qty,
      description:
        line.description?.trim() ||
        item?.description?.trim() ||
        line.model?.trim() ||
        item?.model?.trim() ||
        "Item",
      model: line.model?.trim() || item?.model?.trim() || undefined,
      unit: line.unit?.trim() || item?.unit || "pcs",
      unitPrice:
        line.unitPrice != null && Number.isFinite(Number(line.unitPrice))
          ? Number(line.unitPrice)
          : Number(item?.unitPrice) || 0,
    })
  }
  // Legacy full return without returnLines
  if (byId.size === 0 && isOrderReturned(order)) {
    for (const item of order.items || []) {
      byId.set(item.id, {
        orderItemId: item.id,
        qty: Math.max(0, Math.floor(Number(item.qty) || 0)),
        description: item.description || item.model || "Item",
        model: item.model,
        unit: item.unit || "pcs",
        unitPrice: Number(item.unitPrice) || 0,
      })
    }
  }
  return [...byId.values()]
}

/** Merchandise value of returned qty (GST-inclusive line totals). */
export function getOrderReturnedMerchandiseValue(
  order: Pick<Order, "items" | "returnLines" | "status" | "taxPercent">,
): number {
  return getReturnedLinesSummary(order).reduce(
    (sum, line) => sum + line.qty * (Number(line.unitPrice) || 0),
    0,
  )
}

/** Recalculate subtotal / tax / total from current remaining items. */
export function recalculateOrderFinancials<T extends Order>(order: T): T {
  const items = (order.items || []).filter(
    (item) => Math.max(0, Math.floor(Number(item.qty) || 0)) > 0,
  )
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * Math.max(0, Number(item.qty) || 0),
    0,
  )
  const pricing = calculateGstInclusiveTotals({
    subtotalInclGst: subtotal,
    gstPercent: Number(order.taxPercent) || DEFAULT_GST_PERCENT,
    discount: Number(order.discount) || 0,
    discountIsPercentage: order.discountIsPercentage ?? true,
    transportCost: Number(order.transportCost) || 0,
    transportIsPercentage: order.transportIsPercentage ?? false,
    otherCost: Number(order.otherCost) || 0,
    otherCostIsPercentage: order.otherCostIsPercentage ?? false,
  })
  const shipping = Number(order.shipping) || 0
  return {
    ...order,
    items,
    subtotal: pricing.subtotalInclGst,
    tax: pricing.taxAmount,
    taxPercent: pricing.taxPercent,
    discountValue: pricing.discountOnBase,
    transportCostValue: pricing.transportAmount,
    otherCostValue: pricing.otherAmount,
    total: pricing.total + shipping,
  }
}

/** Subtract returned qty from order items (items become remaining merchandise). */
export function applyReturnQtyDeltaToItems(
  items: OrderItem[],
  delta: Array<{ orderItemId: string; qty: number }>,
): OrderItem[] {
  const reduceBy = new Map<string, number>()
  for (const line of delta) {
    const itemId = String(line.orderItemId || "").trim()
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
    if (!itemId || qty <= 0) continue
    reduceBy.set(itemId, (reduceBy.get(itemId) || 0) + qty)
  }
  if (reduceBy.size === 0) return items
  return items
    .map((item) => {
      const cut = reduceBy.get(item.id) || 0
      if (cut <= 0) return item
      return {
        ...item,
        qty: Math.max(0, Math.floor(Number(item.qty) || 0) - cut),
      }
    })
    .filter((item) => Math.floor(Number(item.qty) || 0) > 0)
}

/**
 * Ensure order items/totals reflect returnLines.
 * Safe to call repeatedly when `returnMerchandiseApplied` is already true (no-op unless delta provided).
 */
export function applyReturnMerchandiseToOrder(
  order: Order,
  options?: { deltaOnly?: Array<{ orderItemId: string; qty: number }> },
): Order {
  if (options?.deltaOnly && options.deltaOnly.length > 0) {
    const items = applyReturnQtyDeltaToItems(order.items || [], options.deltaOnly)
    return recalculateOrderFinancials({
      ...order,
      items,
      returnMerchandiseApplied: true,
    })
  }

  if (order.returnMerchandiseApplied) {
    return recalculateOrderFinancials(order)
  }

  const returnedByItem = getReturnedQtyByItemId(order)
  if (returnedByItem.size === 0) {
    return { ...order, returnMerchandiseApplied: true }
  }

  const delta = [...returnedByItem.entries()].map(([orderItemId, qty]) => ({
    orderItemId,
    qty,
  }))
  const items = applyReturnQtyDeltaToItems(order.items || [], delta)
  return recalculateOrderFinancials({
    ...order,
    items,
    returnMerchandiseApplied: true,
  })
}

/** Suggested refund for a set of return quantities (this batch). */
export function getSuggestedReturnRefund(
  order: Pick<Order, "items" | "taxPercent" | "payments" | "status" | "returnPayments" | "cashbackPayments">,
  returnQtys: Record<string, number>,
): number {
  let subtotal = 0
  for (const item of order.items || []) {
    const qty = Math.max(0, Math.floor(Number(returnQtys[item.id]) || 0))
    if (qty <= 0) continue
    subtotal += qty * (Number(item.unitPrice) || 0)
  }
  const taxPercent = Number(order.taxPercent) || 0
  const merchandise = subtotal * (1 + taxPercent / 100)
  const amountPaid = getOrderAmountPaid(order)
  const alreadyReturned = getOrderReturnAmount(order)
  const alreadyCashbackOrder = getOrderCashbackAmount(order, "order")
  const refundable = Math.max(0, amountPaid - alreadyReturned - alreadyCashbackOrder)
  if (amountPaid <= 0.004) return 0
  return Math.min(merchandise, refundable)
}

/** Order contribution to CRM totals — remaining order total after merchandise returns. */
export function getOrderNetSalesValue(
  order: Pick<
    Order,
    | "total"
    | "status"
    | "returnPayments"
    | "items"
    | "returnLines"
    | "taxPercent"
    | "returnMerchandiseApplied"
  >,
) {
  const total = Number(order.total) || 0
  // Totals already exclude returned lines once merchandise was applied.
  if (order.returnMerchandiseApplied) return total
  if (isOrderReturned(order) && !(order.returnLines || []).length) {
    return Math.max(0, total - getOrderReturnAmount(order))
  }
  const returnedMerch = getOrderReturnedMerchandiseValue(order)
  if (returnedMerch <= 0.004) return total
  return Math.max(0, total - returnedMerch)
}

export function getOrderReturnPaymentProofUrls(payment: OrderReturnPayment): string[] {
  if (payment.proofUrls && payment.proofUrls.length > 0) return payment.proofUrls
  if (payment.proofUrl) return [payment.proofUrl]
  return []
}

/** Delivered orders with remaining returnable qty can be (partially) returned. */
export function canReturnOrder(
  order: Pick<Order, "status" | "source" | "items" | "returnLines" | "returnMerchandiseApplied" | "inventoryDeductedAt">,
) {
  if (order.status !== "delivered") return false
  if (String(order.source || "").trim().toLowerCase() === "branch_pos") {
    if (!order.inventoryDeductedAt) return false
  }
  return orderHasReturnableQty(order)
}

export function canReplaceOrderItem(
  order: Pick<Order, "status" | "source" | "inventoryDeductedAt" | "items">,
) {
  if (order.status !== "delivered") return false
  if (String(order.source || "").trim().toLowerCase() === "branch_pos") return false
  if (!order.inventoryDeductedAt) return false
  return order.items.some((item) => !item.isCustom && Math.floor(Number(item.qty) || 0) > 0)
}

export function canAddReturnPayment(
  order: Pick<Order, "status" | "items" | "returnLines" | "returnedAt">,
) {
  return isOrderReturned(order) || orderHasAnyReturns(order)
}

/** Mistaken refunds can be removed; merchandise return / stock stay unchanged. */
export function isReturnPaymentDeletable(
  order: Pick<Order, "status" | "items" | "returnLines" | "returnedAt">,
) {
  return canAddReturnPayment(order)
}

export function isOrderOnCredit(order: Pick<Order, "paymentTerms" | "creditApprovedAt">) {
  return order.paymentTerms === "credit" || !!order.creditApprovedAt
}

export function isCreditCleared(order: Pick<Order, "total" | "payments" | "status" | "paymentTerms">) {
  if (!isOrderOnCredit(order)) return true
  return getOrderCreditBalance(order) <= 0.004
}

export function hasOutstandingCredit(order: Pick<Order, "total" | "payments" | "status" | "paymentTerms" | "creditApprovedAt">) {
  if (isOrderReturned(order)) return false
  return isOrderOnCredit(order) && getOrderCreditBalance(order) > 0.004
}

/** Delivered orders: record payments locally without sending to Finance for approval. */
export function isPostDeliveryPaymentCapture(order: Pick<Order, "status">) {
  return order.status === "delivered"
}

/** Delivered on credit — collect payment amount + proof against outstanding balance. */
export function isDeliveredCreditPaymentCapture(
  order: Pick<Order, "status" | "total" | "payments" | "paymentTerms" | "creditApprovedAt">,
) {
  return isPostDeliveryPaymentCapture(order) && hasOutstandingCredit(order)
}

export function canCapturePaymentsForOrder(order: Pick<Order, "status" | "paymentTerms" | "creditApprovedAt" | "total" | "payments">) {
  if (isOrderReturned(order)) return false
  if (order.status === "approved" || order.status === "finalized" || order.status === "payment_added") {
    return true
  }
  if (order.status === "delivered") {
    return true
  }
  if (["confirmed", "processing", "shipped"].includes(order.status)) {
    return hasOutstandingCredit(order)
  }
  return false
}

export function isOrderPaymentLocked(order: Pick<Order, "status" | "paymentTerms" | "total" | "payments" | "creditApprovedAt">) {
  if (["cancelled", "rejected", "draft", "pending_approval", "returned"].includes(order.status)) return true
  if (isPostDeliveryPaymentCapture(order)) return false
  if (hasOutstandingCredit(order)) return false
  return ["confirmed", "processing", "shipped"].includes(order.status)
}

export function orderHasPendingFinancePayments(order: Pick<Order, "payments" | "status">) {
  return (order.payments || []).some(
    p => getPaymentSubmissionStatus(p, order.status) === "pending_approval"
  )
}

export function shouldShowOrderInFinance(order: Pick<Order, "status" | "payments" | "source" | "notes">) {
  if (String(order.source || "").trim().toLowerCase() === "branch_pos") return false
  if (order.notes?.includes("Branch POS ·")) return false
  return (
    order.status === "finalized" ||
    order.status === "payment_added" ||
    order.status === "confirmed" ||
    order.status === "processing" ||
    order.status === "shipped" ||
    order.status === "delivered" ||
    (order.status === "approved" && orderHasPendingFinancePayments(order))
  )
}

export function getSubmittedPayments(payments: OrderPayment[] = [], orderStatus?: Order["status"]) {
  return payments.filter(p => {
    const s = getPaymentSubmissionStatus(p, orderStatus)
    return s === "pending_approval" || s === "approved"
  })
}

export function getBalanceSubmittedPayments(
  payments: OrderPayment[] = [],
  orderStatus?: Order["status"],
) {
  return getSubmittedPayments(payments, orderStatus).filter(p =>
    paymentCountsTowardBalance(p, orderStatus),
  )
}

export function getProofOnlyPayments(payments: OrderPayment[] = [], orderStatus?: Order["status"]) {
  return getSubmittedPayments(payments, orderStatus).filter(p => isProofOnlyPayment(p))
}

/** Mark surplus post-delivery payments as proof-only (fixes mistaken amounts). */
export function reconcileDeliveredOrderPayments(
  order: Pick<Order, "total" | "payments" | "status">,
): OrderPayment[] {
  if (order.status !== "delivered") {
    return (order.payments || []).map(p => ({ ...p }))
  }

  const sorted = [...(order.payments || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  let balancePaid = 0
  const total = Number(order.total) || 0

  return sorted.map((payment) => {
    const next = { ...payment }
    if (next.proofOnly) {
      next.amount = 0
      return next
    }

    const status = getPaymentSubmissionStatus(next, order.status)
    const counts = status === "pending_approval" || status === "approved"
    if (!counts) return next

    if (balancePaid >= total - 0.004) {
      next.proofOnly = true
      next.amount = 0
      return next
    }

    if (next.amount > total + 0.004 && balancePaid > 0.004) {
      next.proofOnly = true
      next.amount = 0
      return next
    }

    balancePaid += next.amount
    if (balancePaid > total + 0.004) {
      balancePaid -= next.amount
      next.proofOnly = true
      next.amount = 0
    }
    return next
  })
}

export function getDraftPayments(payments: OrderPayment[] = [], orderStatus?: Order["status"]) {
  return payments.filter(p => getPaymentSubmissionStatus(p, orderStatus) === "draft")
}

export function getOrderPaymentProofUrls(payment: OrderPayment): string[] {
  if (payment.proofUrls && payment.proofUrls.length > 0) return payment.proofUrls
  if (payment.proofUrl) return [payment.proofUrl]
  return []
}

export function rowToOrder(r: Record<string, unknown>): Order {
  return {
    id: r.id as string,
    orderNumber: r.orderNumber as string,
    clientId: r.clientId as string,
    clientName: r.clientName as string,
    warrantyHolderName: ((r.warrantyHolderName as string) || "").trim() || undefined,
    items: (r.items as OrderItem[]) ?? [],
    subtotal: (r.subtotal as number) ?? 0,
    taxPercent: (r.taxPercent as number) ?? 0,
    tax: (r.tax as number) ?? 0,
    transportCost: (r.transportCost as number) ?? 0,
    transportLabel: (r.transportLabel as string) ?? "Transport",
    otherCost: (r.otherCost as number) ?? 0,
    otherCostLabel: (r.otherCostLabel as string) ?? "Other",
    shipping: (r.shipping as number) ?? 0,
    discount: (r.discount as number) ?? 0,
    total: (r.total as number) ?? 0,
    status: r.status as OrderStatus,
    notes: r.notes as string,
    createdAt: r.createdAt as string,
    createdBy: r.createdBy as string,
    ownerUserId: (r.ownerUserId as string) ?? undefined,
    salesAgentCommissionPercent: (r.salesAgentCommissionPercent as number) ?? undefined,
    salesAgentCommissionAmount: (r.salesAgentCommissionAmount as number) ?? undefined,
    deliveryAddress: (r.deliveryAddress as string) ?? "",
    deliveryDate: (r.deliveryDate as string) ?? "",
    dispatcher: (r.dispatcher as string) ?? undefined,
    pdfUrl: (r.pdfUrl as string) ?? undefined,
    payments: (r.payments as OrderPayment[]) ?? [],
    fulfillmentDispatcher: (r.fulfillmentDispatcher as string) ?? undefined,
    fulfillmentReceiverName: (r.fulfillmentReceiverName as string) ?? undefined,
    fulfillmentReceiverCnic: (r.fulfillmentReceiverCnic as string) ?? undefined,
    fulfillmentVehicleNumber: (r.fulfillmentVehicleNumber as string) ?? undefined,
    fulfillmentDate: (r.fulfillmentDate as string) ?? undefined,
    fulfillmentReceiverImageUrl: (r.fulfillmentReceiverImageUrl as string) ?? undefined,
    fulfillmentReceiverCnicImageUrl: (r.fulfillmentReceiverCnicImageUrl as string) ?? undefined,
    fulfillmentVehicleImageUrl: (r.fulfillmentVehicleImageUrl as string) ?? undefined,
    fulfillmentProductImageUrls: Array.isArray(r.fulfillmentProductImageUrls)
      ? (r.fulfillmentProductImageUrls as string[])
      : undefined,
    fulfillmentSerialAllocations: Array.isArray(r.fulfillmentSerialAllocations)
      ? (r.fulfillmentSerialAllocations as OrderFulfillmentSerialAllocation[])
      : undefined,
    inventoryDeductedAt: (r.inventoryDeductedAt as string) ?? undefined,
    branchId: (r.branchId as string) ?? undefined,
    source: (r.source as string) ?? undefined,
    paymentTerms: (r.paymentTerms as OrderPaymentTerms) ?? "full",
    creditApprovedAt: (r.creditApprovedAt as string) ?? undefined,
    creditApprovedBy: (r.creditApprovedBy as string) ?? undefined,
    creditNote: (r.creditNote as string) ?? undefined,
    returnedAt: (r.returnedAt as string) ?? undefined,
    returnedBy: (r.returnedBy as string) ?? undefined,
    returnReason: (r.returnReason as string) ?? undefined,
    inventoryReturnedAt: (r.inventoryReturnedAt as string) ?? undefined,
    returnPayments: Array.isArray(r.returnPayments)
      ? (r.returnPayments as OrderReturnPayment[])
      : [],
    returnLines: Array.isArray(r.returnLines)
      ? (r.returnLines as OrderReturnLine[])
      : [],
    returnMerchandiseApplied: Boolean(r.returnMerchandiseApplied),
    replacementLines: Array.isArray(r.replacementLines)
      ? (r.replacementLines as OrderReplacementLine[])
      : [],
    cashbackPayments: Array.isArray(r.cashbackPayments)
      ? (r.cashbackPayments as OrderCashbackPayment[])
      : [],
  }
}

/** After save: clear credit flag when balance is fully paid. */
export function normalizeOrderPaymentTerms(order: Order): Order {
  if (!isOrderOnCredit(order)) return order
  if (!isCreditCleared(order)) return order
  return {
    ...order,
    paymentTerms: "full",
    creditNote: order.creditNote,
  }
}

export async function getOrders(options?: { statusGroup?: "pending" | "approved" }): Promise<Order[]> {
  try {
    const qs = options?.statusGroup ? `?statusGroup=${options.statusGroup}` : ""
    const res = await fetch(`/api/db/orders${qs}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data ?? []).map(rowToOrder)
  } catch { return [] }
}

export type CrmApprovalOrdersPayload = {
  pending: Order[]
  approved: Order[]
  counts: { pending: number; approved: number }
}

export async function getCrmApprovalOrders(): Promise<CrmApprovalOrdersPayload> {
  try {
    const res = await fetch("/api/dashboard/crm-approvals")
    if (!res.ok) {
      return { pending: [], approved: [], counts: { pending: 0, approved: 0 } }
    }
    const data = await res.json()
    return {
      pending: (data.pending ?? []).map(rowToOrder),
      approved: (data.approved ?? []).map(rowToOrder),
      counts: {
        pending: Number(data.counts?.pending) || 0,
        approved: Number(data.counts?.approved) || 0,
      },
    }
  } catch {
    return { pending: [], approved: [], counts: { pending: 0, approved: 0 } }
  }
}

export async function saveOrder(order: Order): Promise<Order> {
  const payload = normalizeOrderPaymentTerms(order)
  const res = await fetch("/api/db/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || "Failed to save order")
  }
  const data = await res.json().catch(() => null)
  return data ? rowToOrder(data) : order
}

export async function deleteOrder(id: string): Promise<void> {
  const res = await fetch("/api/db/orders", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || "Failed to delete order")
  }
}

export async function generateOrderNumber(): Promise<string> {
  try {
    const res = await fetch("/api/db/orders/next-number", { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to reserve order number")
    const { orderNumber } = await res.json()
    return String(orderNumber || "").trim() || `ORD-${Date.now()}`
  } catch {
    return `ORD-${Date.now()}`
  }
}

export type OrderSourceOptions = {
  salesAgentUserIds?: ReadonlySet<string>
}

/** True only when ownerUserId belongs to a sales_agent account (not main CRM users like CEO/finance). */
export function isSalesAgentOrder(
  order: Pick<Order, "ownerUserId">,
  options?: OrderSourceOptions
) {
  if (!order.ownerUserId) return false
  if (!options?.salesAgentUserIds) return false
  return options.salesAgentUserIds.has(order.ownerUserId)
}

export function getOrderSourcePdfLabel(
  order: Pick<Order, "ownerUserId" | "createdBy">,
  options?: OrderSourceOptions
) {
  if (isSalesAgentOrder(order, options)) {
    return `Sales agent · ${order.createdBy || "—"}`
  }
  const name = order.createdBy?.trim()
  if (name) return `Created by · ${name}`
  return "CRM"
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  finalized: "Finalized",
  payment_added: "Payment Added - Pending Approval",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700",
  pending_approval: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800",
  approved: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800",
  rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800",
  finalized: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800",
  payment_added: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800",
  processing: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-800",
  shipped: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800",
  delivered: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800",
  returned: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800",
  cancelled: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
}
