// DB access via /api/db routes (Prisma)

import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"

export type { OrderFulfillmentSerialAllocation }

export type OrderStatus = "draft" | "pending_approval" | "approved" | "rejected" | "finalized" | "payment_added" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"

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
  return ["finalized", "payment_added", "approved", "confirmed", "processing", "shipped", "delivered"].includes(order.status)
}

export interface Order {
  id: string
  orderNumber: string
  clientId: string
  clientName: string
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

export function getOrderCreditBalance(order: Pick<Order, "total" | "payments" | "status">) {
  return Math.max(0, Number(order.total) - getOrderAmountPaid(order))
}

export function isOrderOnCredit(order: Pick<Order, "paymentTerms" | "creditApprovedAt">) {
  return order.paymentTerms === "credit" || !!order.creditApprovedAt
}

export function isCreditCleared(order: Pick<Order, "total" | "payments" | "status" | "paymentTerms">) {
  if (!isOrderOnCredit(order)) return true
  return getOrderCreditBalance(order) <= 0.004
}

export function hasOutstandingCredit(order: Pick<Order, "total" | "payments" | "status" | "paymentTerms" | "creditApprovedAt">) {
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
  if (["cancelled", "rejected", "draft", "pending_approval"].includes(order.status)) return true
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

function rowToOrder(r: Record<string, unknown>): Order {
  return {
    id: r.id as string,
    orderNumber: r.orderNumber as string,
    clientId: r.clientId as string,
    clientName: r.clientName as string,
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
  cancelled: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
}
