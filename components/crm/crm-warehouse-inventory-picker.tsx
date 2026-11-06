"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import type { CrmWarehouseProduct } from "@/lib/warehouse-inventory-picker"
import { Search, X } from "lucide-react"

export function CrmWarehouseInventoryPicker({
  open,
  products,
  search,
  onSearchChange,
  onClose,
  onSelect,
  /** Overlay z-index — raise when opened above another modal (e.g. invoice edit). */
  zClass = "z-[100]",
}: {
  open: boolean
  products: CrmWarehouseProduct[]
  search: string
  onSearchChange: (value: string) => void
  onClose: () => void
  onSelect: (product: CrmWarehouseProduct) => void
  zClass?: string
}) {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<"scanned" | "manual">("manual")
  useEffect(() => setMounted(true), [])

  if (!open || !mounted) return null

  const q = search.trim().toLowerCase()
  const filtered = products.filter(
    (p) =>
      p.displayName.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q),
  )
  const scannedProducts = filtered.filter((p) => p.source !== "manual")
  const manualProducts = filtered.filter((p) => p.source === "manual")
  const activeList = tab === "scanned" ? scannedProducts : manualProducts

  function renderProductList(list: CrmWarehouseProduct[], emptyText: string) {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center col-span-full">
          <p className="text-[13px] text-[#86868b]">{emptyText}</p>
        </div>
      )
    }

    return list.map((product) => (
      <button
        key={product.id}
        type="button"
        onClick={() => onSelect(product)}
        className="flex items-start justify-between gap-3 rounded-[14px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] px-3.5 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] active:scale-[0.99] transition-colors cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] leading-snug">
            {product.displayName}
          </p>
          <p className="text-[11px] text-[#aeaeb2] mt-1 truncate">{product.model}</p>
        </div>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#007aff] pt-0.5">
          {product.qty}
        </span>
      </button>
    ))
  }

  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[10px] p-0 sm:p-4`}
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[min(1120px,calc(100vw-1.5rem))] rounded-t-[22px] sm:rounded-[22px] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col max-h-[min(94dvh,100%)] sm:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-2 shrink-0">
          <p className="text-[20px] font-semibold tracking-[-0.03em] text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            Inventory
          </p>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="px-5 sm:px-6 pb-3 shrink-0 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#aeaeb2]" strokeWidth={2} />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search"
              className="w-full h-10 rounded-[12px] border border-black/[0.06] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35"
              autoFocus
            />
          </div>
          <div className="inline-flex items-center rounded-full bg-black/[0.06] dark:bg-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setTab("manual")}
              className={`h-7 px-3.5 rounded-full text-[11px] font-semibold cursor-pointer ${
                tab === "manual"
                  ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-[#1d1d1f] dark:text-white"
                  : "text-[#86868b]"
              }`}
            >
              Manual · {manualProducts.length}
            </button>
            <button
              type="button"
              onClick={() => setTab("scanned")}
              className={`h-7 px-3.5 rounded-full text-[11px] font-semibold cursor-pointer ${
                tab === "scanned"
                  ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-[#1d1d1f] dark:text-white"
                  : "text-[#86868b]"
              }`}
            >
              Scanned · {scannedProducts.length}
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {filtered.length === 0
              ? renderProductList([], products.length === 0 ? "No stock available" : "No matches")
              : renderProductList(
                  activeList,
                  tab === "scanned" ? "No scanned items" : "No manual items",
                )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
