"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getInventoryHistory } from "@/lib/inventory-history"
import { getOrders } from "@/lib/orders"
import {
  enrichMovements,
  getDateRangeForPreset,
  getReferenceTypeLabel,
  formatMovementDate,
  type DateRangePreset,
  type InventoryMovementRow,
} from "@/lib/inventory-movement-display"
import { downloadInventoryMovementsExcel } from "@/lib/inventory-excel-export"
import { downloadInventoryMovementsPDF } from "@/lib/generate-inventory-movements-pdf"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  ArrowRightLeft,
  Calendar,
  FileDown,
  Package,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"

const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "last_3_days", label: "Last 3 days" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "custom", label: "Custom range" },
]

function formatPeriodLabel(from: string, to: string): string {
  if (from && to) return `${from} to ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return "All time"
}

export function InventoryMovementOverview() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [movements, setMovements] = useState<InventoryMovementRow[]>([])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all")
  const [datePreset, setDatePreset] = useState<DateRangePreset>("last_week")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const dateRange = useMemo(
    () => getDateRangeForPreset(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  )

  const periodLabel = formatPeriodLabel(dateRange.from, dateRange.to)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [history, orders] = await Promise.all([
        getInventoryHistory({
          from: dateRange.from || undefined,
          to: dateRange.to || undefined,
          type: filterType,
        }),
        getOrders(),
      ])

      const orderClientMap = new Map<string, string>()
      for (const order of orders) {
        if (order.id && order.clientName) {
          orderClientMap.set(order.id, order.clientName)
        }
      }

      setMovements(enrichMovements(history, orderClientMap))
    } catch {
      setMovements([])
    } finally {
      setLoading(false)
    }
  }, [dateRange.from, dateRange.to, filterType])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return movements
    return movements.filter((m) => {
      return (
        m.item_description.toLowerCase().includes(q) ||
        m.reference_number.toLowerCase().includes(q) ||
        m.source.toLowerCase().includes(q) ||
        m.destination.toLowerCase().includes(q) ||
        m.client_name.toLowerCase().includes(q) ||
        m.order_number.toLowerCase().includes(q) ||
        m.created_by.toLowerCase().includes(q) ||
        getReferenceTypeLabel(m.reference_type).toLowerCase().includes(q) ||
        (m.notes || "").toLowerCase().includes(q)
      )
    })
  }, [movements, search])

  const stats = useMemo(() => {
    const inbound = filtered.filter((m) => m.is_inbound)
    const outbound = filtered.filter((m) => !m.is_inbound)
    const uniqueClients = new Set(filtered.filter((m) => m.client_name).map((m) => m.client_name))
    const uniqueOrders = new Set(filtered.filter((m) => m.order_number).map((m) => m.order_number))
    return {
      total: filtered.length,
      inboundCount: inbound.length,
      outboundCount: outbound.length,
      qtyIn: inbound.reduce((s, m) => s + m.abs_quantity, 0),
      qtyOut: outbound.reduce((s, m) => s + m.abs_quantity, 0),
      clients: uniqueClients.size,
      orders: uniqueOrders.size,
    }
  }, [filtered])

  function handleExportExcel() {
    if (filtered.length === 0) return
    setExportingExcel(true)
    try {
      downloadInventoryMovementsExcel(filtered, undefined, periodLabel)
      toast({
        title: "Export started",
        message: `${filtered.length} movement(s) exported to Excel.`,
        type: "success",
      })
    } finally {
      setExportingExcel(false)
    }
  }

  function handleExportPdf() {
    if (filtered.length === 0) return
    setExportingPdf(true)
    try {
      downloadInventoryMovementsPDF({
        movements: filtered,
        dateLabel: periodLabel,
      })
      toast({
        title: "PDF generated",
        message: `${filtered.length} movement(s) included in the report.`,
        type: "success",
      })
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Inventory Movement Overview</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-2xl">
            Full audit trail of stock movements — where items came from, where they went, linked orders and clients.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <CrmExcelExportButton
            onExport={handleExportExcel}
            exporting={exportingExcel}
            disabled={filtered.length === 0}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 cursor-pointer"
            disabled={filtered.length === 0 || exportingPdf}
            onClick={handleExportPdf}
          >
            <FileDown className="h-3.5 w-3.5" />
            {exportingPdf ? "Generating…" : "Export PDF"}
          </Button>
        </div>
      </div>

      {/* Date presets */}
      <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
          <Calendar className="h-3.5 w-3.5" />
          Time period
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDatePreset(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                datePreset === id
                  ? "bg-[#1faca6] text-white border-[#1faca6]"
                  : "bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer"
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer"
            />
          </div>
        )}
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Showing: <span className="font-medium text-[hsl(var(--foreground))]">{periodLabel}</span>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 bg-green-50/50 dark:bg-green-950/20">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Stock In</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.inboundCount}</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{stats.qtyIn.toLocaleString()} units</p>
        </div>
        <div className="rounded-lg border p-3 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <TrendingDown className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Stock Out</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.outboundCount}</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{stats.qtyOut.toLocaleString()} units</p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
            <ArrowRightLeft className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Orders</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.orders}</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">dispatch movements</p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
            <Users className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Clients</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.clients}</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">received stock</p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, order, client, source, destination..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-[hsl(var(--muted))]/20 p-1 shrink-0">
          {(["all", "in", "out"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer capitalize ${
                filterType === type
                  ? type === "in"
                    ? "bg-green-600 text-white"
                    : type === "out"
                      ? "bg-red-600 text-white"
                      : "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "hover:bg-[hsl(var(--muted))]/50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {filtered.length} movement{filtered.length !== 1 ? "s" : ""} in selected period
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading movement history...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-lg border">
          <Package className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm font-medium">No movements found</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-sm">
            Try a different date range or filter. Movements are logged when stock is received, dispatched, transferred, or adjusted.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Type</th>
                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Item</th>
                <th className="h-9 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Qty</th>
                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">From</th>
                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">To</th>
                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Order</th>
                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Reference</th>
                <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors">
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {formatMovementDate(m.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    {m.is_inbound ? (
                      <Badge variant="success" className="text-[10px] px-1.5 py-0">
                        <TrendingUp className="h-3 w-3 mr-1" /> IN
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        <TrendingDown className="h-3 w-3 mr-1" /> OUT
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium max-w-[180px]">
                    <span className="line-clamp-2">{m.item_description}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <span
                      className={`text-xs font-bold ${
                        m.is_inbound
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {m.is_inbound ? "+" : "-"}{m.abs_quantity} {m.unit}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] max-w-[140px]">
                    <span className="line-clamp-2">{m.source}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs max-w-[140px]">
                    <span className="line-clamp-2">{m.destination}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-[hsl(var(--primary))] whitespace-nowrap">
                    {m.order_number || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {m.client_name || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <div className="font-medium">{getReferenceTypeLabel(m.reference_type)}</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{m.reference_number}</div>
                    {m.notes && (
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1" title={m.notes}>
                        {m.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {m.created_by}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
