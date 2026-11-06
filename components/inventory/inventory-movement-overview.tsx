"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
import { getSession } from "@/lib/auth"
import { useToast } from "@/components/ui/toast"
import {
  ArrowRightLeft,
  Calendar,
  FileDown,
  Loader2,
  Package,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react"

const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last_3_days", label: "Last 3 days" },
  { id: "last_7", label: "Last 7 days" },
  { id: "last_15", label: "Last 15 days" },
  { id: "last_30", label: "Last 30 days" },
  { id: "this_month", label: "This month" },
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
  const [datePreset, setDatePreset] = useState<DateRangePreset>("today")
  const [customFrom, setCustomFrom] = useState(() => getDateRangeForPreset("today").from)
  const [customTo, setCustomTo] = useState(() => getDateRangeForPreset("today").to)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)
  const filterBtnRef = useRef<HTMLButtonElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)

  const dateRange = useMemo(
    () => ({ from: customFrom, to: customTo }),
    [customFrom, customTo],
  )

  function applyDatePreset(preset: DateRangePreset) {
    const range = getDateRangeForPreset(preset)
    setDatePreset(preset)
    setCustomFrom(range.from)
    setCustomTo(range.to)
  }

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

  useEffect(() => {
    if (!filterOpen) {
      setFilterPos(null)
      return
    }
    function place() {
      const btn = filterBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelW = Math.min(328, window.innerWidth - 24)
      const left = Math.min(Math.max(12, r.right - panelW), window.innerWidth - panelW - 12)
      const top = Math.min(r.bottom + 8, window.innerHeight - 24)
      setFilterPos({ top, left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [filterOpen])

  useEffect(() => {
    if (!filterOpen) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (filtersRef.current?.contains(t) || filterBtnRef.current?.contains(t)) return
      setFilterOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [filterOpen])

  const hasActiveFilters = Boolean(search.trim() || filterType !== "all")

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

  async function handleExportPdf() {
    if (filtered.length === 0 || exportingPdf) return
    setExportingPdf(true)
    try {
      await downloadInventoryMovementsPDF({
        movements: filtered,
        dateLabel: periodLabel,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        exportedBy: getSession()?.name,
      })
      toast({
        title: "Downloaded",
        message: `${filtered.length} movement(s) saved as PDF.`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not generate PDF.", type: "error" })
    } finally {
      setExportingPdf(false)
    }
  }

  function clearMovementFilters() {
    setSearch("")
    setFilterType("all")
  }

  return (
    <div className="space-y-4 rounded-[18px] bg-[#f5f5f7] p-3 -m-3 sm:m-0 sm:p-4 sm:rounded-[20px]">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[11px] text-[#86868b] tabular-nums min-w-0">
          <span className="text-[#1d1d1f] font-medium">{periodLabel}</span>
          <span className="mx-1.5 text-[#d2d2d7]">·</span>
          {loading ? "…" : `${filtered.length} movement${filtered.length !== 1 ? "s" : ""}`}
        </p>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <CrmExcelExportButton
            onExport={handleExportExcel}
            exporting={exportingExcel}
            disabled={filtered.length === 0}
            className="h-9 rounded-full px-4 text-[12px] border-black/[0.08] bg-white shadow-sm cursor-pointer"
          />
          <button
            type="button"
            disabled={filtered.length === 0 || exportingPdf}
            onClick={() => void handleExportPdf()}
            className="h-9 rounded-full text-[12px] px-4 gap-1.5 border border-black/[0.08] bg-white shadow-sm cursor-pointer inline-flex items-center font-medium text-[#1d1d1f] hover:bg-black/[0.03] disabled:opacity-40"
          >
            {exportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            PDF
          </button>
          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`relative h-9 w-9 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer border border-black/[0.08] bg-white shadow-sm shrink-0 ${
              filterOpen
                ? "bg-[#1d1d1f] text-white border-transparent"
                : "text-[#86868b] hover:bg-black/[0.04] hover:text-[#1d1d1f]"
            }`}
            aria-label="Filters"
            aria-expanded={filterOpen}
            title="Filters"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            {hasActiveFilters && !filterOpen && (
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#007aff]" />
            )}
          </button>
        </div>
      </div>

      {filterOpen &&
        filterPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={filtersRef}
            className="fixed z-[95] w-[min(19.5rem,calc(100vw-1.5rem))] max-h-[min(72vh,36rem)] overflow-y-auto scrollbar-none overscroll-contain rounded-[18px] border border-black/[0.06] bg-white/92 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-3 space-y-2.5"
            style={{ top: filterPos.top, left: filterPos.left }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f]">Filters</p>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button type="button" onClick={clearMovementFilters} className="text-[11px] font-semibold text-[#0071e3] cursor-pointer">
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer"
                  aria-label="Close filters"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-tight text-[#86868b]">
                <Calendar className="h-3 w-3" />
                Period
              </div>
              <div className="flex flex-wrap gap-1">
                {DATE_PRESETS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyDatePreset(id)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors cursor-pointer ${
                      datePreset === id
                        ? "bg-[#1d1d1f] text-white"
                        : "bg-[#f2f2f7] text-[#6e6e73] hover:text-[#1d1d1f]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value)
                  setDatePreset("custom")
                }}
                className="h-8 flex-1 min-w-[8.5rem] rounded-[10px] border-0 bg-[#f2f2f7] px-2 text-[11px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 cursor-pointer"
              />
              <span className="text-[10px] text-[#86868b]">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value)
                  setDatePreset("custom")
                }}
                className="h-8 flex-1 min-w-[8.5rem] rounded-[10px] border-0 bg-[#f2f2f7] px-2 text-[11px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 cursor-pointer"
              />
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full h-8 pl-8 pr-2.5 rounded-[10px] border-0 bg-[#f2f2f7] text-[12px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
              />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">Direction</p>
              <div className="flex gap-1 rounded-[10px] bg-[#f2f2f7] p-1">
                {(["all", "in", "out"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilterType(type)}
                    className={`flex-1 h-7 rounded-[7px] text-[10px] font-semibold capitalize transition-colors cursor-pointer ${
                      filterType === type
                        ? "bg-white text-[#1d1d1f] shadow-sm"
                        : "text-[#6e6e73] hover:text-[#1d1d1f]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 text-[#34c759]">
            <TrendingUp className="h-4 w-4" strokeWidth={2} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">In</span>
          </div>
          <p className="text-xl font-bold mt-1 text-[#1d1d1f] tabular-nums">{stats.inboundCount}</p>
          <p className="text-[10px] text-[#86868b]">{stats.qtyIn.toLocaleString()} units</p>
        </div>
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 text-[#ff3b30]">
            <TrendingDown className="h-4 w-4" strokeWidth={2} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">Out</span>
          </div>
          <p className="text-xl font-bold mt-1 text-[#1d1d1f] tabular-nums">{stats.outboundCount}</p>
          <p className="text-[10px] text-[#86868b]">{stats.qtyOut.toLocaleString()} units</p>
        </div>
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 text-[#86868b]">
            <ArrowRightLeft className="h-4 w-4" strokeWidth={2} />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Orders</span>
          </div>
          <p className="text-xl font-bold mt-1 text-[#1d1d1f] tabular-nums">{stats.orders}</p>
          <p className="text-[10px] text-[#86868b]">Dispatch</p>
        </div>
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 text-[#86868b]">
            <Users className="h-4 w-4" strokeWidth={2} />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Clients</span>
          </div>
          <p className="text-xl font-bold mt-1 text-[#1d1d1f] tabular-nums">{stats.clients}</p>
          <p className="text-[10px] text-[#86868b]">Receiving</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 rounded-[16px] bg-white border border-black/[0.06]">
          <p className="text-sm text-[#86868b]">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-[16px] bg-white border border-black/[0.06] shadow-sm">
          <Package className="h-10 w-10 text-[#86868b] opacity-40 mb-3" strokeWidth={1.25} />
          <p className="text-[15px] font-semibold text-[#1d1d1f]">No movements</p>
          <p className="text-[12px] text-[#86868b] mt-1 max-w-[280px]">
            Adjust period or filters.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: compact expandable cards */}
          <div className="md:hidden rounded-[16px] border border-black/[0.06] bg-white overflow-hidden divide-y divide-black/[0.06] shadow-sm">
            {filtered.map((m) => (
              <InventoryMovementRowCard key={m.id} movement={m} />
            ))}
          </div>

          {/* Desktop: compact table — click row for full detail */}
          <div className="hidden md:block rounded-[16px] border border-black/[0.06] bg-white overflow-x-auto shadow-sm">
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
          <p className="text-[10px] text-[#86868b] hidden md:block px-1">
            Row: detail · Main WH = qty before → after.
          </p>
        </>
      )}
    </div>
  )
}
