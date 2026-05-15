import type { Order } from "@/lib/orders"

export function calculateSalesCommission(orderTotal: number, commissionPercent: number) {
  const amount = (orderTotal * commissionPercent) / 100
  return Math.round(amount * 100) / 100
}

export async function applySalesCommissionOnDelivery(order: Order): Promise<Order> {
  if (!order.ownerUserId || order.status !== "delivered") return order
  if (order.salesAgentCommissionAmount != null && order.salesAgentCommissionAmount > 0) {
    return order
  }

  try {
    const res = await fetch(`/api/sales/agents?stats=0`)
    if (!res.ok) return order
    const agents = await res.json()
    const agent = agents.find((a: { id: string }) => a.id === order.ownerUserId)
    if (!agent) return order

    const percent = Number(agent.commissionPercent ?? 0)
    const amount = calculateSalesCommission(order.total, percent)
    return {
      ...order,
      salesAgentCommissionPercent: percent,
      salesAgentCommissionAmount: amount,
    }
  } catch {
    return order
  }
}
