"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getOrders,
  getOrderReturnAmount,
  resolveOrderItemModel,
  type Order,
} from "@/lib/orders"
import { isBranchPosOrderHiddenFromErp } from "@/lib/branch-pos"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { getCrmItemsTotalQty } from "@/lib/crm-line-items-summary"
import { Search, RotateCcw, Package } from "lucide-react"

function formatPkr(amount: number) {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
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
            (o) => o.status === "returned" && !isBranchPosOrderHiddenFromErp(o),
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
        const model = resolveOrderItemModel(item)?.toLowerCase() || ""
        return (
          model.includes(q) ||
          (item.description || "").toLowerCase().includes(q)
        )
      })
    })
  }, [orders, search])

  const totalQty = filtered.reduce((sum, o) => sum + getCrmItemsTotalQty(o.items), 0)
  const totalRefunded = filtered.reduce((sum, o) => sum + getOrderReturnAmount(o), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading order returns...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-orange-600" />
            Stock returned from orders
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Items put back into inventory when a CRM order was returned
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, client, model..."
            className="w-full h-9 pl-8 pr-3 rounded-md border bg-[hsl(var(--background))] text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border bg-[hsl(var(--muted))]/20 px-4 py-3 text-xs">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Returned orders
          </p>
          <p className="text-lg font-bold tabular-nums">{filtered.length}</p>
        </div>
        <div className="sm:border-l sm:pl-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Stock qty returned
          </p>
          <p className="text-lg font-bold tabular-nums">{totalQty}</p>
        </div>
        <div className="sm:border-l sm:pl-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Refunded
          </p>
          <p className="text-sm sm:text-lg font-bold tabular-nums text-orange-700">
            {formatPkr(totalRefunded)}
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-10 w-10 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {orders.length === 0
              ? "No order returns yet"
              : "No returns match your search"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="rounded-lg border bg-[hsl(var(--card))] overflow-hidden"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 border-b bg-[hsl(var(--muted))]/15">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-[hsl(var(--primary))]">
                      {order.orderNumber}
                    </p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="text-sm mt-0.5 capitalize">{order.clientName}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                    {order.returnedAt
                      ? `Returned ${new Date(order.returnedAt).toLocaleDateString()}`
                      : "Returned"}
                    {order.returnedBy ? ` · ${order.returnedBy}` : ""}
                    {order.inventoryReturnedAt ? " · Stock restored" : ""}
                  </p>
                </div>
                <div className="text-right text-xs shrink-0">
                  <p className="text-[10px] uppercase font-semibold text-[hsl(var(--muted-foreground))]">
                    Refunded
                  </p>
                  <p className="font-bold text-orange-700">
                    {formatPkr(getOrderReturnAmount(order))}
                  </p>
                </div>
              </div>

              {order.returnReason && (
                <div className="px-4 py-2 border-b text-xs">
                  <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                    Reason:{" "}
                  </span>
                  <span className="whitespace-pre-wrap">{order.returnReason}</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      <th className="px-4 py-2 font-semibold">Model</th>
                      <th className="px-4 py-2 font-semibold">Description</th>
                      <th className="px-4 py-2 font-semibold text-right">Qty</th>
                      <th className="px-4 py-2 font-semibold">Unit</th>
                      <th className="px-4 py-2 font-semibold">Client</th>
                      <th className="px-4 py-2 font-semibold">Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items
                      .filter((item) => !item.isCustom)
                      .map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-4 py-2 font-medium whitespace-nowrap">
                            {resolveOrderItemModel(item) || "—"}
                          </td>
                          <td className="px-4 py-2">{item.description || "—"}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700">
                            {item.qty}
                          </td>
                          <td className="px-4 py-2">{item.unit || "pcs"}</td>
                          <td className="px-4 py-2 capitalize">{order.clientName}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{order.orderNumber}</td>
                        </tr>
                      ))}
                    {order.items.every((item) => item.isCustom) && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-3 text-[hsl(var(--muted-foreground))]"
                        >
                          No inventory lines on this return (custom items only)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
