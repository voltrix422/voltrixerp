// DB access via /api/db routes (Prisma)

import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"

export type { OrderFulfillmentSerialAllocation }

export type OrderStatus = "draft" | "pending_approval" | "approved" | "rejected" | "finalized" | "payment_added" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"

export interface OrderItem {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  isCustom: boolean // true if custom item, false if from inventory
  inventoryItemId?: string // reference to inventory item if not custom
  model?: string // warehouse model number when from inventory
  availableQty?: number // available quantity in stock (for validation, not saved to DB)
  costPrice?: number // cost price from inventory (for reference, not saved to DB)
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
  const status = getPaymentSubmissionStatus(payment, orderStatus)
  return status === "draft" || status === "pending_approval"
}

export function canCapturePaymentsForOrder(order: Pick<Order, "status">) {
  return order.status === "approved" || order.status === "finalized" || order.status === "payment_added"
}

export function orderHasPendingFinancePayments(order: Pick<Order, "payments" | "status">) {
  return (order.payments || []).some(
    p => getPaymentSubmissionStatus(p, order.status) === "pending_approval"
  )
}

export function shouldShowOrderInFinance(order: Pick<Order, "status" | "payments">) {
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
  }
}

export async function getOrders(): Promise<Order[]> {
  try {
    const res = await fetch("/api/db/orders")
    if (!res.ok) return []
    const data = await res.json()
    return (data ?? []).map(rowToOrder)
  } catch { return [] }
}

export async function saveOrder(order: Order): Promise<void> {
  const res = await fetch("/api/db/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  })
  if (!res.ok) console.error("saveOrder error:", res.statusText)
}

export async function deleteOrder(id: string): Promise<void> {
  await fetch("/api/db/orders", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function generateOrderNumber(): Promise<string> {
  try {
    const res = await fetch("/api/db/orders/count")
    const { count } = await res.json()
    const n = (count ?? 0) + 1
    return `ORD-${String(n).padStart(5, "0")}`
  } catch { return `ORD-${Date.now()}` }
}

export function isSalesAgentOrder(order: Pick<Order, "ownerUserId">) {
  return !!order.ownerUserId
}

export function getOrderSourcePdfLabel(order: Pick<Order, "ownerUserId" | "createdBy">) {
  if (order.ownerUserId) return `Sales agent · ${order.createdBy || "—"}`
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
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending_approval: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  finalized: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  payment_added: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
}
