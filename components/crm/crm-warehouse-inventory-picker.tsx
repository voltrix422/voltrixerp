"use client"

import { Button } from "@/components/ui/button"
import type { CrmWarehouseProduct } from "@/lib/warehouse-inventory-picker"
import { Package, X } from "lucide-react"

export function CrmWarehouseInventoryPicker({
  open,
  products,
  search,
  onSearchChange,
  onClose,
  onSelect,
}: {
  open: boolean
  products: CrmWarehouseProduct[]
  search: string
  onSearchChange: (value: string) => void
  onClose: () => void
  onSelect: (product: CrmWarehouseProduct) => void
}) {
  if (!open) return null

  const q = search.trim().toLowerCase()
  const filtered = products.filter(
    (p) =>
      p.displayName.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q),
  )

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[min(92dvh,100%)] sm:max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <p className="text-sm font-semibold">Warehouse inventory</p>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 border-b shrink-0">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search model or name…"
            className="w-full h-10 rounded-lg border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
          />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain divide-y">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Package className="h-10 w-10 text-[hsl(var(--muted-foreground))] opacity-30 mb-2" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {products.length === 0
                  ? "No units in stock. Scan QR in Inventory first."
                  : "No models match your search."}
              </p>
            </div>
          ) : (
            filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#1faca6]/[0.06] active:bg-[#1faca6]/10 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold break-words">{product.displayName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono mt-0.5 break-all">
                    {product.model}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#1faca6]/15 text-[#1faca6] px-2.5 py-1 text-[11px] font-semibold tabular-nums">
                  {product.qty} {product.qty === 1 ? "pc" : "pcs"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
