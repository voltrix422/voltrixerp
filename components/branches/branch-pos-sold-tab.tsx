"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getOrders, resolveOrderItemModel, type Order } from "@/lib/orders"
import {
  normalizeProductText,
  productCanonicalKeyFromText,
} from "@/lib/order-product-search"
import { Loader2 } from "lucide-react"

type SaleLine = {
  key: string
  orderId: string
  orderNumber: string
  clientName: string
  status: string
  productLabel: string
  model: string
  productKey: string
  qty: number
  returnedQty: number
  netQty: number
  unit: string
  unitPrice: number
  soldAt: string
}

function productLabel(order: Order, item: Order["items"][number]) {
  const model = resolveOrderItemModel(item)?.trim()
  const desc = item.description?.trim()
  if (model && desc && normalizeProductText(model) !== normalizeProductText(desc)) {
    return `${desc} · ${model}`
  }
  return desc || model || "Unknown item"
}

function buildSaleLines(orders: Order[]): SaleLine[] {
  const lines: SaleLine[] = []
  for (const order of orders) {
    if (String(order.source || "").toLowerCase() !== "branch_pos") continue
    const soldAt =
      order.fulfillmentDate ||
      order.inventoryDeductedAt ||
      order.deliveryDate ||
      order.createdAt

    for (const item of order.items || []) {
      const qty = Number(item.qty) || 0
      if (qty <= 0 && !(order.returnLines || []).some((r) => r.orderItemId === item.id)) {
        // Still include zeroed lines if they had returns (fully returned)
      }
      const returnedQty = (order.returnLines || [])
        .filter((r) => r.orderItemId === item.id)
        .reduce((s, r) => s + (Number(r.qty) || 0), 0)
      // When merchandise return already zeroed the line, rebuild gross from remaining + returned.
      const effectiveGross =
        order.returnMerchandiseApplied && returnedQty > 0 ? qty + returnedQty : qty
      if (effectiveGross <= 0 && returnedQty <= 0) continue

      const model = resolveOrderItemModel(item) || item.model || ""
      const label = productLabel(order, item)
      const productKey = productCanonicalKeyFromText(`${model} ${item.description}`)
      lines.push({
        key: `${order.id}:${item.id}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientName: order.clientName || "—",
        status: order.status,
        productLabel: label,
        model,
        productKey,
        qty: effectiveGross,
        returnedQty,
        netQty: Math.max(0, effectiveGross - returnedQty),
        unit: item.unit || "pcs",
        unitPrice: Number(item.unitPrice) || 0,
        soldAt,
      })
    }

    // Fully removed return lines that no longer exist on items
    for (const ret of order.returnLines || []) {
      if ((order.items || []).some((it) => it.id === ret.orderItemId)) continue
      const model = ret.model || ""
      const desc = ret.description || model || "Returned item"
      const productKey = productCanonicalKeyFromText(`${model} ${desc}`)
      const qty = Number(ret.qty) || 0
      if (qty <= 0) continue
      lines.push({
        key: `${order.id}:return:${ret.id}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientName: order.clientName || "—",
        status: order.status,
        productLabel: model && desc !== model ? `${desc} · ${model}` : desc,
        model,
        productKey,
        qty,
        returnedQty: qty,
        netQty: 0,
        unit: ret.unit || "pcs",
        unitPrice: Number(ret.unitPrice) || 0,
        soldAt: ret.returnedAt || soldAt,
      })
    }
  }

  return lines.sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime())
}

export function BranchPosSoldTab({
  branchId,
  branchName,
}: {
  branchId: string
  branchName: string
}) {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [productFilter, setProductFilter] = useState("")
  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getOrders({ branchId, source: "branch_pos" })
      setOrders(rows)
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    void load()
  }, [load])

  const allLines = useMemo(() => buildSaleLines(orders), [orders])

  const productOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; qty: number }>()
    for (const line of allLines) {
      const existing = map.get(line.productKey)
      if (existing) {
        existing.qty += line.netQty
      } else {
        map.set(line.productKey, {
          key: line.productKey,
          label: line.model || line.productLabel,
          qty: line.netQty,
        })
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [allLines])

  const filtered = useMemo(() => {
    const q = normalizeProductText(query)
    return allLines.filter((line) => {
      if (productFilter && line.productKey !== productFilter) return false
      if (!q) return true
      return (
        normalizeProductText(line.productLabel).includes(q) ||
        normalizeProductText(line.model).includes(q) ||
        normalizeProductText(line.orderNumber).includes(q) ||
        normalizeProductText(line.clientName).includes(q)
      )
    })
  }, [allLines, productFilter, query])

  const summary = useMemo(() => {
    const gross = filtered.reduce((s, l) => s + l.qty, 0)
    const returned = filtered.reduce((s, l) => s + l.returnedQty, 0)
    const net = filtered.reduce((s, l) => s + l.netQty, 0)
    const ordersTouched = new Set(filtered.map((l) => l.orderId)).size
    return { gross, returned, net, ordersTouched, lines: filtered.length }
  }, [filtered])

  if (loading) {
    return (
      <div className="mt-3 flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border bg-[hsl(var(--card))] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Branch POS units sold at {branchName}. Filter by product to see how many of that item went out.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Product
                </span>
                <select
                  className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                >
                  <option value="">All products</option>
                  {productOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label} ({opt.qty} sold)
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Search
                </span>
                <input
                  className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
                  placeholder="Order #, client, model…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border bg-[hsl(var(--muted))]/20 px-3 py-2">
            <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Sold (net)</p>
            <p className="text-sm font-semibold tabular-nums">{summary.net} pcs</p>
          </div>
          <div className="rounded-md border bg-[hsl(var(--muted))]/20 px-3 py-2">
            <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Gross</p>
            <p className="text-sm font-semibold tabular-nums">{summary.gross} pcs</p>
          </div>
          <div className="rounded-md border bg-[hsl(var(--muted))]/20 px-3 py-2">
            <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Returned</p>
            <p className="text-sm font-semibold tabular-nums">{summary.returned} pcs</p>
          </div>
          <div className="rounded-md border bg-[hsl(var(--muted))]/20 px-3 py-2">
            <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Orders</p>
            <p className="text-sm font-semibold tabular-nums">{summary.ordersTouched}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-[hsl(var(--card))] overflow-hidden">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No POS sales for this branch{productFilter || query ? " with the current filter" : " yet"}.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[min(70vh,560px)] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[hsl(var(--card))]">
                <tr className="border-b bg-[hsl(var(--muted))]/30 text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium text-right">Sold</th>
                  <th className="px-3 py-2 font-medium text-right">Returned</th>
                  <th className="px-3 py-2 font-medium text-right">Net</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((line) => (
                  <tr key={line.key} className="border-b last:border-0 hover:bg-[hsl(var(--muted))]/10">
                    <td className="px-3 py-2 whitespace-nowrap text-[hsl(var(--muted-foreground))]">
                      {new Date(line.soldAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{line.orderNumber}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate">{line.clientName}</td>
                    <td className="px-3 py-2 max-w-[220px]">
                      <span className="line-clamp-2">{line.productLabel}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {line.qty} {line.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-orange-700 whitespace-nowrap">
                      {line.returnedQty > 0 ? `${line.returnedQty} ${line.unit}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                      {line.netQty} {line.unit}
                    </td>
                    <td className="px-3 py-2 capitalize text-[hsl(var(--muted-foreground))]">{line.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
