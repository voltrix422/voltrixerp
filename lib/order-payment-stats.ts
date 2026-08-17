import type { Order, OrderPayment } from "@/lib/orders"
import {
  getOrderAmountPaid,
  getOrderCreditBalance,
  getOrderReturnAmount,
  getOrderCashbackAmount,
  getOrderNetSalesValue,
  getPaymentSubmissionStatus,
  hasOutstandingCredit,
  isOrderOnCredit,
  isOrderReturned,
  paymentCountsTowardBalance,
} from "@/lib/orders"
import { approvedBalancePaymentAmount } from "@/lib/finance-overview"
import { isBranchPosOrderHiddenFromErp } from "@/lib/branch-pos"

/** Same order set as CRM Orders (excludes Branch POS — not ERP client orders). */
export function isCrmErpOrderForPaymentStats(order: {
  source?: string | null
  notes?: string | null
  branchId?: string | null
}): boolean {
  return !isBranchPosOrderHiddenFromErp(order)
}

export type OrderPaymentStatsOrder = Pick<
  Order,
  | "status"
  | "payments"
  | "total"
  | "returnPayments"
  | "cashbackPayments"
  | "paymentTerms"
  | "creditApprovedAt"
  | "items"
  | "returnLines"
  | "taxPercent"
> & {
  createdAt?: string | Date
}

export type OrderPaymentAggregate = {
  orderCount: number
  totalOrderValue: number
  totalReceived: number
  totalOutstanding: number
  deliveredFullyPaidCount: number
  deliveredFullyPaidReceived: number
  partialPaymentCount: number
  partialPaymentsReceived: number
  creditOrderCount: number
  creditOutstanding: number
  creditPaymentsReceived: number
  approvedUnpaidCount: number
  approvedUnpaidOutstanding: number
  otherPaymentsReceived: number
  returnedCount: number
  returnedRefundAmount: number
  cashbackAmount: number
}

export type OrderPaymentPeriodBreakdown = {
  approvedInPeriod: number
  pendingApprovalInPeriod: number
  deliveredFullyPaidInPeriod: number
  partialPaymentsInPeriod: number
  otherPaymentsInPeriod: number
}

export function isDeliveredFullyPaidOrder(order: OrderPaymentStatsOrder): boolean {
  if (order.status !== "delivered") return false
  return getOrderCreditBalance(order) <= 0.004
}

export function isPartiallyPaidOrder(order: OrderPaymentStatsOrder): boolean {
  if (isOrderReturned(order)) return false
  const paid = getOrderAmountPaid(order)
  return paid > 0.004 && getOrderCreditBalance(order) > 0.004
}

export function isApprovedAwaitingPaymentOrder(order: OrderPaymentStatsOrder): boolean {
  if (order.status !== "approved") return false
  if (isOrderOnCredit(order)) return false
  return getOrderCreditBalance(order) > 0.004
}

/** Sum client payments on orders — same logic as CRM Paid column & Finance → Client Orders. */
export function aggregateOrderPaymentStats(
  orders: OrderPaymentStatsOrder[],
): OrderPaymentAggregate {
  const active = orders.filter(o => !isOrderReturned(o))
  const returned = orders.filter(isOrderReturned)

  let totalReceived = 0
  let totalOutstanding = 0
  let deliveredFullyPaidCount = 0
  let deliveredFullyPaidReceived = 0
  let partialPaymentCount = 0
  let partialPaymentsReceived = 0
  let creditOrderCount = 0
  let creditOutstanding = 0
  let creditPaymentsReceived = 0
  let approvedUnpaidCount = 0
  let approvedUnpaidOutstanding = 0
  let otherPaymentsReceived = 0

  for (const order of active) {
    const paid = getOrderAmountPaid(order)
    const balance = getOrderCreditBalance(order)
    totalReceived += paid
    totalOutstanding += balance

    if (isDeliveredFullyPaidOrder(order)) {
      deliveredFullyPaidCount++
      deliveredFullyPaidReceived += paid
    } else if (isPartiallyPaidOrder(order)) {
      partialPaymentCount++
      partialPaymentsReceived += paid
    } else if (hasOutstandingCredit(order)) {
      creditOrderCount++
      creditOutstanding += balance
      creditPaymentsReceived += paid
    } else if (isApprovedAwaitingPaymentOrder(order)) {
      approvedUnpaidCount++
      approvedUnpaidOutstanding += balance
      if (paid > 0.004) otherPaymentsReceived += paid
    } else if (paid > 0.004) {
      otherPaymentsReceived += paid
    }
  }

  return {
    orderCount: active.length,
    totalOrderValue: active.reduce((s, o) => s + getOrderNetSalesValue(o), 0),
    totalReceived,
    totalOutstanding,
    deliveredFullyPaidCount,
    deliveredFullyPaidReceived,
    partialPaymentCount,
    partialPaymentsReceived,
    creditOrderCount,
    creditOutstanding,
    creditPaymentsReceived,
    approvedUnpaidCount,
    approvedUnpaidOutstanding,
    otherPaymentsReceived,
    returnedCount: returned.length,
    returnedRefundAmount: returned.reduce((s, o) => s + getOrderReturnAmount(o), 0),
    cashbackAmount: orders.reduce((s, o) => s + getOrderCashbackAmount(o), 0),
  }
}

