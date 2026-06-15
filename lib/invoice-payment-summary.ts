import type { Order } from "@/lib/orders"
import { getOrderAmountPaid, isOrderOnCredit } from "@/lib/orders"

export type InvoicePaymentSummary = {
  total: number
  amountPaid: number
  balanceDue: number
  isOnCredit: boolean
  hasOutstanding: boolean
  isPaidInFull: boolean
  /** Contract terms shown in the TERMS column */
  paymentTermsLabel: string
  /** Collection status shown in the meta band */
  paymentStatusLabel: string
  showPaymentSection: boolean
}

export function getInvoicePaymentSummary(
  order: Pick<Order, "total" | "payments" | "status" | "paymentTerms" | "creditApprovedAt">,
): InvoicePaymentSummary {
  const total = Number(order.total) || 0
  const amountPaid = getOrderAmountPaid(order)
  const balanceDue = Math.max(0, total - amountPaid)
  const isOnCredit = isOrderOnCredit(order)
  const hasOutstanding = balanceDue > 0.004
  const isPaidInFull =
    total <= 0.004 || (amountPaid > 0.004 && balanceDue <= 0.004)

  const paymentTermsLabel = isOnCredit ? "Credit terms" : "Full payment"

  let paymentStatusLabel = "Payment due"
  if (isPaidInFull) paymentStatusLabel = "Paid in full"
  else if (isOnCredit && hasOutstanding) paymentStatusLabel = "Credit — balance due"
  else if (amountPaid > 0.004) paymentStatusLabel = "Partial payment"

  const showPaymentSection =
    total > 0.004 ||
    amountPaid > 0.004 ||
    isOnCredit ||
    (order.payments?.length ?? 0) > 0

  return {
    total,
    amountPaid,
    balanceDue,
    isOnCredit,
    hasOutstanding,
    isPaidInFull,
    paymentTermsLabel,
    paymentStatusLabel,
    showPaymentSection,
  }
}

export function formatInvoiceMoney(n: number): string {
  return `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`
}
