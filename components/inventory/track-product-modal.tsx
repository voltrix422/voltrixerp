"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getInventoryHistory } from "@/lib/inventory-history"
import { getOrders } from "@/lib/orders"
import { getManualInventoryItems, type ManualInventoryItem } from "@/lib/manual-inventory"
import {
  enrichMovements,
  attachMainWarehouseBalances,
  applyMovementCatalog,
  buildMovementProductCatalog,
  formatMovementDate,
  getTrackEventKind,
  getTrackPlaceLabel,
  mainWarehouseDelta,
  movementItemKey,
  type InventoryMovementRow,
} from "@/lib/inventory-movement-display"
import { Button } from "@/components/ui/button"
import { Loader2, Package, Search, X } from "lucide-react"

export type TrackProductOption = {
  modelKey: string
  displayName: string
  startingQty: number
  inStock: number
  unit: string
}

type TrackProductModalProps = {
  open: boolean
  onClose: () => void
  products: TrackProductOption[]
  initialModelKey?: string
}

export function TrackProductModal({
  open,
  onClose,
  products,
  initialModelKey = "",
}: TrackProductModalProps) {
  const [selectedModel, setSelectedModel] = useState(initialModelKey)
  const [productQuery, setProductQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<InventoryMovementRow[]>([])
  const [manualItems, setManualItems] = useState<ManualInventoryItem[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setSelectedModel(initialModelKey || "")
    setProductQuery("")
    setRows([])
    setError("")
  }, [open, initialModelKey])

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.modelKey.toLowerCase().includes(q),
    )
  }, [products, productQuery])

  const selected = useMemo(
    () => products.find((p) => p.modelKey === selectedModel) || null,
    [products, selectedModel],
  )

  const loadTrail = useCallback(async (modelKey: string) => {
    if (!modelKey) {
      setRows([])
      return
    }
    setLoading(true)
    setError("")
    try {
      const [history, orders, manuals] = await Promise.all([
        getInventoryHistory({ limit: 5000 }),
        getOrders().catch(() => []),
        getManualInventoryItems().catch(() => []),
      ])
      setManualItems(manuals)

      const orderClientMap = new Map<string, string>()
      for (const order of orders) {
        if (order.id && order.clientName) orderClientMap.set(order.id, order.clientName)
      }

      const catalog = buildMovementProductCatalog(
        manuals.map((m) => ({
          name: m.name,
          model: m.model,
          availableQty: m.availableQty,
        })),
      )

      const enriched = applyMovementCatalog(
        attachMainWarehouseBalances(enrichMovements(history, orderClientMap), catalog),
        catalog,
      )

      const targetKey = movementItemKey(modelKey, catalog)
      const nameKey = movementItemKey(
        products.find((p) => p.modelKey === modelKey)?.displayName || modelKey,
        catalog,
      )

      const matched = enriched
        .filter((m) => {
          const key = movementItemKey(m.item_model_code || m.item_description, catalog)
          return key === targetKey || key === nameKey
        })
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      setRows(matched)
    } catch (e) {
      console.error(e)
      setError("Could not load product trail.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [products])

  useEffect(() => {
    if (!open || !selectedModel) return
    void loadTrail(selectedModel)
  }, [open, selectedModel, loadTrail])

  const summary = useMemo(() => {
    if (!selected) return null
    const manual = manualItems.find(
      (m) => m.model === selected.modelKey || m.name === selected.displayName,
    )
    const starting = manual?.qty ?? selected.startingQty
    const mainNow = manual?.availableQty ?? selected.inStock
    const faulty = manual?.faultyQty ?? 0

    let inQty = 0
    let outQty = 0
    let orders = 0
    let transfers = 0
    let pos = 0
    let returns = 0
    let damage = 0

    for (const m of rows) {
      const delta = mainWarehouseDelta(m)
      if (delta > 0) inQty += delta
      if (delta < 0) outQty += Math.abs(delta)
      const kind = getTrackEventKind(m)
      if (kind === "Client order") orders += m.abs_quantity
      if (kind === "Transfer") transfers += m.abs_quantity
      if (kind === "POS sale") pos += m.abs_quantity
      if (kind === "Return" || kind === "Order return" || kind === "Branch POS Return" || kind === "POS return") {
        returns += m.abs_quantity
      }
      if (kind.startsWith("Damaged") || kind.includes("damage") || kind.includes("Faulty")) {
        damage += m.abs_quantity
      }
    }

    return { starting, mainNow, faulty, inQty, outQty, orders, transfers, pos, returns, damage, unit: selected.unit }
  }, [selected, manualItems, rows])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-[min(98vw,1280px)] h-[min(96vh,900px)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Track product</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
              Starting stock → orders, transfers, POS, returns, damage
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 py-3 border-b border-[hsl(var(--border))] space-y-2 shrink-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative sm:w-56 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Filter products…"
                className="w-full h-8 border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="flex-1 h-8 border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer"
            >
              <option value="">Select a product…</option>
              {filteredProducts.map((p) => (
                <option key={p.modelKey} value={p.modelKey}>
                  {p.displayName} ({p.modelKey}) · {p.inStock}/{p.startingQty} {p.unit}
                </option>
              ))}
            </select>
          </div>

          {selected && summary && (
            <div className="flex flex-wrap gap-2">
              {[
                ["Starting", summary.starting],
                ["Main WH now", summary.mainNow],
                ["Faulty", summary.faulty],
                ["Trail in", summary.inQty],
                ["Trail out", summary.outQty],
                ["Orders", summary.orders],
                ["Transfers", summary.transfers],
                ["POS", summary.pos],
                ["Returns", summary.returns],
                ["Damage", summary.damage],
              ].map(([label, value]) => (
                <span
                  key={String(label)}
                  className="border border-[hsl(var(--border))] px-2 py-1 text-[11px] tabular-nums"
                >
                  {label}{" "}
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {Number(value).toLocaleString()}
                  </span>
                  <span className="text-[hsl(var(--muted-foreground))]"> {summary.unit}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {!selectedModel ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))]">
              <Package className="h-8 w-8 opacity-30 mb-2" />
              <p className="text-sm">Select a product to see its full trail</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading trail…
            </div>
          ) : error ? (
            <p className="text-xs text-center py-16 text-red-600">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-center py-16 text-[hsl(var(--muted-foreground))]">
              No movements found for this product.
            </p>
          ) : (
            <div className="border border-[hsl(var(--border))] overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    <th className="px-2.5 py-2 font-medium whitespace-nowrap">Date</th>
                    <th className="px-2.5 py-2 font-medium">Event</th>
                    <th className="px-2.5 py-2 font-medium text-right">Qty</th>
                    <th className="px-2.5 py-2 font-medium text-right whitespace-nowrap">Main WH</th>
                    <th className="px-2.5 py-2 font-medium">Place / route</th>
                    <th className="px-2.5 py-2 font-medium">Reference</th>
                    <th className="px-2.5 py-2 font-medium">By</th>
                    <th className="px-2.5 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {summary && (
                    <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/15">
                      <td className="px-2.5 py-1.5 text-[hsl(var(--muted-foreground))]">—</td>
                      <td className="px-2.5 py-1.5 font-medium">Opening / starting stock</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums font-medium">
                        {summary.starting.toLocaleString()} {summary.unit}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                        —
                      </td>
                      <td className="px-2.5 py-1.5 text-[hsl(var(--muted-foreground))]">
                        Recorded total units
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-[10px]">{selected?.modelKey}</td>
                      <td className="px-2.5 py-1.5">—</td>
                      <td className="px-2.5 py-1.5 text-[hsl(var(--muted-foreground))]">
                        Starting qty for this model
                      </td>
                    </tr>
                  )}
                  {rows.map((m) => {
                    const kind = getTrackEventKind(m)
                    const place = getTrackPlaceLabel(m)
                    const delta = mainWarehouseDelta(m)
                    const isReturn = kind === "Return" || kind === "Order return"
                    const isDamage = kind.startsWith("Damaged") || kind.includes("damage")
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-[hsl(var(--border))] last:border-b-0 align-top"
                      >
                        <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums text-[hsl(var(--muted-foreground))]">
                          {formatMovementDate(m.created_at)}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <span className="font-medium">{kind}</span>
                          {isReturn && (
                            <span className="block text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                              Returned stock
                            </span>
                          )}
                          {isDamage && (
                            <span className="block text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                              Moved to faulty / damaged
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums font-medium whitespace-nowrap">
                          {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                          {Math.abs(delta || m.abs_quantity).toLocaleString()} {m.unit}
                        </td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                          {m.balance_before != null && m.balance_after != null ? (
                            <>
                              <span className="text-[hsl(var(--muted-foreground))]">{m.balance_before}</span>
                              <span className="mx-1 text-[hsl(var(--muted-foreground))]">→</span>
                              <span className="font-medium">{m.balance_after}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 max-w-[220px]">
                          <span className="break-words">{place}</span>
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">
                          {m.order_number || m.reference_number || "—"}
                          {m.client_name && (
                            <span className="block text-[10px] text-[hsl(var(--muted-foreground))] truncate max-w-[140px]">
                              {m.client_name}
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                          {m.created_by || "—"}
                        </td>
                        <td className="px-2.5 py-1.5 max-w-[240px] text-[hsl(var(--muted-foreground))]">
                          <span className="line-clamp-2 break-words">{m.notes || "—"}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[hsl(var(--border))] flex justify-end shrink-0">
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
