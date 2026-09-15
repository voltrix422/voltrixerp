"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getInventoryHistory } from "@/lib/inventory-history"
import { getOrders, type Order } from "@/lib/orders"
import { isBranchPosOrderHiddenFromErp } from "@/lib/branch-pos"
import { getManualInventoryItems, type ManualInventoryItem } from "@/lib/manual-inventory"
import { getFaultyInventory, type FaultyInventoryGroup } from "@/lib/faulty-inventory"
import { searchProductAcrossBranches, type BranchProductLocation } from "@/lib/branches"
import {
  areDistinctManSkus,
  computeNetDeliveredProductQty,
  computeProductReturnReplaceSummary,
  matchingProductQty,
  normalizeProductText,
  orderMatchesProductFilter,
  type ProductFilter,
} from "@/lib/order-product-search"
import {
  enrichMovements,
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
type PosAgg = { ref: string; branch: string; qty: number; count: number }
type TransferAgg = { route: string; qty: number; count: number }

function getPosBranchLabel(m: InventoryMovementRow): string {
  const loc = String(m.location_label || "").trim()
  if (loc && !/^pos$/i.test(loc)) return loc
  const notes = m.notes || ""
  const fromNotes =
    notes.match(/Branch POS delivered[^·]*·\s*([^·]+)/i)?.[1]?.trim() ||
    notes.match(/Branch POS\s*[·:]\s*([^·\n]+)/i)?.[1]?.trim()
  if (fromNotes) return fromNotes.replace(/\s+POS$/i, "").trim()
  const src = String(m.source || "").trim()
  if (src && !/main warehouse/i.test(src) && !/^pos$/i.test(src)) return src
  return "Branch POS"
}

function isMainWarehouseHolding(b: BranchProductLocation) {
  const t = normalizeProductText(b.branchType || "")
  const n = normalizeProductText(b.branchName || "")
  const c = normalizeProductText(b.branchCode || "")
  return t.includes("main_warehouse") || t.includes("main warehouse") || n.includes("main warehouse") || c === "br001"
}

function buildTrackProductFilter(modelKey: string, displayName: string): ProductFilter {
  return {
    modelKey,
    matchTerms: [modelKey, displayName].filter(Boolean),
    query: displayName || modelKey,
  }
}

function productMatches(
  text: string,
  modelKey: string,
  displayName: string,
  catalogKey: string,
  catalog: ReturnType<typeof buildMovementProductCatalog>,
) {
  if (!text?.trim()) return false
  // MAN-…-B must not pick up MAN-…-B-1 (substring of the model code).
  if (areDistinctManSkus(text, modelKey)) return false
  const key = movementItemKey(text, catalog)
  if (key === catalogKey) return true
  const n = normalizeProductText(text)
  const model = normalizeProductText(modelKey)
  const name = normalizeProductText(displayName)
  if (!n) return false
  if (model && n === model) return true
  if (model && (n.includes(model) || model.includes(n)) && !areDistinctManSkus(n, model)) return true
  if (name && (n === name || n.includes(name) || name.includes(n))) return true
  return false
}

/** Rebuild trail: drop duplicate order outs, use one row per ERP order line qty, start Main WH at starting units. */
function rebuildProductTrailForBalance(params: {
  movements: InventoryMovementRow[]
  orderRows: Order[]
  filter: ProductFilter
  startingUnits: number
  currentMainQty: number
  displayName: string
  modelKey: string
  unit: string
}): { rows: InventoryMovementRow[]; opening: number; ending: number; historyGap: number } {
  const { movements, orderRows, filter, startingUnits, currentMainQty, displayName, modelKey, unit } = params

  const erpDelivered = orderRows.filter(
    (o) =>
      !isBranchPosOrderHiddenFromErp(o) &&
      o.status === "delivered" &&
      orderMatchesProductFilter(o, filter) &&
      matchingProductQty(o, filter) > 0,
  )

  // Keep transfers / POS / manual / faulty / returns / replacements — drop raw outbound ERP order spam
  const kept = movements.filter((m) => {
    if (m.reference_type === "order" && !m.is_inbound) {
      const on = m.order_number || m.reference_number
      const order = orderRows.find((o) => o.orderNumber === on)
      // Branch POS may be logged as order — keep those; ERP outs are replaced by synthetics
      if (order && isBranchPosOrderHiddenFromErp(order)) return true
      return false
    }
    return true
  })

  const synthetics: InventoryMovementRow[] = erpDelivered.map((o) => {
    const qty = matchingProductQty(o, filter)
    const firstHist = movements.find(
      (m) =>
        m.reference_type === "order" &&
        !m.is_inbound &&
        (m.order_number === o.orderNumber || m.reference_number === o.orderNumber),
    )
    const at =
      firstHist?.created_at ||
      o.deliveryDate ||
      o.createdAt ||
      new Date().toISOString()
    return {
      id: `synthetic-order-${o.id || o.orderNumber}`,
      item_description: displayName,
      item_model_code: modelKey,
      transaction_type: "out",
      quantity: qty,
      unit,
      reference_type: "order",
      reference_id: o.id,
      reference_number: o.orderNumber,
      notes: `Order line qty · ${o.clientName || ""}`.trim(),
      created_at: String(at),
      created_by: firstHist?.created_by || "System",
      movement_label: "OUT",
      source: "Main Warehouse",
      destination: o.clientName ? `Client: ${o.clientName}` : "Client",
      client_name: o.clientName || "",
      order_number: o.orderNumber,
      is_inbound: false,
      abs_quantity: qty,
    }
  })

  const merged = [...kept, ...synthetics].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const opening = startingUnits
  let running = opening
  const rows = merged.map((m) => {
    const before = running
    const after = before + mainWarehouseDelta(m)
    running = after
    return { ...m, balance_before: before, balance_after: after }
  })

  // Align trail close to live Main WH; leftover is unreconciled history (label noise / missing moves).
  const historyGap = currentMainQty - running
  if (historyGap !== 0) {
    const before = running
    const after = currentMainQty
    rows.push({
      id: `synthetic-main-wh-gap-${modelKey}`,
      item_description: displayName,
      item_model_code: modelKey,
      transaction_type: historyGap > 0 ? "in" : "out",
      quantity: Math.abs(historyGap),
      unit,
      reference_type: "manual_reconcile",
      reference_id: "",
      reference_number: "BOOK-GAP",
      notes: `Unreconciled history gap · trail was ${before}, live Main WH is ${currentMainQty}`,
      created_at: new Date().toISOString(),
      created_by: "System",
      movement_label: historyGap > 0 ? "IN" : "OUT",
      source: historyGap > 0 ? "History gap" : "Main Warehouse",
      destination: historyGap > 0 ? "Main Warehouse" : "History gap",
      client_name: "",
      order_number: "",
      is_inbound: historyGap > 0,
      abs_quantity: Math.abs(historyGap),
      balance_before: before,
      balance_after: after,
    })
    running = after
  }

  return { rows, opening, ending: running, historyGap }
}

function Stat({ label, value, hint, unit }: { label: string; value: number | string; hint?: string; unit?: string }) {
  return (
    <div className="border border-[hsl(var(--border))] px-2 py-1 min-w-[88px]">
      <p className="text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] leading-tight">{label}</p>
      <p className="text-xs font-semibold tabular-nums mt-0.5 leading-tight">
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit ? <span className="text-[9px] font-normal text-[hsl(var(--muted-foreground))] ml-0.5">{unit}</span> : null}
      </p>
      {hint ? <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5 leading-tight line-clamp-1">{hint}</p> : null}
    </div>
  )
}

function MiniTable({
  title,
  totalLabel,
  headers,
  rows,
  empty,
  compact,
}: {
  title: string
  totalLabel?: string
  headers: string[]
  rows: Array<Array<string | number>>
  empty: string
  compact?: boolean
}) {
  return (
    <div className="border border-[hsl(var(--border))] flex flex-col min-h-0 overflow-hidden">
      <div className="px-2 py-1 border-b border-[hsl(var(--border))] flex items-center justify-between gap-2 shrink-0">
        <span className="text-[10px] font-medium truncate">{title}</span>
        {totalLabel ? (
          <span className="text-[10px] tabular-nums font-semibold shrink-0">{totalLabel}</span>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-2 py-2 text-[10px] text-[hsl(var(--muted-foreground))]">{empty}</p>
      ) : (
        <div className={compact ? "overflow-auto max-h-[22vh]" : "overflow-auto min-h-0 flex-1"}>
          <table className="w-full text-[10px] border-collapse">
            <thead className="sticky top-0 bg-[hsl(var(--card))]">
              <tr className="border-b border-[hsl(var(--border))] text-left text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {headers.map((h) => (
                  <th key={h} className="px-1.5 py-1 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[hsl(var(--border))] last:border-b-0">
                  {r.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-1.5 py-0.5 ${j === r.length - 1 ? "text-right tabular-nums font-medium whitespace-nowrap" : "truncate max-w-[140px]"}`}
                      title={String(cell)}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const [orders, setOrders] = useState<Order[]>([])
  const [manualItems, setManualItems] = useState<ManualInventoryItem[]>([])
  const [faultyGroup, setFaultyGroup] = useState<FaultyInventoryGroup | null>(null)
  const [branchHoldings, setBranchHoldings] = useState<BranchProductLocation[]>([])
  const [error, setError] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [mainWhOpening, setMainWhOpening] = useState<number | null>(null)
  const [mainWhTrailEnd, setMainWhTrailEnd] = useState<number | null>(null)
  const [historyGap, setHistoryGap] = useState(0)

  useEffect(() => {
    if (!open) return
    setSelectedModel(initialModelKey || "")
    setProductQuery("")
    setRows([])
    setOrders([])
    setFaultyGroup(null)
    setBranchHoldings([])
    setError("")
    setShowHistory(false)
    setMainWhOpening(null)
    setMainWhTrailEnd(null)
    setHistoryGap(0)
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

      const [history, orderRows, manuals, faultyData, branches] = await Promise.all([
        getInventoryHistory({ limit: 5000 }),
        getOrders().catch(() => []),
        getManualInventoryItems().catch(() => []),
        getFaultyInventory().catch(() => ({ groups: [], totalFaultyQty: 0 })),
        searchProductAcrossBranches([modelKey, displayName]).catch(() => []),
      ])
      setManualItems(manuals)
      setOrders(orderRows)
      setBranchHoldings(
        branches.filter((b) => (Number(b.quantity) || 0) > 0 && !isMainWarehouseHolding(b)),
      )

      const fg =
        faultyData.groups.find(
          (g) =>
            g.modelKey === modelKey ||
            normalizeProductText(g.displayName) === normalizeProductText(displayName) ||
            normalizeProductText(g.modelKey) === normalizeProductText(modelKey),
        ) || null
      setFaultyGroup(fg)

      const orderClientMap = new Map<string, string>()
      for (const order of orderRows) {
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
      const manual = manuals.find(
        (m) => m.model === modelKey || normalizeProductText(m.name) === normalizeProductText(displayName),
      )
      const startingUnits = Number(manual?.qty) || Number(product?.startingQty) || 0
      const currentMainQty = Number(manual?.availableQty) || Number(product?.inStock) || 0
      const productFilter = buildTrackProductFilter(modelKey, displayName)

      const enriched = applyMovementCatalog(
        enrichMovements(history, orderClientMap),
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

      const rebuilt = rebuildProductTrailForBalance({
        movements: matched,
        orderRows,
        filter: productFilter,
        startingUnits,
        currentMainQty,
        displayName,
        modelKey,
        unit: product?.unit || manual?.unit || "pcs",
      })
      setMainWhOpening(rebuilt.opening)
      setMainWhTrailEnd(rebuilt.ending)
      setHistoryGap(rebuilt.historyGap)
      setRows(rebuilt.rows)
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
    const branchRows = branchHoldings.filter((b) => !isMainWarehouseHolding(b))
    const atBranches = branchRows.reduce((s, b) => s + (Number(b.quantity) || 0), 0)

    const erpOrders = orders.filter((o) => !isBranchPosOrderHiddenFromErp(o))
    const productFilter = buildTrackProductFilter(selected.modelKey, selected.displayName)
    const net = computeNetDeliveredProductQty(erpOrders, productFilter)
    const movement = computeProductReturnReplaceSummary(erpOrders, productFilter)

    const orderAggs: OrderAgg[] = erpOrders
      .filter((o) => o.status === "delivered" && orderMatchesProductFilter(o, productFilter))
      .map((o) => ({
        orderNumber: o.orderNumber,
        client: o.clientName || "—",
        qty: matchingProductQty(o, productFilter),
        count: 1,
      }))
      .filter((o) => o.qty > 0)
      .sort((a, b) => b.qty - a.qty)

    let transfers = 0
    let pos = 0
    let historyReturns = 0
    let addedToWh = 0
    let leftWh = 0
    const posMap = new Map<string, PosAgg>()
    const transferMap = new Map<string, TransferAgg>()

    for (const m of rows) {
      const delta = mainWarehouseDelta(m)
      if (delta > 0) addedToWh += delta
      if (delta < 0) leftWh += Math.abs(delta)

      const kind = getTrackEventKind(m)
      const qty = m.abs_quantity

      // Skip client-order history for ERP totals — those are double-logged (line + SN scans).
      if (kind === "Client order" || kind === "Order return" || kind === "Order replacement") {
        continue
      }

      if (kind === "Transfer") {
        transfers += qty
        const route = getTrackPlaceLabel(m)
        const prev = transferMap.get(route) || { route, qty: 0, count: 0 }
        prev.qty += qty
        prev.count += 1
        transferMap.set(route, prev)
      } else if (kind === "POS sale") {
        pos += qty
        const ref = m.reference_number || m.order_number || "POS"
        const branch = getPosBranchLabel(m)
        const key = `${branch}||${ref}`
        const prev = posMap.get(key) || { ref, branch, qty: 0, count: 0 }
        prev.qty += qty
        prev.count += 1
        posMap.set(key, prev)
      } else if (kind === "Return") {
        historyReturns += qty
      }
    }

    return {
      starting,
      mainNow,
      faultyNow,
      atBranches,
      erpOrdersNet: net.netQty,
      erpOrdersLine: net.lineQty,
      erpReturned: net.returnedQty,
      erpReplaced: net.replacedQty,
      transfers,
      pos,
      returns: Math.max(net.returnedQty, historyReturns),
      addedToWh,
      leftWh,
      unit: selected.unit || net.unit,
      orders: orderAggs,
      returnsList: movement.returns,
      replacementsList: movement.replacements,
      posRows: [...posMap.values()].sort((a, b) => b.qty - a.qty),
      transferRows: [...transferMap.values()].sort((a, b) => b.qty - a.qty),
      branchRows,
      mainWhOpening,
      mainWhTrailEnd,
      historyGap,
    }
  }, [selected, manualItems, rows, faultyGroup, branchHoldings, orders, mainWhOpening, mainWhTrailEnd, historyGap])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-1 sm:p-2" onClick={onClose}>
      <div
        className="w-full h-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[hsl(var(--border))] shrink-0">
          <p className="text-sm font-semibold shrink-0">Track product</p>
          <div className="relative w-40 shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Filter…"
              className="w-full h-7 border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-7 pr-2 text-[11px] focus:outline-none"
            />
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="flex-1 min-w-[200px] h-7 border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-[11px] cursor-pointer"
          >
            <option value="">Select a product…</option>
            {filteredProducts.map((p) => (
              <option key={p.modelKey} value={p.modelKey}>
                {p.displayName} · {p.inStock}/{p.startingQty} {p.unit}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {selected && summary && (
          <div className="px-3 py-1.5 border-b border-[hsl(var(--border))] flex flex-wrap gap-1.5 shrink-0">
            <Stat label="Starting units" value={summary.starting} unit={summary.unit} hint="Total recorded" />
            <Stat
              label="Main WH opening"
              value={summary.mainWhOpening ?? "—"}
              unit={summary.unit}
              hint="Before first movement"
            />
            <Stat label="Main WH now" value={summary.mainNow} unit={summary.unit} />
            <Stat label="Branches" value={summary.atBranches} unit={summary.unit} />
            <Stat label="Faulty" value={summary.faultyNow} unit={summary.unit} />
            <Stat
              label="ERP net"
              value={summary.erpOrdersNet}
              unit={summary.unit}
              hint={`${summary.erpOrdersLine}−${summary.erpReturned}−${summary.erpReplaced}`}
            />
            <Stat label="POS" value={summary.pos} unit={summary.unit} />
            <Stat label="Transfers" value={summary.transfers} unit={summary.unit} />
            <Stat label="Returns" value={summary.returns} unit={summary.unit} />
            <Stat label="Main WH +/−" value={`+${summary.addedToWh}/−${summary.leftWh}`} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden p-2 flex flex-col gap-2">
          {!selectedModel ? (
            <div className="flex flex-col items-center justify-center flex-1 text-[hsl(var(--muted-foreground))]">
              <Package className="h-7 w-7 opacity-30 mb-2" />
              <p className="text-xs">Select a product</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center flex-1 gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="text-xs text-center text-red-600 py-8">{error}</p>
          ) : summary ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 min-h-0 shrink-0">
                <MiniTable
                  compact
                  title="ERP client orders"
                  totalLabel={`${summary.erpOrdersNet} net · ${summary.erpOrdersLine}−${summary.erpReturned + summary.erpReplaced}`}
                  headers={["Order", "Client", "Qty"]}
                  empty="No ERP orders."
                  rows={summary.orders.map((o) => [o.orderNumber, o.client, `${o.qty}`])}
                />
                <MiniTable
                  compact
                  title="At branches now"
                  totalLabel={`${summary.atBranches} ${summary.unit}`}
                  headers={["Branch", "Code", "Qty"]}
                  empty="No branch stock."
                  rows={summary.branchRows.map((b) => [b.branchName, b.branchCode, `${b.quantity}`])}
                />
                <MiniTable
                  compact
                  title="POS sales"
                  totalLabel={`${summary.pos} ${summary.unit}`}
                  headers={["Branch", "Order", "Qty"]}
                  empty="No POS sales."
                  rows={summary.posRows.map((p) => [p.branch, p.ref, `${p.qty}`])}
                />
                <MiniTable
                  compact
                  title="Branch transfers"
                  totalLabel={`${summary.transfers} ${summary.unit}`}
                  headers={["Route", "Moves", "Qty"]}
                  empty="No transfers."
                  rows={summary.transferRows.map((t) => [t.route, t.count, `${t.qty}`])}
                />
                <MiniTable
                  compact
                  title="Returns & replacements"
                  totalLabel={`${summary.erpReturned + summary.erpReplaced} ${summary.unit}`}
                  headers={["Type", "Detail", "Qty"]}
                  empty="None."
                  rows={[
                    ...summary.returnsList.map((r) => [
                      "Return",
                      `${r.orderNumber} · ${r.clientName}`,
                      `${r.qty}`,
                    ]),
                    ...summary.replacementsList.map((r) => [
                      "Replaced",
                      `${r.orderNumber}${r.oldSerialNumber ? ` · ${r.oldSerialNumber}→${r.newSerialNumber || "—"}` : ""}`,
                      `${r.qty}`,
                    ]),
                  ]}
                />
                <MiniTable
                  compact
                  title="Faulty / damaged"
                  totalLabel={`${summary.faultyNow} ${summary.unit}`}
                  headers={["Item", "Detail", "Qty"]}
                  empty="None."
                  rows={
                    faultyGroup
                      ? [
                          ...(faultyGroup.serialUnits.length > 0
                            ? faultyGroup.serialUnits.map((u) => [
                                faultyGroup.displayName,
                                `SN ${u.serialNumber}`,
                                "1",
                              ])
                            : [[faultyGroup.displayName, "Qty stock", `${faultyGroup.faultyQty}`]]),
                        ]
                      : summary.faultyNow > 0
                        ? [[selected?.displayName || "Product", "Faulty", `${summary.faultyNow}`]]
                        : []
                  }
                />
              </div>

              <div className="border border-[hsl(var(--border))] min-h-0 flex-1 flex flex-col overflow-hidden">
                <div className="px-2 py-1 border-b border-[hsl(var(--border))] flex items-center justify-between shrink-0">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium">Main WH movement history</p>
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">
                      Opens at {summary.starting}. Trail ends at live Main WH ({summary.mainNow})
                      {summary.historyGap
                        ? ` · history gap ${summary.historyGap > 0 ? "+" : ""}${summary.historyGap}`
                        : ""}
                      . Branch POS does not move Main WH.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] cursor-pointer shrink-0"
                    onClick={() => setShowHistory((v) => !v)}
                  >
                    {showHistory ? "Hide" : "Show"} history
                  </Button>
                </div>
                {showHistory && (
                  <div className="overflow-auto min-h-0 flex-1">
                    {rows.length === 0 ? (
                      <p className="px-2 py-4 text-[10px] text-center text-[hsl(var(--muted-foreground))]">
                        No movements.
                      </p>
                    ) : (
                      <table className="w-full text-[10px] border-collapse min-w-[860px]">
                        <thead className="sticky top-0 bg-[hsl(var(--card))]">
                          <tr className="border-b border-[hsl(var(--border))] text-left text-[9px] uppercase text-[hsl(var(--muted-foreground))]">
                            <th className="px-1.5 py-1 font-medium">Date</th>
                            <th className="px-1.5 py-1 font-medium">Event</th>
                            <th className="px-1.5 py-1 font-medium text-right">Qty</th>
                            <th className="px-1.5 py-1 font-medium text-right">Main WH</th>
                            <th className="px-1.5 py-1 font-medium">Route</th>
                            <th className="px-1.5 py-1 font-medium">Ref</th>
                            <th className="px-1.5 py-1 font-medium">By</th>
                            <th className="px-1.5 py-1 font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/15">
                            <td className="px-1.5 py-0.5 text-[hsl(var(--muted-foreground))]">—</td>
                            <td className="px-1.5 py-0.5 font-medium">Main WH opening</td>
                            <td className="px-1.5 py-0.5 text-right tabular-nums">
                              {summary.mainWhOpening ?? "—"} {summary.unit}
                            </td>
                            <td className="px-1.5 py-0.5 text-right tabular-nums font-medium">
                              {summary.mainWhOpening ?? "—"}
                            </td>
                            <td className="px-1.5 py-0.5 text-[hsl(var(--muted-foreground))]" colSpan={4}>
                              Opening = total recorded units ({summary.starting}). ERP outs use order-line qty once.
                              Closing forced to live Main WH ({summary.mainNow})
                              {summary.historyGap
                                ? ` via book gap ${summary.historyGap > 0 ? "+" : ""}${summary.historyGap}`
                                : ""}
                              .
                            </td>
                          </tr>
                          {rows.map((m) => {
                            const kind = getTrackEventKind(m)
                            const place = getTrackPlaceLabel(m)
                            const delta = mainWarehouseDelta(m)
                            return (
                              <tr key={m.id} className="border-b border-[hsl(var(--border))] last:border-b-0 align-top">
                                <td className="px-1.5 py-0.5 whitespace-nowrap text-[hsl(var(--muted-foreground))]">
                                  {formatMovementDate(m.created_at)}
                                </td>
                                <td className="px-1.5 py-0.5 font-medium">{kind}</td>
                                <td className="px-1.5 py-0.5 text-right tabular-nums whitespace-nowrap">
                                  {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                                  {Math.abs(delta || m.abs_quantity)} {m.unit}
                                </td>
                                <td className="px-1.5 py-0.5 text-right tabular-nums whitespace-nowrap">
                                  {m.balance_before != null && m.balance_after != null
                                    ? `${m.balance_before}→${m.balance_after}`
                                    : "—"}
                                </td>
                                <td className="px-1.5 py-0.5 truncate max-w-[160px]" title={place}>
                                  {place}
                                </td>
                                <td className="px-1.5 py-0.5 whitespace-nowrap">
                                  {m.order_number || m.reference_number || "—"}
                                </td>
                                <td className="px-1.5 py-0.5 text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                                  {m.created_by || "—"}
                                </td>
                                <td className="px-1.5 py-0.5 text-[hsl(var(--muted-foreground))] max-w-[200px]">
                                  <span className="line-clamp-1">{m.notes || "—"}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
