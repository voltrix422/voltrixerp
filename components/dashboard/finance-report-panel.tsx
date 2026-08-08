"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Loader2,
  RefreshCw,
  FileDown,
  FileSpreadsheet,
  CalendarRange,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { localDateISO, localDaysAgoISO } from "@/lib/website-analytics"
import {
  downloadFinanceReportExcel,
  downloadFinanceReportPDF,
  type FinanceReportPayload,
} from "@/lib/generate-finance-report-pdf"

type RangeMode =
  | "yesterday"
  | "days3"
  | "week"
  | "month"
  | "months3"
  | "months6"
  | "custom"

const PRESETS: Array<{ mode: RangeMode; label: string }> = [
  { mode: "yesterday", label: "Yesterday" },
  { mode: "days3", label: "Past 3 days" },
  { mode: "week", label: "Past week" },
  { mode: "month", label: "Past month" },
  { mode: "months3", label: "Past 3 months" },
  { mode: "months6", label: "Past 6 months" },
]

function fmt(n: number) {
  return `PKR ${(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

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

function MiniTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string
  headers: string[]
  rows: string[][]
  empty: string
}) {
  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-muted/30">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{empty}</p>
      ) : (
        <div className="overflow-auto max-h-72">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[hsl(var(--card))] text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="text-left font-medium px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  {r.map((c, j) => (
                    <td
                      key={j}
                      className={cn(
                        "px-3 py-2",
                        j === r.length - 1 && "text-right tabular-nums font-medium",
                      )}
                    >
                      {c}
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

export function FinanceReportPanel() {
  const { user } = useAuth()
  const [mode, setMode] = useState<RangeMode>("month")
  const [from, setFrom] = useState(() => rangeForMode("month").from)
  const [to, setTo] = useState(() => rangeForMode("month").to)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null)
  const [error, setError] = useState("")
  const [data, setData] = useState<FinanceReportPayload | null>(null)
  const reqId = useRef(0)

  const load = useCallback(async (rangeFrom: string, rangeTo: string) => {
    const id = ++reqId.current
    setLoading(true)
    setError("")
    try {
      const res = await fetch(
        `/api/dashboard/finance-report?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`,
      )
      const json = await res.json()
      if (id !== reqId.current) return
      if (!res.ok) throw new Error(json.error || "Failed to load report")
      setData(json as FinanceReportPayload)
    } catch (e) {
      if (id !== reqId.current) return
      setError(e instanceof Error ? e.message : "Failed to load")
      setData(null)
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(from, to)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(next: RangeMode) {
    const r = rangeForMode(next)
    setMode(next)
    setFrom(r.from)
    setTo(r.to)
    void load(r.from, r.to)
  }

  function applyCustom(nextFrom: string, nextTo: string) {
    setMode("custom")
    setFrom(nextFrom)
    setTo(nextTo)
    void load(nextFrom, nextTo)
  }

  async function onPdf() {
    if (!data) return
    setExporting("pdf")
    try {
      await downloadFinanceReportPDF(data, user?.name || "Admin")
    } finally {
      setExporting(null)
    }
  }

  async function onExcel() {
    if (!data) return
    setExporting("xlsx")
    try {
      await downloadFinanceReportExcel(data, user?.name || "Admin")
    } finally {
      setExporting(null)
    }
  }

  const s = data?.summary

  return (
    <section className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-[#1faca6]" />
            Finance report
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Admin only · Orders cash, petty allocations, local &amp; imported purchases, ledger — export as PDF or Excel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!data || !!exporting}
            onClick={() => void onPdf()}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5 mr-1" />
            )}
            PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!data || !!exporting}
            onClick={() => void onExcel()}
          >
            {exporting === "xlsx" ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
            )}
            Excel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => void load(from, to)}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-[hsl(var(--card))] p-3">
        {PRESETS.map((p) => (
          <button
            key={p.mode}
            type="button"
            onClick={() => applyPreset(p.mode)}
            className={cn(
              "text-[11px] px-2.5 py-1.5 rounded-md border cursor-pointer",
              mode === p.mode
                ? "bg-[#1faca6]/15 border-[#1faca6]/50 font-semibold"
                : "hover:bg-accent",
            )}
          >
            {p.label}
          </button>
        ))}
        <label className="text-[11px] text-muted-foreground ml-1">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              applyCustom(v, to < v ? v : to)
            }}
            className="ml-1 h-8 rounded-md border bg-background px-2 text-xs"
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              applyCustom(from > v ? v : from, v)
            }}
            className="ml-1 h-8 rounded-md border bg-background px-2 text-xs"
          />
        </label>
        <p className="text-[11px] text-muted-foreground w-full sm:w-auto sm:ml-auto">
          Showing <span className="font-medium text-foreground">{from}</span> →{" "}
          <span className="font-medium text-foreground">{to}</span>
          {loading ? " · updating…" : ""}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading finance report…
        </div>
      ) : s ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <Stat label="Delivered revenue" value={fmt(s.deliveredRevenue)} hint={`${s.deliveredCount} orders`} accent />
            <Stat label="Orders created value" value={fmt(s.allOrdersValue)} hint={`${s.allOrdersCount} orders`} />
            <Stat
              label="Cash received on orders"
              value={fmt(s.cashReceived)}
              hint={`${s.orderPaymentsCount || 0} approved payments`}
              accent
            />
            <Stat label="POS sales" value={fmt(s.posSalesTotal)} hint={`${s.posCount} sales`} />
            <Stat label="Expenses" value={fmt(s.expensesTotal)} hint="Finance records" />
            <Stat
              label="Petty cash allocated"
              value={fmt(s.pettyAllocated)}
              hint={`${s.pettyAllocationsCount || 0} allocations`}
            />
            <Stat label="Local purchases" value={fmt(s.localPoValue)} hint={`${s.localPoCount} POs · paid ${fmt(s.localPaid)}`} />
            <Stat label="Imported purchases" value={fmt(s.importedPoValue)} hint={`${s.importedPoCount} POs · paid ${fmt(s.importedPaid)}`} />
            <Stat label="Import shipments landed" value={fmt(s.importShipmentsLanded)} hint={`Paid ${fmt(s.importShipmentsPaid)}`} />
            <Stat label="Purchase total" value={fmt(s.purchaseTotalValue)} hint="Local + imported + shipments" />
            <Stat label="Purchase ledger paid" value={fmt(s.ledgerSpend)} hint={`${s.ledgerCount || 0} entries · total ${fmt(s.ledgerTotal)}`} />
            <Stat label="Money in" value={fmt(s.moneyIn)} accent />
            <Stat label="Money out" value={fmt(s.moneyOut)} />
            <Stat
              label="Net cash flow"
              value={fmt(s.netCashFlow)}
              hint={s.netCashFlow >= 0 ? "Positive" : "Negative"}
              accent
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <MiniTable
              title="Payment methods (cash in)"
              headers={["Method", "Amount"]}
              rows={(data?.paymentMethods || []).map((r) => [r.method, fmt(r.amount)])}
              empty="No approved payments in this period"
            />
            <MiniTable
              title="Expenses by category"
              headers={["Category", "Amount"]}
              rows={(data?.expensesByCategory || []).map((r) => [r.category, fmt(r.amount)])}
              empty="No expenses in this period"
            />
          </div>

          <MiniTable
            title="Order cash received (approved payments)"
            headers={["Date", "Order", "Client", "Method", "By", "Received"]}
            rows={(data?.orderPayments || []).map((p) => [
              p.date,
              p.orderNumber,
              p.clientName,
              p.method,
              p.recordedBy || "—",
              fmt(p.amount),
            ])}
            empty="No approved order payments in this period"
          />

          <MiniTable
            title="Delivered orders"
            headers={["Order", "Client", "Date", "Total", "Cash on order"]}
            rows={(data?.deliveredOrders || []).map((o) => [
              o.orderNumber,
              o.clientName,
              o.date,
              fmt(o.total),
              fmt(o.cashReceived),
            ])}
            empty="No delivered orders in this period"
          />

          <MiniTable
            title="Petty cash allocated"
            headers={["Date", "Given to", "Allocated by", "Purpose", "Amount"]}
            rows={(data?.pettyAllocations || []).map((a) => [
              a.date,
              a.employeeName,
              a.allocatedBy || "—",
              a.purpose || "—",
              fmt(a.amount),
            ])}
            empty="No allocations in this period"
          />

          <div className="grid lg:grid-cols-2 gap-4">
            <MiniTable
              title="Local / trade purchases"
              headers={["PO", "Supplier", "Date", "Value", "Paid"]}
              rows={(data?.purchases || [])
                .filter((p) => p.type !== "imported")
                .map((p) => [
                  p.poNumber,
                  p.supplier || "—",
                  p.date,
                  fmt(p.value),
                  fmt(p.paidInPeriod),
                ])}
              empty="No local purchase activity in this period"
            />
            <MiniTable
              title="Imported purchases"
              headers={["PO", "Supplier", "Date", "Value", "Paid"]}
              rows={(data?.purchases || [])
                .filter((p) => p.type === "imported")
                .map((p) => [
                  p.poNumber,
                  p.supplier || "—",
                  p.date,
                  fmt(p.value),
                  fmt(p.paidInPeriod),
                ])}
              empty="No imported PO activity in this period"
            />
          </div>

          <MiniTable
            title="Import shipments"
            headers={["Shipment", "Supplier", "Date", "Landed", "Paid"]}
            rows={(data?.importShipments || []).map((sh) => [
              sh.shipmentNumber,
              sh.supplierName || "—",
              sh.date,
              fmt(sh.landedPkr),
              fmt(sh.paidInPeriod),
            ])}
            empty="No import shipments in this period"
          />

          <MiniTable
            title="Purchase ledger"
            headers={["Ledger #", "Date", "Supplier", "Total", "Paid"]}
            rows={(data?.purchaseLedger || []).map((r) => [
              r.ledgerNumber,
              r.date,
              r.supplierName || "—",
              fmt(r.totalAmount),
              fmt(r.amountPaid),
            ])}
            empty="No purchase ledger entries in this period"
          />

          <MiniTable
            title="Expense / finance records"
            headers={["Date", "Title", "Category", "Amount"]}
            rows={(data?.expenseLines || []).map((e) => [
              e.date,
              e.title,
              e.category,
              fmt(e.amount),
            ])}
            empty="No finance records in this period"
          />
        </>
      ) : null}
    </section>
  )
}
