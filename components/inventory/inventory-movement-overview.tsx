"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getInventoryHistory } from "@/lib/inventory-history"
import { getOrders } from "@/lib/orders"
import { getManualInventoryItems } from "@/lib/manual-inventory"
import {
  enrichMovements,
  attachMainWarehouseBalances,
  applyMovementCatalog,
  buildMovementProductCatalog,
  getDateRangeForPreset,
  getReferenceTypeLabel,
  type DateRangePreset,
  type InventoryMovementRow,
} from "@/lib/inventory-movement-display"
import { InventoryMovementRowCard, InventoryMovementTableRow } from "@/components/inventory/inventory-movement-row"
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const dateRange = useMemo(
    () => getDateRangeForPreset(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  )

  const periodLabel = formatPeriodLabel(dateRange.from, dateRange.to)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [periodHistory, allHistory, orders, manualItems] = await Promise.all([
        getInventoryHistory({
          from: dateRange.from || undefined,
          to: dateRange.to || undefined,
          type: filterType,
        }),
        getInventoryHistory({}),
        getOrders(),
        getManualInventoryItems().catch(() => []),
      ])

      const orderClientMap = new Map<string, string>()
      for (const order of orders) {
        if (order.id && order.clientName) {
          orderClientMap.set(order.id, order.clientName)
        }
      }

      const catalog = buildMovementProductCatalog(manualItems)

      const withBalances = applyMovementCatalog(
        attachMainWarehouseBalances(enrichMovements(allHistory, orderClientMap), catalog),
        catalog,
      )
      const balanceById = new Map(
        withBalances.map((m) => [m.id, { balance_before: m.balance_before, balance_after: m.balance_after }]),
      )

      const periodRows = applyMovementCatalog(
        enrichMovements(periodHistory, orderClientMap).map((m) => {
          const bal = balanceById.get(m.id)
          return bal ? { ...m, ...bal } : m
        }),
        catalog,
      )

      periodRows.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      setMovements(periodRows)
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
        (m.item_model_code || "").toLowerCase().includes(q) ||
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
        <>
          {/* Mobile: compact expandable cards */}
          <div className="md:hidden rounded-lg border overflow-hidden divide-y">
            {filtered.map((m) => (
              <InventoryMovementRowCard key={m.id} movement={m} />
            ))}
          </div>

          {/* Desktop: compact table — click row for full detail */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b bg-[hsl(var(--muted))]/40">
                  <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
                  <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Type</th>
                  <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Item</th>
                  <th className="h-8 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Change</th>
                  <th className="h-8 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Main WH</th>
                  <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">From</th>
                  <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">To</th>
                  <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Order</th>
                  <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
                  <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((m) => (
                  <InventoryMovementTableRow
                    key={m.id}
                    movement={m}
                    expanded={expandedId === m.id}
                    onToggle={() => setExpandedId((id) => (id === m.id ? null : m.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] hidden md:block">
            Click a row for full notes and reference. <strong>Main WH</strong> = main warehouse qty before → after this movement.
          </p>
        </>
      )}
    </div>
  )
}
