import type { Order } from "@/lib/orders"

/** Orders allowed to edit invoice line items and totals after confirmation. */
export const INVOICE_EDITABLE_ORDER_NUMBERS = new Set(["ORD-00048"])

const INVOICE_EDITABLE_STATUSES = new Set([
  "finalized",
  "payment_added",
  "approved",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
])

export function canEditOrderInvoice(order: Pick<Order, "orderNumber" | "status">): boolean {
  if (!INVOICE_EDITABLE_ORDER_NUMBERS.has(order.orderNumber)) return false
  return INVOICE_EDITABLE_STATUSES.has(order.status)
}
