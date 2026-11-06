"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
import { Search, ChevronDown, SlidersHorizontal, X } from "lucide-react"

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
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)
  const filterBtnRef = useRef<HTMLButtonElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) return
    setOpenIds((prev) => {
      const next = { ...prev }
      for (const o of orders) {
        const hit =
          o.orderNumber?.toLowerCase().includes(q) ||
          o.clientName?.toLowerCase().includes(q) ||
          o.returnReason?.toLowerCase().includes(q) ||
          o.items.some((item) => {
            const returnedQty = getItemReturnedQty(o, item.id)
            if (returnedQty <= 0) return false
            const model = resolveOrderItemModel(item)?.toLowerCase() || ""
            return model.includes(q) || (item.description || "").toLowerCase().includes(q)
          })
        if (hit) next[o.id] = true
      }
      return next
    })
  }, [search, orders])

  useEffect(() => {
    if (!showFilters) {
      setFilterPos(null)
      return
    }
    function place() {
      const btn = filterBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelW = Math.min(300, window.innerWidth - 24)
      const left = Math.min(Math.max(12, r.right - panelW), window.innerWidth - panelW - 12)
      const top = Math.min(r.bottom + 8, window.innerHeight - 24)
      setFilterPos({ top, left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [showFilters])

  useEffect(() => {
    if (!showFilters) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (filtersRef.current?.contains(t) || filterBtnRef.current?.contains(t)) return
      setShowFilters(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [showFilters])

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
        <p className="text-[13px] text-[#86868b]">Loading order returns…</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#86868b]">
          <span>Orders <span className="tabular-nums font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{filtered.length}</span></span>
          <span>Qty returned <span className="tabular-nums font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{totalQty}</span></span>
          <span>Refunded <span className="tabular-nums font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{formatPkr(totalRefunded)}</span></span>
        </div>
        <button
          ref={filterBtnRef}
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`relative h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
            showFilters
              ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
              : "text-[#86868b] hover:bg-black/[0.05] hover:text-[#1d1d1f]"
          }`}
          aria-label="Filters"
          aria-expanded={showFilters}
          title="Filters"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          {search.trim() && !showFilters && (
            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#007aff]" />
          )}
        </button>
      </div>

      {showFilters &&
        filterPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={filtersRef}
            className="fixed z-[95] w-[min(18rem,calc(100vw-1.5rem))] rounded-[18px] border border-black/[0.06] bg-white/92 dark:bg-[hsl(var(--card))]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-3 space-y-2.5"
            style={{ top: filterPos.top, left: filterPos.left }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold tracking-tight">Filters</p>
              <div className="flex items-center gap-2">
                {search.trim() ? (
                  <button type="button" onClick={() => setSearch("")} className="text-[11px] font-semibold text-[#0071e3] cursor-pointer">
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order, client, model…"
                className="w-full h-8 pl-8 pr-2.5 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
              />
            </div>
          </div>,
          document.body,
        )}

      {filtered.length === 0 ? (
        <p className="text-[13px] text-[#86868b] py-10 text-center rounded-[16px] border border-black/[0.06] bg-white dark:bg-[hsl(var(--card))]">
          {orders.length === 0 ? "No order returns yet." : "No returns match your search."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filtered.map((order) => {
            const lines = order.items.filter((item) => !item.isCustom && getItemReturnedQty(order, item.id) > 0)
            const open = openIds[order.id] === true
            const refunded = getOrderReturnAmount(order)
            return (
              <div
                key={order.id}
                className="rounded-[16px] border border-black/[0.04] bg-white/90 dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--card))] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full text-left p-3.5 cursor-pointer hover:bg-black/[0.02] transition-colors"
                  onClick={() => setOpenIds((prev) => ({ ...prev, [order.id]: !prev[order.id] }))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold tracking-tight text-[#0071e3]">
                        {order.orderNumber}
                      </p>
                      <p className="mt-0.5 text-[12px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
                        {order.clientName || "—"}
                      </p>
                      <p className="mt-1 text-[11px] text-[#86868b]">
                        {STATUS_LABELS[order.status] || order.status}
                        {order.status === "delivered" ? " · Partial return" : ""}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#86868b] transition-transform ${open ? "" : "-rotate-90"}`}
                    />
                  </div>
                  <p className="mt-3 text-[12px] font-semibold tabular-nums tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    Refunded {formatPkr(refunded)}
                  </p>
                </button>
                {open && (
                  <div className="border-t border-black/[0.04] dark:border-[hsl(var(--border))] px-3.5 py-2.5 space-y-2 bg-[#fafafa]/80 dark:bg-white/[0.02]">
                    <p className="text-[11px] text-[#86868b]">
                      {order.returnedAt
                        ? `Returned ${new Date(order.returnedAt).toLocaleDateString()}`
                        : "Returned"}
                      {order.returnedBy ? ` · ${order.returnedBy}` : ""}
                      {order.inventoryReturnedAt ? " · Full stock restored" : " · Partial stock restored"}
                      {order.returnReason ? ` · ${order.returnReason}` : ""}
                    </p>
                    {lines.length === 0 ? (
                      <p className="text-[11px] text-[#86868b]">No inventory lines (custom items only)</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {lines.map((item) => (
                          <li key={item.id} className="flex items-start justify-between gap-2 text-[11px]">
                            <div className="min-w-0">
                              <p className="font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
                                {item.description || resolveOrderItemModel(item) || "—"}
                              </p>
                              <p className="font-mono text-[#86868b] truncate">
                                {resolveOrderItemModel(item) || "—"}
                              </p>
                            </div>
                            <span className="shrink-0 tabular-nums text-[#86868b]">
                              {getItemReturnedQty(order, item.id)}/{item.qty} {item.unit || "pcs"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
