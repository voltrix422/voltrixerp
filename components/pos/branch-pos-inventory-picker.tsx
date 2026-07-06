"use client"

import { Button } from "@/components/ui/button"
import type { PosStockProduct } from "@/lib/pos"
import {
  CRM_PRICE_TIER_LABELS,
  lookupCrmUnitPrice,
  type CrmPriceTier,
  type CrmProductPrice,
} from "@/lib/crm-product-prices"
import { Package, X } from "lucide-react"

export function BranchPosInventoryPicker({
  open,
  products,
  priceMap,
  priceTier,
  search,
  onSearchChange,
  onClose,
  onSelect,
  branchName,
}: {
  open: boolean
  products: PosStockProduct[]
  priceMap: Map<string, CrmProductPrice>
  priceTier: CrmPriceTier
  search: string
  onSearchChange: (value: string) => void
  onClose: () => void
  onSelect: (product: PosStockProduct) => void
  branchName: string
}) {
  if (!open) return null

  const q = search.trim().toLowerCase()
  const filtered = products.filter(
    (p) =>
      p.description.toLowerCase().includes(q) ||
      (p.model || "").toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q),
  )

  function formatPkr(n: number) {
    return `PKR ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[min(95dvh,100%)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <p className="text-sm font-semibold">Branch stock — {branchName}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Prices: {CRM_PRICE_TIER_LABELS[priceTier]}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 border-b shrink-0">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search model or product…"
            className="w-full h-10 rounded-lg border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
          />
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Package className="h-10 w-10 text-[hsl(var(--muted-foreground))] opacity-30 mb-2" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No stock at this branch</p>
            </div>
          ) : (
            filtered.map((product) => {
              const unitPrice = lookupCrmUnitPrice(priceMap, product.model, priceTier)
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#1faca6]/[0.06] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold break-words">{product.description}</p>
                      {product.isManual && (
                        <span className="shrink-0 rounded bg-amber-500/15 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                          Manual
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono mt-0.5 break-all">
                      {product.model}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#1faca6] tabular-nums">{formatPkr(unitPrice)}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] tabular-nums">
                      {product.availableQty} {product.unit}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
