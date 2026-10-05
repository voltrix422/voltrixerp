import {
  getBalanceSubmittedPayments,
  getOrderAmountPaid,
  getOrderCreditBalance,
  getOrderNetSalesValue,
  type Order,
} from "@/lib/orders"
import { approvedBalancePaymentAmount } from "@/lib/finance-overview"
import { aggregateOrderPaymentStats } from "@/lib/order-payment-stats"

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function crmPeriodBounds(fromDate?: string, toDate?: string): { start: Date; end: Date } | null {
  const from = String(fromDate || "").trim()
  const to = String(toDate || "").trim()
  if (!from && !to) return null
  const start = from ? startOfDay(new Date(from)) : new Date(0)
  const end = to ? endOfDay(new Date(to)) : endOfDay(new Date())
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start, end }
}

function inRange(d: Date, start: Date, end: Date) {
  return d >= start && d <= end
}

/** Approved payment amounts whose payment date falls in the range. */
export function orderReceivedInPeriod(
  order: Pick<Order, "payments" | "status" | "createdAt">,
  start: Date,
  end: Date,
): number {
  const fallback = order.createdAt ? new Date(order.createdAt) : new Date()
  let received = 0
  for (const p of order.payments || []) {
    const amount = approvedBalancePaymentAmount(p, order.status)
    if (amount <= 0) continue
    const d = new Date(p.date || p.createdAt || fallback)
    if (inRange(d, start, end)) received += amount
  }
  return received
}

/** Last payment date in the period (for row date when cash was received). */
export function orderLastPaymentInPeriod(
  order: Pick<Order, "payments" | "status" | "createdAt">,
  start: Date,
  end: Date,
): Date | null {
  const fallback = order.createdAt ? new Date(order.createdAt) : new Date()
  let last: Date | null = null
  for (const p of order.payments || []) {
    const amount = approvedBalancePaymentAmount(p, order.status)
    if (amount <= 0) continue
    const d = new Date(p.date || p.createdAt || fallback)
    if (!inRange(d, start, end)) continue
    if (!last || d > last) last = d
  }
  return last
}

export function orderHasPaymentInPeriod(
  order: Pick<Order, "payments" | "status" | "createdAt">,
  start: Date,
  end: Date,
): boolean {
  return orderReceivedInPeriod(order, start, end) > 0.004
}

/** Match CRM date filter: order created in range OR payment received in range. */
export function orderMatchesCrmDateRange(
  order: Pick<Order, "createdAt" | "payments" | "status">,
  fromDate: string,
  toDate: string,
): boolean {
  const bounds = crmPeriodBounds(fromDate, toDate)
  if (!bounds) return true
  const { start, end } = bounds
  if (order.createdAt) {
    const created = new Date(order.createdAt)
    if (!Number.isNaN(created.getTime()) && inRange(created, start, end)) return true
  }
  return orderHasPaymentInPeriod(order, start, end)
}

export type CrmPeriodPaymentLine = {
  amount: number
  date?: string
}

/** Submitted balance payments dated in the period (for Paid column). */
export function orderPeriodPaymentLines(
  order: Pick<Order, "payments" | "status" | "createdAt">,
  start: Date,
  end: Date,
): CrmPeriodPaymentLine[] {
  const fallback = order.createdAt || new Date().toISOString()
  return getBalanceSubmittedPayments(order.payments, order.status)
    .filter((p) => {
      const amount = Number(p.amount) || 0
      if (amount <= 0.004) return false
      const d = new Date(p.date || p.createdAt || fallback)
      return inRange(d, start, end)
    })
    .map((p) => ({
      amount: Number(p.amount) || 0,
      date: p.date || p.createdAt,
    }))
}

export type CrmOrdersReportMoney = {
  orderValue: number
  /** Cash received for the report scope (period or lifetime). */
  moneyReceived: number
  outstanding: number
  /** True when totals use payment dates inside the selected range. */
  periodScoped: boolean
}

export function crmOrdersReportMoney(
  orders: Order[],
  dateFrom?: string,
  dateTo?: string,
): CrmOrdersReportMoney {
  const bounds = crmPeriodBounds(dateFrom, dateTo)
  const stats = aggregateOrderPaymentStats(orders)
  const orderValue = stats.totalOrderValue || orders.reduce((sum, o) => sum + getOrderNetSalesValue(o), 0)
  const outstanding = stats.totalOutstanding

  if (!bounds) {
    return {
      orderValue,
      moneyReceived: stats.totalReceived,
      outstanding,
      periodScoped: false,
    }
  }

  const moneyReceived = orders.reduce(
    (sum, order) => sum + orderReceivedInPeriod(order, bounds.start, bounds.end),
    0,
  )
  return {
    orderValue,
    moneyReceived,
    outstanding,
    periodScoped: true,
  }
}

export function crmOrderPaidDisplay(
  order: Order,
  dateFrom?: string,
  dateTo?: string,
): { paid: number; lifetimePaid: number; credit: number; periodScoped: boolean } {
  const lifetimePaid = getOrderAmountPaid(order)
  const credit = getOrderCreditBalance(order)
  const bounds = crmPeriodBounds(dateFrom, dateTo)
  if (!bounds) {
    return { paid: lifetimePaid, lifetimePaid, credit, periodScoped: false }
  }
  return {
    paid: orderReceivedInPeriod(order, bounds.start, bounds.end),
    lifetimePaid,
    credit,
    periodScoped: true,
  }
}
