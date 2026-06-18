import type { OrderPayment, Order } from "@/lib/orders"
import {
  getOrderAmountPaid,
  getPaymentSubmissionStatus,
  paymentCountsTowardBalance,
} from "@/lib/orders"

export type FinanceOverviewAction = {
  id: string
  type: "client_payment" | "client_balance" | "po_payment"
  title: string
  subtitle: string
  amount: number
  href: string
  priority: "high" | "medium"
}

export type FinanceOverviewActivity = {
  id: string
  date: string
  label: string
  amount: number
  category: string
  source: "client" | "purchase" | "record" | "petty_cash" | "pos"
}

export function parseOrderPayments(payments: unknown): OrderPayment[] {
  if (!Array.isArray(payments)) return []
  return payments as OrderPayment[]
}

export function orderPaidTotal(order: Pick<Order, "payments" | "status">) {
  return getOrderAmountPaid(order)
}

/** Approved CRM payment amount that counts toward cash-in and balance. */
export function approvedBalancePaymentAmount(
  payment: OrderPayment,
  orderStatus: Order["status"],
): number {
  if (getPaymentSubmissionStatus(payment, orderStatus) !== "approved") return 0
  if (!paymentCountsTowardBalance(payment, orderStatus)) return 0
  return payment.amount
}

export function orderPendingPaymentCount(order: Pick<Order, "payments" | "status">) {
  return (order.payments || []).filter(
    p => getPaymentSubmissionStatus(p, order.status) === "pending_approval"
  ).length
}

export function isFinanceRelevantOrder(order: Pick<Order, "status" | "payments">) {
  const statuses = [
    "finalized", "payment_added", "approved", "confirmed",
    "processing", "shipped", "delivered",
  ]
  if (statuses.includes(order.status)) return true
  if (order.status === "approved" && orderPendingPaymentCount(order) > 0) return true
  return false
}
