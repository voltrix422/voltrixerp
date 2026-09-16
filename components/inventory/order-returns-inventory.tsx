"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getOrders,
  getOrderReturnAmount,
  getItemReturnedQty,
  orderHasAnyReturns,
  resolveOrderItemModel,
  STATUS_LABELS,
  type Order,
} from "@/lib/orders"
import { isBranchPosOrderHiddenFromErp } from "@/lib/branch-pos"
import { Search } from "lucide-react"

function formatPkr(amount: number) {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

function getReturnedStockQty(order: Order): number {
  return order.items.reduce((sum, item) => {
    if (item.isCustom) return sum
    return sum + getItemReturnedQty(order, item.id)
  }, 0)
}

export function OrderReturnsInventory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    getOrders()
      .then((all) => {
        setOrders(
          all.filter(
            (o) => orderHasAnyReturns(o) && !isBranchPosOrderHiddenFromErp(o),
          ),
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      if (o.orderNumber?.toLowerCase().includes(q)) return true
      if (o.clientName?.toLowerCase().includes(q)) return true
      if (o.returnReason?.toLowerCase().includes(q)) return true
      return o.items.some((item) => {
        const returnedQty = getItemReturnedQty(o, item.id)
        if (returnedQty <= 0) return false
        const model = resolveOrderItemModel(item)?.toLowerCase() || ""
        return (
          model.includes(q) ||
          (item.description || "").toLowerCase().includes(q)
        )
      })
    })
  }, [orders, search])

  const totalQty = filtered.reduce((sum, o) => sum + getReturnedStockQty(o), 0)
  const totalRefunded = filtered.reduce((sum, o) => sum + getOrderReturnAmount(o), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading order returns...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          <span>Orders <span className="tabular-nums font-medium text-[hsl(var(--foreground))]">{filtered.length}</span></span>
          <span>Qty returned <span className="tabular-nums font-medium text-[hsl(var(--foreground))]">{totalQty}</span></span>
          <span>Refunded <span className="tabular-nums font-medium text-[hsl(var(--foreground))]">{formatPkr(totalRefunded)}</span></span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, client, model..."
            className="w-full h-7 pl-7 pr-2 border border-[hsl(var(--border))] bg-transparent text-[11px] focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-8">
          {orders.length === 0 ? "No order returns yet." : "No returns match your search."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            const lines = order.items.filter((item) => !item.isCustom && getItemReturnedQty(order, item.id) > 0)
            return (
              <div key={order.id} className="border border-[hsl(var(--border))]">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 py-1.5 border-b border-[hsl(var(--border))]">
                  <p className="text-xs">
                    {order.orderNumber}
                    <span className="text-[hsl(var(--muted-foreground))]">
                      {" · "}
                      {STATUS_LABELS[order.status] || order.status}
                      {order.status === "delivered" ? " · Partial return" : ""}
                      {" · "}
                      {order.clientName}
                    </span>
                  </p>
                  <p className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
                    Refunded {formatPkr(getOrderReturnAmount(order))}
                  </p>
                </div>
                <p className="px-2 py-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                  {order.returnedAt
                    ? `Returned ${new Date(order.returnedAt).toLocaleDateString()}`
                    : "Returned"}
                  {order.returnedBy ? ` · ${order.returnedBy}` : ""}
                  {order.inventoryReturnedAt ? " · Full stock restored" : " · Partial stock restored"}
                  {order.returnReason ? ` · ${order.returnReason}` : ""}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-t border-[hsl(var(--border))] text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        <th className="px-2 py-1.5 font-medium">Model</th>
                        <th className="px-2 py-1.5 font-medium">Description</th>
                        <th className="px-2 py-1.5 font-medium text-right">Returned</th>
                        <th className="px-2 py-1.5 font-medium text-right">Ordered</th>
                        <th className="px-2 py-1.5 font-medium">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-2 py-2 text-[hsl(var(--muted-foreground))]">
                            No inventory lines on this return (custom items only)
                          </td>
                        </tr>
                      ) : (
                        lines.map((item) => (
                          <tr key={item.id} className="border-t border-[hsl(var(--border))]">
                            <td className="px-2 py-1.5 whitespace-nowrap">{resolveOrderItemModel(item) || "—"}</td>
                            <td className="px-2 py-1.5">{item.description || "—"}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{getItemReturnedQty(order, item.id)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{item.qty}</td>
                            <td className="px-2 py-1.5">{item.unit || "pcs"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
