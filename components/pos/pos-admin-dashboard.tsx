"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
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
import { PosAdminOrderDetailModal } from "@/components/pos/pos-admin-order-detail"

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
  { mode: "days3", label: "3 days" },
  { mode: "week", label: "Week" },
  { mode: "month", label: "Month" },
  { mode: "months3", label: "3 months" },
  { mode: "months6", label: "6 months" },
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

function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("border border-[hsl(var(--border))] rounded-sm", className)}>
      {children}
    </div>
  )
}

function PanelHead({
  title,
  hint,
}: {
  title: string
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-[hsl(var(--border))]">
      <p className="text-xs font-medium tracking-wide">{title}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="border border-[hsl(var(--border))] rounded-sm px-2.5 py-2">
      <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
      <p className="text-sm font-semibold mt-1 tabular-nums tracking-tight leading-tight">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">{hint}</p>}
    </div>
  )
}

function statusText(status: string) {
  return (
    <span className="inline-flex border border-[hsl(var(--border))] rounded-sm px-1.5 py-0.5 text-[10px] capitalize">
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

const th = "text-left font-medium px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"
const thR = cn(th, "text-right")
const td = "px-2 py-1.5 align-top"
const tdR = cn(td, "text-right tabular-nums")

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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

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
    <div className="flex-1 overflow-auto p-3 md:p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            {view === "combined"
              ? "Combined POS sales"
              : selectedMeta?.branchName || branchDetail?.branchName || "POS details"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {view === "combined"
              ? "All counters · selected period"
              : "Branch orders, terminals & stock"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {view === "branch" && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-sm shadow-none" onClick={backToCombined}>
              <ArrowLeft className="h-3 w-3 mr-1" />
              All POS
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs rounded-sm shadow-none"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            <span className="ml-1">Refresh</span>
          </Button>
        </div>
      </div>

      <Panel className="px-2.5 py-2 space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.mode}
              type="button"
              onClick={() => applyPreset(p.mode)}
              className={cn(
                "rounded-sm px-2 py-0.5 text-[11px] border border-[hsl(var(--border))]",
                mode === p.mode
                  ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={cn(
              "rounded-sm px-2 py-0.5 text-[11px] border border-[hsl(var(--border))]",
              mode === "custom"
                ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"
                : "bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Custom
          </button>
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            {from} → {to}
          </span>
        </div>
        {mode === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] flex items-center gap-1.5">
              <span className="text-muted-foreground">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-7 rounded-sm border border-[hsl(var(--border))] bg-transparent px-1.5 text-xs"
              />
            </label>
            <label className="text-[11px] flex items-center gap-1.5">
              <span className="text-muted-foreground">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-7 rounded-sm border border-[hsl(var(--border))] bg-transparent px-1.5 text-xs"
              />
            </label>
          </div>
        )}
      </Panel>

      {error && (
        <div className="border border-[hsl(var(--border))] rounded-sm px-2.5 py-2 text-xs">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : view === "combined" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            <Stat label="Combined sales" value={formatPosPkr(combined?.combinedSaleTotal || 0)} />
            <Stat
              label="Order sales"
              value={formatPosPkr(combined?.orderSellTotal || 0)}
              hint={`${combined?.orderCount || 0} orders`}
            />
            <Stat
              label="Profit"
              value={formatPosPkr(combined?.orderProfitTotal || 0)}
              hint="Sell − company"
            />
            <Stat
              label="Receipts"
              value={formatPosPkr(combined?.receiptTotal || 0)}
              hint={`${combined?.receiptCount || 0} receipts`}
            />
            <Stat
              label="Branches / terminals"
              value={`${combined?.branchCount || 0} / ${combined?.terminalCount || 0}`}
            />
            <Stat
              label="Stock"
              value={`${(combined?.stockQty || 0).toLocaleString()} pcs`}
              hint={`${combined?.stockSkuCount || 0} SKUs`}
            />
          </div>

          <Panel className="overflow-hidden">
            <PanelHead title="Sales by branch" hint="Click row for details" />
            {(data?.byBranch.length || 0) === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No branches found</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))]">
                      <th className={th}>Branch</th>
                      <th className={thR}>Term.</th>
                      <th className={thR}>Orders</th>
                      <th className={thR}>Order sales</th>
                      <th className={thR}>Profit</th>
                      <th className={thR}>Receipts</th>
                      <th className={thR}>Combined</th>
                      <th className={thR}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.byBranch.map((b) => (
                      <tr
                        key={b.branchId}
                        className="border-b border-[hsl(var(--border))] last:border-0 cursor-pointer hover:bg-[hsl(var(--muted))]/30"
                        onClick={() => openBranch(b.branchId)}
                      >
                        <td className={td}>
                          <p className="font-medium">{b.branchName}</p>
                          <p className="text-[10px] text-muted-foreground">{b.branchCode}</p>
                        </td>
                        <td className={tdR}>{b.terminalCount}</td>
                        <td className={tdR}>
                          {b.orderCount}
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            {b.deliveredCount}d / {b.openCount}o
                          </span>
                        </td>
                        <td className={tdR}>{formatPosPkr(b.orderSellTotal)}</td>
                        <td className={tdR}>{formatPosPkr(b.orderProfitTotal)}</td>
                        <td className={tdR}>
                          {formatPosPkr(b.receiptTotal)}
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            {b.receiptCount}
                          </span>
                        </td>
                        <td className={cn(tdR, "font-medium")}>{formatPosPkr(b.combinedSaleTotal)}</td>
                        <td className={tdR}>
                          {b.stockQty.toLocaleString()}
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            {b.stockSkuCount} SKU
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : (
        <BranchDetailPanel
          loading={detailLoading}
          branch={branchDetail || selectedMeta || null}
          onOrderClick={setSelectedOrderId}
        />
      )}

      {selectedOrderId && (
        <PosAdminOrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  )
}

function BranchDetailPanel({
  loading,
  branch,
  onOrderClick,
}: {
  loading: boolean
  branch: PosAdminBranchSummary | null
  onOrderClick: (orderId: string) => void
}) {
  if (loading && !branch) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading…
      </div>
    )
  }

  if (!branch) {
    return <p className="text-xs text-muted-foreground text-center py-8">No details for this POS</p>
  }

  return (
    <div className="space-y-2">
      {loading && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating…
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <Stat label="Combined sales" value={formatPosPkr(branch.combinedSaleTotal)} />
        <Stat
          label="Order sales"
          value={formatPosPkr(branch.orderSellTotal)}
          hint={`${branch.orderCount} orders`}
        />
        <Stat label="Profit" value={formatPosPkr(branch.orderProfitTotal)} />
        <Stat
          label="Receipts"
          value={formatPosPkr(branch.receiptTotal)}
          hint={`${branch.receiptCount} receipts`}
        />
        <Stat
          label="Delivered / open"
          value={`${branch.deliveredCount} / ${branch.openCount}`}
        />
        <Stat
          label="Stock"
          value={`${branch.stockQty.toLocaleString()} pcs`}
          hint={`${branch.stockSkuCount} SKUs`}
        />
      </div>

      <Panel className="overflow-hidden">
        <PanelHead title="Terminals" />
        {branch.terminals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No terminals</p>
        ) : (
          <div>
            {branch.terminals.map((t) => (
              <div
                key={t.id}
                className="px-2.5 py-1.5 flex items-center justify-between gap-3 text-xs border-b border-[hsl(var(--border))] last:border-0"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t.code}
                    {t.location ? ` · ${t.location}` : ""}
                  </p>
                </div>
                <span className="border border-[hsl(var(--border))] rounded-sm px-1.5 py-0.5 text-[10px]">
                  {t.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="px-2.5 py-1.5 text-xs">
        Stock: <span className="font-medium tabular-nums">{branch.stockQty.toLocaleString()}</span> units ·{" "}
        <span className="font-medium tabular-nums">{branch.stockSkuCount}</span> SKUs
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        <RecentOrdersTable
          title={`Orders · ${branch.branchName}`}
          rows={branch.orders || []}
          onOrderClick={onOrderClick}
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
  onOrderClick,
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
  onOrderClick?: (orderId: string) => void
}) {
  return (
    <Panel className="overflow-hidden">
      <PanelHead title={title} hint={rows.length > 0 ? "Click for details" : undefined} />
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No orders</p>
      ) : (
        <div className="overflow-auto max-h-80">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[hsl(var(--background))]">
              <tr className="border-b border-[hsl(var(--border))]">
                <th className={th}>Order</th>
                {showBranch && <th className={th}>Branch</th>}
                <th className={th}>Client</th>
                <th className={th}>Status</th>
                <th className={thR}>Sale</th>
                <th className={thR}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))]/30",
                    onOrderClick && "cursor-pointer",
                  )}
                  onClick={() => onOrderClick?.(r.id)}
                >
                  <td className={td}>
                    <p className="font-medium">{r.orderNumber}</p>
                    <p className="text-[10px] text-muted-foreground">{formatWhen(r.createdAt)}</p>
                  </td>
                  {showBranch && (
                    <td className={cn(td, "text-muted-foreground")}>{r.branchName || "—"}</td>
                  )}
                  <td className={td}>{r.clientName || "—"}</td>
                  <td className={td}>{statusText(r.status)}</td>
                  <td className={cn(tdR, "font-medium")}>{formatPosPkr(r.sellAmount)}</td>
                  <td className={tdR}>{formatPosPkr(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
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
    <Panel className="overflow-hidden">
      <PanelHead title={title} />
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No receipts</p>
      ) : (
        <div className="overflow-auto max-h-80">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[hsl(var(--background))]">
              <tr className="border-b border-[hsl(var(--border))]">
                <th className={th}>Receipt</th>
                {showBranch && <th className={th}>Branch</th>}
                <th className={th}>Terminal</th>
                <th className={th}>Payment</th>
                <th className={thR}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className={td}>
                    <p className="font-medium">{r.receiptNumber}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatWhen(r.createdAt)}
                      {r.cashierName ? ` · ${r.cashierName}` : ""}
                    </p>
                  </td>
                  {showBranch && (
                    <td className={cn(td, "text-muted-foreground")}>{r.branchName || "—"}</td>
                  )}
                  <td className={td}>{r.terminalName || "—"}</td>
                  <td className={cn(td, "capitalize")}>{r.paymentMethod || "—"}</td>
                  <td className={cn(tdR, "font-medium")}>{formatPosPkr(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
