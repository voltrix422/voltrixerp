"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getInventoryHistory } from "@/lib/inventory-history"
import { getOrders } from "@/lib/orders"
import { getManualInventoryItems, type ManualInventoryItem } from "@/lib/manual-inventory"
import { getFaultyInventory, type FaultyInventoryGroup } from "@/lib/faulty-inventory"
import { searchProductAcrossBranches, type BranchProductLocation } from "@/lib/branches"
import { normalizeProductText } from "@/lib/order-product-search"
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

type OrderAgg = { orderNumber: string; client: string; qty: number; count: number }
type PosAgg = { ref: string; qty: number; count: number }
type TransferAgg = { route: string; qty: number; count: number }

function productMatches(
  text: string,
  modelKey: string,
  displayName: string,
  catalogKey: string,
  catalog: ReturnType<typeof buildMovementProductCatalog>,
) {
  const key = movementItemKey(text, catalog)
  if (key === catalogKey) return true
  const n = normalizeProductText(text)
  const model = normalizeProductText(modelKey)
  const name = normalizeProductText(displayName)
  if (!n) return false
  if (model && (n === model || n.includes(model) || model.includes(n))) return true
  if (name && (n === name || n.includes(name) || name.includes(n))) return true
  return false
}

function Stat({ label, value, hint, unit }: { label: string; value: number | string; hint?: string; unit?: string }) {
  return (
    <div className="border border-[hsl(var(--border))] px-2.5 py-1.5 min-w-[110px]">
      <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-sm font-semibold tabular-nums mt-0.5">
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit ? <span className="text-[10px] font-normal text-[hsl(var(--muted-foreground))] ml-1">{unit}</span> : null}
      </p>
      {hint ? <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{hint}</p> : null}
    </div>
  )
}

function MiniTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string
  headers: string[]
  rows: Array<Array<string | number>>
  empty: string
}) {
  return (
    <div className="border border-[hsl(var(--border))]">
      <div className="px-2.5 py-1.5 border-b border-[hsl(var(--border))] text-[11px] font-medium">{title}</div>
      {rows.length === 0 ? (
        <p className="px-2.5 py-3 text-[11px] text-[hsl(var(--muted-foreground))]">{empty}</p>
      ) : (
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {headers.map((h) => (
                <th key={h} className="px-2 py-1.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[hsl(var(--border))] last:border-b-0">
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-2 py-1.5 ${j === r.length - 1 ? "text-right tabular-nums font-medium" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
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
  const [faultyGroup, setFaultyGroup] = useState<FaultyInventoryGroup | null>(null)
  const [branchHoldings, setBranchHoldings] = useState<BranchProductLocation[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setSelectedModel(initialModelKey || "")
    setProductQuery("")
    setRows([])
    setFaultyGroup(null)
    setBranchHoldings([])
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
      setFaultyGroup(null)
      setBranchHoldings([])
      return
    }
    setLoading(true)
    setError("")
    try {
      const product = products.find((p) => p.modelKey === modelKey)
      const displayName = product?.displayName || modelKey

      const [history, orders, manuals, faultyData, branches] = await Promise.all([
        getInventoryHistory({ limit: 5000 }),
        getOrders().catch(() => []),
        getManualInventoryItems().catch(() => []),
        getFaultyInventory().catch(() => ({ groups: [], totalFaultyQty: 0 })),
        searchProductAcrossBranches([modelKey, displayName]).catch(() => []),
      ])
      setManualItems(manuals)
      setBranchHoldings(branches.filter((b) => (Number(b.quantity) || 0) > 0))

      const fg =
        faultyData.groups.find(
          (g) =>
            g.modelKey === modelKey ||
            normalizeProductText(g.displayName) === normalizeProductText(displayName) ||
            normalizeProductText(g.modelKey) === normalizeProductText(modelKey),
        ) || null
      setFaultyGroup(fg)

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
      const catalogKey = movementItemKey(modelKey, catalog)

      const enriched = applyMovementCatalog(
        attachMainWarehouseBalances(enrichMovements(history, orderClientMap), catalog),
        catalog,
      )

      const matched = enriched
        .filter((m) =>
          productMatches(
            m.item_model_code || m.item_description,
            modelKey,
            displayName,
            catalogKey,
            catalog,
          ) ||
          productMatches(m.item_description, modelKey, displayName, catalogKey, catalog) ||
          productMatches(m.reference_number || "", modelKey, displayName, catalogKey, catalog),
        )
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
    const faultyNow = Math.max(
      Number(manual?.faultyQty) || 0,
      Number(faultyGroup?.faultyQty) || 0,
    )
    const atBranches = branchHoldings.reduce((s, b) => s + (Number(b.quantity) || 0), 0)

    let erpOrders = 0
    let transfers = 0
    let pos = 0
    let returns = 0
    let damageMoves = 0
    let addedToWh = 0
    let leftWh = 0

    const orderMap = new Map<string, OrderAgg>()
    const posMap = new Map<string, PosAgg>()
    const transferMap = new Map<string, TransferAgg>()

    for (const m of rows) {
      const delta = mainWarehouseDelta(m)
      if (delta > 0) addedToWh += delta
      if (delta < 0) leftWh += Math.abs(delta)

      const kind = getTrackEventKind(m)
      const qty = m.abs_quantity

      if (kind === "Client order") {
        erpOrders += qty
        const key = m.order_number || m.reference_number || m.reference_id || m.id
        const prev = orderMap.get(key) || {
          orderNumber: m.order_number || m.reference_number || "—",
          client: m.client_name || "—",
          qty: 0,
          count: 0,
        }
        prev.qty += qty
        prev.count += 1
        if (m.client_name) prev.client = m.client_name
        orderMap.set(key, prev)
      } else if (kind === "Transfer") {
        transfers += qty
        const route = getTrackPlaceLabel(m)
        const prev = transferMap.get(route) || { route, qty: 0, count: 0 }
        prev.qty += qty
        prev.count += 1
        transferMap.set(route, prev)
      } else if (kind === "POS sale") {
        pos += qty
        const ref = m.reference_number || m.location_label || "POS"
        const prev = posMap.get(ref) || { ref, qty: 0, count: 0 }
        prev.qty += qty
        prev.count += 1
        posMap.set(ref, prev)
      } else if (kind === "Return" || kind === "Order return") {
        returns += qty
      } else if (m.reference_type === "faulty_move" || kind.startsWith("Damaged")) {
        damageMoves += qty
      }
    }

    return {
      starting,
      mainNow,
      faultyNow,
      atBranches,
      erpOrders,
      transfers,
      pos,
      returns,
      damageMoves,
      addedToWh,
      leftWh,
      unit: selected.unit,
      orders: [...orderMap.values()].sort((a, b) => b.qty - a.qty),
      posRows: [...posMap.values()].sort((a, b) => b.qty - a.qty),
      transferRows: [...transferMap.values()].sort((a, b) => b.qty - a.qty),
    }
  }, [selected, manualItems, rows, faultyGroup, branchHoldings])

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
              Stock now, then ERP orders · branches · POS · returns · damage
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 py-3 border-b border-[hsl(var(--border))] space-y-3 shrink-0">
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
            <div className="space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">
                  Stock now
                </p>
                <div className="flex flex-wrap gap-2">
                  <Stat label="Starting units" value={summary.starting} unit={summary.unit} hint="Total recorded for this model" />
                  <Stat label="Main warehouse" value={summary.mainNow} unit={summary.unit} hint="Sellable at main WH" />
                  <Stat label="At branches" value={summary.atBranches} unit={summary.unit} hint="On hand across branches" />
                  <Stat label="Faulty / damaged" value={summary.faultyNow} unit={summary.unit} hint="Excluded from sellable stock" />
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">
                  Where it went (from history)
                </p>
                <div className="flex flex-wrap gap-2">
                  <Stat label="ERP orders" value={summary.erpOrders} unit={summary.unit} hint="Dispatched on client orders" />
                  <Stat label="Transfers" value={summary.transfers} unit={summary.unit} hint="Moved between branches" />
                  <Stat label="POS sales" value={summary.pos} unit={summary.unit} hint="Sold via POS" />
                  <Stat label="Returns" value={summary.returns} unit={summary.unit} hint="Returned into stock" />
                  <Stat
                    label="Main WH + / −"
                    value={`+${summary.addedToWh} / −${summary.leftWh}`}
                    hint="All adds and removes on main warehouse"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3 space-y-3">
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
          ) : (
            <>
              {summary && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <MiniTable
                    title="ERP client orders"
                    headers={["Order", "Client", "Qty"]}
                    empty="No ERP order dispatches for this product."
                    rows={summary.orders.map((o) => [o.orderNumber, o.client, `${o.qty} ${summary.unit}`])}
                  />
                  <MiniTable
                    title="POS sales"
                    headers={["Reference", "Lines", "Qty"]}
                    empty="No POS sales for this product."
                    rows={summary.posRows.map((p) => [p.ref, p.count, `${p.qty} ${summary.unit}`])}
                  />
                  <MiniTable
                    title="Branch transfers (history)"
                    headers={["Route", "Moves", "Qty"]}
                    empty="No branch transfers for this product."
                    rows={summary.transferRows.map((t) => [t.route, t.count, `${t.qty} ${summary.unit}`])}
                  />
                  <MiniTable
                    title="At branches now"
                    headers={["Branch", "Code", "On hand"]}
                    empty="No branch stock for this product."
                    rows={branchHoldings.map((b) => [
                      b.branchName,
                      b.branchCode,
                      `${b.quantity} ${b.unit || summary.unit}`,
                    ])}
                  />
                  <MiniTable
                    title="Faulty / damaged now"
                    headers={["Item", "Detail", "Qty"]}
                    empty="No faulty / damaged units for this product."
                    rows={
                      faultyGroup
                        ? [
                            ...(faultyGroup.serialUnits.length > 0
                              ? faultyGroup.serialUnits.map((u) => [
                                  faultyGroup.displayName,
                                  `SN ${u.serialNumber}${u.scannedAt ? ` · ${new Date(u.scannedAt).toLocaleDateString()}` : ""}`,
                                  `1 ${faultyGroup.unit}`,
                                ])
                              : []),
                            ...(faultyGroup.serialUnits.length === 0
                              ? [[faultyGroup.displayName, "Qty-based faulty stock", `${faultyGroup.faultyQty} ${faultyGroup.unit}`]]
                              : faultyGroup.faultyQty > faultyGroup.serialUnits.length
                                ? [[
                                    faultyGroup.displayName,
                                    "Additional qty (no SN)",
                                    `${faultyGroup.faultyQty - faultyGroup.serialUnits.length} ${faultyGroup.unit}`,
                                  ]]
                                : []),
                          ]
                        : summary.faultyNow > 0
                          ? [[selected.displayName, "On faulty stock", `${summary.faultyNow} ${summary.unit}`]]
                          : []
                    }
                  />
                </div>
              )}

              <div className="border border-[hsl(var(--border))] overflow-x-auto">
                <div className="px-2.5 py-1.5 border-b border-[hsl(var(--border))] text-[11px] font-medium">
                  Full movement history
                </div>
                {rows.length === 0 ? (
                  <p className="px-2.5 py-6 text-[11px] text-[hsl(var(--muted-foreground))] text-center">
                    No movement history rows for this product.
                  </p>
                ) : (
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
                          <td className="px-2.5 py-1.5 font-medium">Starting units</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums font-medium">
                            {summary.starting.toLocaleString()} {summary.unit}
                          </td>
                          <td className="px-2.5 py-1.5 text-right text-[hsl(var(--muted-foreground))]">—</td>
                          <td className="px-2.5 py-1.5 text-[hsl(var(--muted-foreground))]">Total recorded</td>
                          <td className="px-2.5 py-1.5 font-mono text-[10px]">{selected?.modelKey}</td>
                          <td className="px-2.5 py-1.5">—</td>
                          <td className="px-2.5 py-1.5 text-[hsl(var(--muted-foreground))]">Opening total</td>
                        </tr>
                      )}
                      {rows.map((m) => {
                        const kind = getTrackEventKind(m)
                        const place = getTrackPlaceLabel(m)
                        const delta = mainWarehouseDelta(m)
                        const isReturn = kind === "Return" || kind === "Order return"
                        const isDamage = m.reference_type === "faulty_move" || kind.startsWith("Damaged")
                        return (
                          <tr key={m.id} className="border-b border-[hsl(var(--border))] last:border-b-0 align-top">
                            <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums text-[hsl(var(--muted-foreground))]">
                              {formatMovementDate(m.created_at)}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <span className="font-medium">{kind}</span>
                              {isReturn && (
                                <span className="block text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                                  Returned into stock
                                </span>
                              )}
                              {isDamage && (
                                <span className="block text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                                  Faulty / damaged inventory
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
                )}
              </div>
            </>
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
