import type { Order } from "@/lib/orders"
import {
  getOrderAmountPaid,
  getOrderCreditBalance,
  hasOutstandingCredit,
  isCreditCleared,
  isOrderOnCredit,
} from "@/lib/orders"

export type InvoicePaymentSummary = {
  total: number
  amountPaid: number
  balanceDue: number
  isOnCredit: boolean
  hasOutstanding: boolean
  isPaidInFull: boolean
  /** Shown on invoice: Credit, Partial payment, Paid in full, Payment due */
  paymentStatusLabel: string
  showPaymentSection: boolean
}

export function getInvoicePaymentSummary(
  order: Pick<Order, "total" | "payments" | "status" | "paymentTerms" | "creditApprovedAt">,
): InvoicePaymentSummary {
  const total = Number(order.total) || 0
  const amountPaid = getOrderAmountPaid(order)
  const balanceDue = getOrderCreditBalance(order)
  const isOnCredit = isOrderOnCredit(order)
  const hasOutstanding = hasOutstandingCredit(order)
  const isPaidInFull = isCreditCleared(order) || balanceDue <= 0.004

  let paymentStatusLabel = "Payment due"
  if (isPaidInFull) paymentStatusLabel = "Paid in full"
  else if (isOnCredit && hasOutstanding) paymentStatusLabel = "Credit"
  else if (amountPaid > 0.004) paymentStatusLabel = "Partial payment"

  const showPaymentSection =
    amountPaid > 0.004 || isOnCredit || balanceDue > 0.004 || (order.payments?.length ?? 0) > 0

  return {
    total,
    amountPaid,
    balanceDue,
    isOnCredit,
    hasOutstanding,
    isPaidInFull,
    paymentStatusLabel,
    showPaymentSection,
  }
}

export function formatInvoiceMoney(n: number): string {
  return `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`
}
