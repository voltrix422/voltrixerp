import type { Order } from "@/lib/orders"
import type { Client } from "@/lib/crm"

export type ClientSalesInfo = {
  totalSales: number
  orderCount: number
  salesRank: number
}

export function buildClientSalesMap(orders: Order[]): Map<string, Omit<ClientSalesInfo, "salesRank">> {
  const map = new Map<string, Omit<ClientSalesInfo, "salesRank">>()
  for (const order of orders) {
    if (order.status !== "delivered") continue
    const id = order.clientId?.trim()
    if (!id) continue
    const prev = map.get(id) || { totalSales: 0, orderCount: 0 }
    prev.totalSales += Number(order.total) || 0
    prev.orderCount += 1
    map.set(id, prev)
  }
  return map
}

export function assignSalesRanks(
  clients: Client[],
  salesMap: Map<string, Omit<ClientSalesInfo, "salesRank">>,
): Map<string, ClientSalesInfo> {
  const ranked = [...clients]
    .map((c) => ({
      id: c.id,
      totalSales: salesMap.get(c.id)?.totalSales ?? 0,
    }))
    .filter((c) => c.totalSales > 0)
    .sort((a, b) => b.totalSales - a.totalSales)

  const result = new Map<string, ClientSalesInfo>()
  for (const client of clients) {
    const stats = salesMap.get(client.id) || { totalSales: 0, orderCount: 0 }
    const rankIndex = ranked.findIndex((r) => r.id === client.id)
    result.set(client.id, {
      ...stats,
      salesRank: rankIndex >= 0 ? rankIndex + 1 : 0,
    })
  }
  return result
}

export function sortClientsBySales<T extends Client>(
  clients: T[],
  salesMap: Map<string, ClientSalesInfo>,
): T[] {
  return [...clients].sort((a, b) => {
    const sa = salesMap.get(a.id)?.totalSales ?? 0
    const sb = salesMap.get(b.id)?.totalSales ?? 0
    if (sb !== sa) return sb - sa
    return a.name.localeCompare(b.name)
  })
}

export function getDeliveredOrdersForClient(orders: Order[], clientId: string): Order[] {
  return orders.filter((o) => o.clientId === clientId && o.status === "delivered")
}