function paymentDate(payment: OrderPayment, fallback: Date): Date {
  return new Date(payment.date || fallback.toISOString())
}

/** Approved + pending payments dated within range — bucketed by current order state (CRM-aligned). */
export function aggregateOrderPaymentsInPeriod(
  orders: OrderPaymentStatsOrder[],
  start: Date,
  end: Date,
): OrderPaymentPeriodBreakdown {
  let approvedInPeriod = 0
  let pendingApprovalInPeriod = 0
  let deliveredFullyPaidInPeriod = 0
  let partialPaymentsInPeriod = 0
  let otherPaymentsInPeriod = 0

  const inRange = (d: Date) => d >= start && d <= end

  for (const order of orders) {
    if (isOrderReturned(order)) continue
    const fallback = order.createdAt ? new Date(order.createdAt) : new Date()
    const payments = order.payments || []

    for (const payment of payments) {
      if (!paymentCountsTowardBalance(payment, order.status)) continue
      const d = paymentDate(payment, fallback)
      if (!inRange(d)) continue

      const status = getPaymentSubmissionStatus(payment, order.status)
      const amount = payment.amount || 0
      if (amount <= 0) continue

      if (status === "pending_approval") {
        pendingApprovalInPeriod += amount
        continue
      }
      if (status !== "approved") continue

      const approvedAmount = approvedBalancePaymentAmount(payment, order.status)
      if (approvedAmount <= 0) continue

      approvedInPeriod += approvedAmount

      if (isDeliveredFullyPaidOrder(order)) {
        deliveredFullyPaidInPeriod += approvedAmount
      } else if (isPartiallyPaidOrder(order) || hasOutstandingCredit(order)) {
        partialPaymentsInPeriod += approvedAmount
      } else {
        otherPaymentsInPeriod += approvedAmount
      }
    }
  }

  return {
    approvedInPeriod,
    pendingApprovalInPeriod,
    deliveredFullyPaidInPeriod,
    partialPaymentsInPeriod,
    otherPaymentsInPeriod,
  }
}

export type OrderPaymentReconciliation = {
  crmAllTimeTotalReceived: number
  periodApprovedByPaymentDate: number
  periodPendingApproval: number
  difference: number
  reasons: string[]
}

export function buildOrderPaymentReconciliation(
  allTime: OrderPaymentAggregate,
  period: OrderPaymentPeriodBreakdown,
  periodLabel: string,
): OrderPaymentReconciliation {
  const reasons: string[] = []

  reasons.push(
    `CRM Orders and this panel use the same ERP client orders (Branch POS orders excluded). ${allTime.orderCount} order(s) in scope.`,
  )
  reasons.push(
    `Finance cash snapshot for ${periodLabel} counts only approved payments by payment date: PKR ${period.approvedInPeriod.toLocaleString()}.`,
  )

  if (period.pendingApprovalInPeriod > 0.004) {
    reasons.push(
      `PKR ${period.pendingApprovalInPeriod.toLocaleString()} is submitted in ${periodLabel.toLowerCase()} but still pending finance approval — included in CRM Paid column, not in cash snapshot until approved.`,
    )
  }

  if (allTime.totalReceived > period.approvedInPeriod + 0.004) {
    reasons.push(
      `PKR ${(allTime.totalReceived - period.approvedInPeriod).toLocaleString()} was received on orders before ${periodLabel.toLowerCase()} or outside the selected period (payment date filter).`,
    )
  }

  if (allTime.partialPaymentsReceived > 0.004) {
    reasons.push(
      `Partial payments (PKR ${allTime.partialPaymentsReceived.toLocaleString()} on ${allTime.partialPaymentCount} order(s)) are part of total received and also appear in the period breakdown when payment date falls in range.`,
    )
  }

  if (allTime.creditPaymentsReceived > 0.004) {
    reasons.push(
      `Credit orders: PKR ${allTime.creditPaymentsReceived.toLocaleString()} received so far; PKR ${allTime.creditOutstanding.toLocaleString()} still outstanding on ${allTime.creditOrderCount} order(s).`,
    )
  }

  const difference = period.approvedInPeriod - allTime.totalReceived

  return {
    crmAllTimeTotalReceived: allTime.totalReceived,
    periodApprovedByPaymentDate: period.approvedInPeriod,
    periodPendingApproval: period.pendingApprovalInPeriod,
    difference,
    reasons,
  }
}
