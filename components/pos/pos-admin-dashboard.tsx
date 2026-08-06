"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  CalendarRange,
  Loader2,
  Package,
  RefreshCw,
  Store,
  Terminal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { localDateISO, localDaysAgoISO } from "@/lib/website-analytics"
import {
  formatPosPkr,
  getPosAdminSummary,
  type PosAdminBranchSummary,
  type PosAdminSummary,
} from "@/lib/pos-admin"

type RangeMode =
  | "yesterday"
  | "days3"
  | "week"
  | "month"
  | "months3"
  | "months6"
  | "custom"

type View = "combined" | "branch"

const PRESETS: Array<{ mode: RangeMode; label: string }> = [
  { mode: "yesterday", label: "Yesterday" },
  { mode: "days3", label: "Past 3 days" },
  { mode: "week", label: "Past week" },
  { mode: "month", label: "Past month" },
  { mode: "months3", label: "Past 3 months" },
  { mode: "months6", label: "Past 6 months" },
]

function rangeForMode(mode: RangeMode): { from: string; to: string } {
  const today = localDateISO()
  if (mode === "yesterday") {
    const y = localDaysAgoISO(1)
    return { from: y, to: y }
  }
  if (mode === "days3") return { from: localDaysAgoISO(2), to: today }
  if (mode === "week") return { from: localDaysAgoISO(6), to: today }
  if (mode === "month") return { from: localDaysAgoISO(29), to: today }
  if (mode === "months3") return { from: localDaysAgoISO(89), to: today }
  if (mode === "months6") return { from: localDaysAgoISO(179), to: today }
  return { from: today, to: today }
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 shadow-sm",
        accent ? "border-[#1faca6]/40 bg-[#1faca6]/5" : "bg-[hsl(var(--card))]",
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1 tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

function statusBadge(status: string) {
  const st = status.toLowerCase()
  const cls =
    st === "delivered"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : st === "cancelled" || st === "returned"
        ? "bg-red-50 text-red-700 border-red-200"
        : st === "draft"
          ? "bg-gray-50 text-gray-600 border-gray-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
  return (
    <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize", cls)}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

function formatWhen(iso: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export function PosAdminDashboard() {
  const [mode, setMode] = useState<RangeMode>("month")
  const [from, setFrom] = useState(() => rangeForMode("month").from)
  const [to, setTo] = useState(() => rangeForMode("month").to)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState<PosAdminSummary | null>(null)
  const [view, setView] = useState<View>("combined")
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [branchDetail, setBranchDetail] = useState<PosAdminBranchSummary | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    const summary = await getPosAdminSummary({ from, to })
    if (!summary) {
      setError("Failed to load POS admin data")
      setData(null)
    } else {
      setData(summary)
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (view !== "branch" || !selectedBranchId) {
      setBranchDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    void getPosAdminSummary({ from, to, branchId: selectedBranchId, detail: true }).then((summary) => {
      if (cancelled) return
      setBranchDetail(summary?.byBranch?.[0] || null)
      setDetailLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [view, selectedBranchId, from, to])

  function applyPreset(next: RangeMode) {
    setMode(next)
    if (next === "custom") return
    const range = rangeForMode(next)
    setFrom(range.from)
    setTo(range.to)
  }

  function openBranch(branchId: string) {
    setSelectedBranchId(branchId)
    setView("branch")
  }

  function backToCombined() {
    setView("combined")
    setSelectedBranchId(null)
    setBranchDetail(null)
  }

  const combined = data?.combined
  const selectedMeta = data?.byBranch.find((b) => b.branchId === selectedBranchId)

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Store className="h-4 w-4 text-[#1faca6]" />
            {view === "combined"
              ? "Combined POS sales"
              : selectedMeta?.branchName || branchDetail?.branchName || "POS details"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {view === "combined"
              ? "All branch counters rolled up for the selected period"
              : "Orders, receipts, terminals, and stock for this POS"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === "branch" && (
            <Button type="button" variant="outline" size="sm" onClick={backToCombined}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              All POS
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-[hsl(var(--card))] p-3 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" />
          Date range
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.mode}
              type="button"
              onClick={() => applyPreset(p.mode)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
                mode === p.mode
                  ? "border-[#1faca6] bg-[#1faca6]/10 text-[#1a9f9a]"
                  : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
              mode === "custom"
                ? "border-[#1faca6] bg-[#1faca6]/10 text-[#1a9f9a]"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            Custom
          </button>
        </div>
        {mode === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="block rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="block rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Showing {from} → {to}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading POS data…
        </div>
      ) : view === "combined" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <Stat label="Combined sales" value={formatPosPkr(combined?.combinedSaleTotal || 0)} accent />
            <Stat
              label="POS order sales"
              value={formatPosPkr(combined?.orderSellTotal || 0)}
              hint={`${combined?.orderCount || 0} orders`}
            />
            <Stat
              label="POS profit"
              value={formatPosPkr(combined?.orderProfitTotal || 0)}
              hint="Sell − company list"
            />
            <Stat
              label="Receipt sales"
              value={formatPosPkr(combined?.receiptTotal || 0)}
              hint={`${combined?.receiptCount || 0} receipts`}
            />
            <Stat
              label="Branches / terminals"
              value={`${combined?.branchCount || 0} / ${combined?.terminalCount || 0}`}
            />
            <Stat
              label="Stock on hand"
              value={`${(combined?.stockQty || 0).toLocaleString()} pcs`}
              hint={`${combined?.stockSkuCount || 0} SKUs`}
            />
          </div>

          <div className="rounded-xl border shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 border-b bg-muted/30 flex items-center justify-between">
              <p className="text-sm font-semibold">Sales by POS / branch</p>
              <p className="text-[11px] text-muted-foreground">Click a row for full details</p>
            </div>
            {(data?.byBranch.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No POS branches found for this period</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[hsl(var(--card))] text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Branch</th>
                      <th className="text-left font-medium px-3 py-2">Terminals</th>
                      <th className="text-right font-medium px-3 py-2">Orders</th>
                      <th className="text-right font-medium px-3 py-2">Order sales</th>
                      <th className="text-right font-medium px-3 py-2">Profit</th>
                      <th className="text-right font-medium px-3 py-2">Receipts</th>
                      <th className="text-right font-medium px-3 py-2">Combined</th>
                      <th className="text-right font-medium px-3 py-2">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data!.byBranch.map((b) => (
                      <tr
                        key={b.branchId}
                        className="hover:bg-[#1faca6]/5 cursor-pointer transition-colors"
                        onClick={() => openBranch(b.branchId)}
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-sm">{b.branchName}</p>
                          <p className="text-[10px] text-muted-foreground">{b.branchCode}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1">
                            <Terminal className="h-3 w-3 text-muted-foreground" />
                            {b.terminalCount}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {b.orderCount}
                          <span className="block text-[10px] text-muted-foreground">
                            {b.deliveredCount} delivered · {b.openCount} open
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                          {formatPosPkr(b.orderSellTotal)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatPosPkr(b.orderProfitTotal)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatPosPkr(b.receiptTotal)}
                          <span className="block text-[10px] text-muted-foreground">{b.receiptCount} receipts</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#1a9f9a]">
                          {formatPosPkr(b.combinedSaleTotal)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {b.stockQty.toLocaleString()}
                          <span className="block text-[10px] text-muted-foreground">{b.stockSkuCount} SKUs</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <RecentOrdersTable
              title="Recent POS orders (all branches)"
              rows={data?.recentOrders || []}
              showBranch
            />
            <RecentReceiptsTable
              title="Recent POS receipts (all branches)"
              rows={data?.recentReceipts || []}
              showBranch
            />
          </div>
        </>
      ) : (
        <BranchDetailPanel
          loading={detailLoading}
          branch={branchDetail || selectedMeta || null}
        />
      )}
    </div>
  )
}

function BranchDetailPanel({
  loading,
  branch,
}: {
  loading: boolean
  branch: PosAdminBranchSummary | null
}) {
  if (loading && !branch) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading branch POS details…
      </div>
    )
  }

  if (!branch) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">No details for this POS</p>
    )
  }

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Updating details…
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <Stat label="Combined sales" value={formatPosPkr(branch.combinedSaleTotal)} accent />
        <Stat
          label="Order sales"
          value={formatPosPkr(branch.orderSellTotal)}
          hint={`${branch.orderCount} orders`}
        />
        <Stat label="Profit" value={formatPosPkr(branch.orderProfitTotal)} />
        <Stat
          label="Receipt sales"
          value={formatPosPkr(branch.receiptTotal)}
          hint={`${branch.receiptCount} receipts`}
        />
        <Stat
          label="Order status"
          value={`${branch.deliveredCount} / ${branch.openCount}`}
          hint="Delivered / open"
        />
        <Stat
          label="Stock"
          value={`${branch.stockQty.toLocaleString()} pcs`}
          hint={`${branch.stockSkuCount} SKUs`}
        />
      </div>

      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 border-b bg-muted/30 flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-[#1faca6]" />
          <p className="text-sm font-semibold">Terminals</p>
        </div>
        {branch.terminals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No terminals set up</p>
        ) : (
          <div className="divide-y">
            {branch.terminals.map((t) => (
              <div key={t.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.code}
                    {t.location ? ` · ${t.location}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                    t.isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-gray-50 text-gray-600 border-gray-200",
                  )}
                >
                  {t.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-[#1faca6]/5 border-[#1faca6]/30 px-3 py-2.5 flex items-center gap-2 text-sm">
        <Package className="h-4 w-4 text-[#1a9f9a]" />
        <span>
          Branch stock: <strong>{branch.stockQty.toLocaleString()}</strong> units across{" "}
          <strong>{branch.stockSkuCount}</strong> SKUs
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <RecentOrdersTable
          title={`Orders · ${branch.branchName}`}
          rows={branch.orders || []}
        />
        <RecentReceiptsTable
          title={`Receipts · ${branch.branchName}`}
          rows={branch.receipts || []}
        />
      </div>
    </div>
  )
}

function RecentOrdersTable({
  title,
  rows,
  showBranch,
}: {
  title: string
  rows: Array<{
    id: string
    orderNumber: string
    clientName: string
    status: string
    sellAmount: number
    profit: number
    createdAt: string
    branchName?: string
  }>
  showBranch?: boolean
}) {
  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-muted/30">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No orders in this period</p>
      ) : (
        <div className="overflow-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[hsl(var(--card))] text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Order</th>
                {showBranch && <th className="text-left font-medium px-3 py-2">Branch</th>}
                <th className="text-left font-medium px-3 py-2">Client</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-right font-medium px-3 py-2">Sale</th>
                <th className="text-right font-medium px-3 py-2">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.orderNumber}</p>
                    <p className="text-[10px] text-muted-foreground">{formatWhen(r.createdAt)}</p>
                  </td>
                  {showBranch && (
                    <td className="px-3 py-2 text-muted-foreground">{r.branchName || "—"}</td>
                  )}
                  <td className="px-3 py-2">{r.clientName || "—"}</td>
                  <td className="px-3 py-2">{statusBadge(r.status)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatPosPkr(r.sellAmount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPosPkr(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecentReceiptsTable({
  title,
  rows,
  showBranch,
}: {
  title: string
  rows: Array<{
    id: string
    receiptNumber: string
    terminalName: string
    total: number
    paymentMethod: string
    cashierName: string
    customerName: string
    createdAt: string
    branchName?: string
  }>
  showBranch?: boolean
}) {
  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-muted/30">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No receipts in this period</p>
      ) : (
        <div className="overflow-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[hsl(var(--card))] text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Receipt</th>
                {showBranch && <th className="text-left font-medium px-3 py-2">Branch</th>}
                <th className="text-left font-medium px-3 py-2">Terminal</th>
                <th className="text-left font-medium px-3 py-2">Payment</th>
                <th className="text-right font-medium px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.receiptNumber}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatWhen(r.createdAt)}
                      {r.cashierName ? ` · ${r.cashierName}` : ""}
                    </p>
                  </td>
                  {showBranch && (
                    <td className="px-3 py-2 text-muted-foreground">{r.branchName || "—"}</td>
                  )}
                  <td className="px-3 py-2">{r.terminalName || "—"}</td>
                  <td className="px-3 py-2 capitalize">{r.paymentMethod || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatPosPkr(r.total)}
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
