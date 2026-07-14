import type { Order, OrderItem } from "@/lib/orders"

/** Company list price for a line (falls back to unitPrice for older POS rows). */
export function resolveCompanyUnitPrice(item: Pick<OrderItem, "unitPrice" | "companyPrice">): number {
  const company = Number(item.companyPrice)
  if (Number.isFinite(company) && company >= 0) return company
  return Number(item.unitPrice) || 0
}

export function getPosLineCompanyAmount(item: Pick<OrderItem, "qty" | "unitPrice" | "companyPrice">): number {
  return (Number(item.qty) || 0) * resolveCompanyUnitPrice(item)
}

export function getPosLineSellAmount(item: Pick<OrderItem, "qty" | "unitPrice">): number {
  return (Number(item.qty) || 0) * (Number(item.unitPrice) || 0)
}

export function getPosLineProfit(item: Pick<OrderItem, "qty" | "unitPrice" | "companyPrice">): number {
  return getPosLineSellAmount(item) - getPosLineCompanyAmount(item)
}

/** Sum of company list prices on POS order lines. */
export function getPosOrderCompanyAmount(order: Pick<Order, "items">): number {
  return (order.items || []).reduce((sum, item) => sum + getPosLineCompanyAmount(item), 0)
}

/** Sum of customer/selling prices on POS order lines. */
export function getPosOrderSellAmount(order: Pick<Order, "items">): number {
  return (order.items || []).reduce((sum, item) => sum + getPosLineSellAmount(item), 0)
}

/** Profit = customer prices − company list prices (POS orders only). */
export function getPosOrderProfit(order: Pick<Order, "items">): number {
  return getPosOrderSellAmount(order) - getPosOrderCompanyAmount(order)
}

export function summarizePosOrdersProfit(orders: Pick<Order, "items">[]) {
  return orders.reduce(
    (acc, order) => {
      const company = getPosOrderCompanyAmount(order)
      const sell = getPosOrderSellAmount(order)
      return {
        companyAmount: acc.companyAmount + company,
        sellAmount: acc.sellAmount + sell,
        profit: acc.profit + (sell - company),
        count: acc.count + 1,
      }
    },
    { companyAmount: 0, sellAmount: 0, profit: 0, count: 0 },
  )
}
