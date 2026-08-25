"use client"

import { useEffect, useMemo, useState } from "react"
import { Gift, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  loadInventoryProductOptions,
  type InventoryProductOption,
} from "@/lib/inventory-product-options"
import { saveOrder, type Order, type OrderItem } from "@/lib/orders"

type Props = {
  order: Order
  currentUser?: string
  onClose: () => void
  onSaved: (order: Order) => void
}

/**
 * Give inventory item(s) free of charge on an order.
 * Price stays 0 (order total unchanged), no QR scanning required —
 * the qty is deducted from inventory immediately.
 */
export function OrderFreeItem({ order, currentUser, onClose, onSaved }: Props) {
  const [options, setOptions] = useState<InventoryProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const loaded = await loadInventoryProductOptions()
        if (!cancelled) setOptions(loaded.filter((o) => o.inStock > 0))
      } catch {
        if (!cancelled) setError("Could not load inventory items.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.displayName.toLowerCase().includes(q) ||
        o.modelKey.toLowerCase().includes(q) ||
        o.matchTerms.some((t) => t.toLowerCase().includes(q)),
    )
  }, [options, search])

  const selected = options.find((o) => o.id === selectedId) ?? null
  const qtyValid = selected ? qty >= 1 && qty <= selected.inStock : false

  async function handleSave() {
    if (!selected || !qtyValid || saving) return
    setSaving(true)
    setError("")

    const freeItem: OrderItem = {
      id: `free-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: `${selected.displayName} (Free item${notes.trim() ? `: ${notes.trim()}` : ""})`,
      qty,
      unit: selected.unit || "pcs",
      unitPrice: 0,
      isCustom: false,
      model: selected.modelKey || undefined,
      isFreeItem: true,
    }

    try {
      // Deduct the qty from inventory right now, independent of the order's
      // own deduction (which skips free lines). Synthetic id keeps serial
      // tags separate from the parent order.
      const res = await fetch("/api/db/inventory-order-deduct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deduct",
          order: {
            id: `${order.id}-free-${freeItem.id}`,
            orderNumber: order.orderNumber,
            clientName: `${order.clientName} (free item)`,
            createdBy: currentUser || order.createdBy,
            status: "processing",
            items: [
              {
                id: freeItem.id,
                description: selected.displayName,
                qty,
                unit: freeItem.unit,
                isCustom: false,
                model: selected.modelKey || undefined,
              },
            ],
          },
        }),
      })
      const result = await res.json().catch(() => ({}))
      const deducted = Number(result?.deductedLines) || 0
      if (!res.ok || deducted === 0) {
        const reason: string =
          Array.isArray(result?.failedLines) && result.failedLines.length > 0
            ? result.failedLines.join("; ")
            : result?.error || "not enough stock"
        setError(`Could not deduct from inventory: ${reason}`)
        setSaving(false)
        return
      }

      const updated: Order = { ...order, items: [...order.items, freeItem] }
      const saved = await saveOrder(updated)
      onSaved(saved)
      onClose()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Could not add free item.")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-base font-bold">Add free item</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Given free of charge · deducted from inventory · no QR scan needed
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inventory…
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                  Search inventory
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or model…"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[#1faca6]"
                />
              </div>

              <div className="rounded-lg border overflow-hidden max-h-56 overflow-y-auto divide-y">
                {filtered.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6 px-4">
                    No in-stock items match.
                  </p>
                ) : (
                  filtered.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(option.id)
                        setQty(1)
                        setError("")
                      }}
                      className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs transition-colors cursor-pointer ${
                        selectedId === option.id
                          ? "bg-[#1faca6]/10 border-l-2 border-l-[#1faca6]"
                          : "hover:bg-[hsl(var(--muted))]/20"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{option.displayName}</p>
                        {option.modelKey && (
                          <p className="font-mono text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                            {option.modelKey}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] font-bold tabular-nums text-[hsl(var(--muted-foreground))]">
                        {option.inStock} in stock
                      </span>
                    </button>
                  ))
                )}
              </div>

              {selected && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                      Free qty *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={selected.inStock}
                      value={qty}
                      onChange={(e) => setQty(Math.floor(Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[#1faca6]"
                    />
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                      Max {selected.inStock} in stock
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                      Reason / notes
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. goodwill gift"
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[#1faca6]"
                    />
                  </div>
                </div>
              )}

              {selected && qtyValid && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {qty} × {selected.displayName} will be added free (PKR 0) and {qty} unit
                    {qty === 1 ? "" : "s"} deducted from inventory. No QR scanning required.
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            </>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            size="sm"
            variant="outline"
            className="h-10 w-full sm:w-auto text-xs"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-10 w-full sm:w-auto sm:ml-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSave}
            disabled={saving || !selected || !qtyValid}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <Gift className="h-3.5 w-3.5 mr-1.5" />
                Add free item
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
