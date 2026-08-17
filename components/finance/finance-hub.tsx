"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, RefreshCw, ListTree, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OrderPaymentAggregate, OrderPaymentPeriodBreakdown } from "@/lib/order-payment-stats"

type OrderPaymentsPayload = {
  allTime: OrderPaymentAggregate
  inPeriod: OrderPaymentPeriodBreakdown
}

type Breakdown = {
  moneyIn: {
    clientPayments: number
    posSales: number
    incomeRecords: number
    loans: number
  }
  moneyOut: {
    expenses: number
    salaries: number
    localPurchases: number
    purchaseLedger: number
    importedPurchases: number
    importShipments: number
    pettyCash: number
    advances: number
    supplierAdvances?: number
    salaryAdvances?: number
    cashback: number
  }
}

type Summary = {
  moneyIn: number
  moneyOut: number
  netCashFlow: number
  breakdown?: Breakdown
}

type ToggleKey =
  | "clientPayments"
  | "posSales"
  | "incomeRecords"
  | "loans"
  | "expenses"
  | "salaries"
  | "localPurchases"
  | "purchaseLedger"
  | "importedPurchases"
  | "importShipments"
  | "pettyCash"
  | "advances"
  | "cashback"

type ToggleDef = {
  key: ToggleKey
  label: string
  side: "in" | "out"
  defaultOn: boolean
}

const TOGGLES: ToggleDef[] = [
  { key: "clientPayments", label: "Client payments", side: "in", defaultOn: true },
  { key: "posSales", label: "POS sales", side: "in", defaultOn: true },
  { key: "incomeRecords", label: "Income records", side: "in", defaultOn: true },
  { key: "loans", label: "Loans received", side: "in", defaultOn: true },
  { key: "expenses", label: "Expenses", side: "out", defaultOn: true },
  { key: "salaries", label: "Salaries", side: "out", defaultOn: true },
  { key: "localPurchases", label: "Local PO payments", side: "out", defaultOn: true },
  { key: "purchaseLedger", label: "Purchase ledger", side: "out", defaultOn: true },
  { key: "importedPurchases", label: "Imported PO payments", side: "out", defaultOn: true },
  { key: "importShipments", label: "Import shipments", side: "out", defaultOn: true },
  { key: "pettyCash", label: "Petty cash", side: "out", defaultOn: true },
  { key: "advances", label: "Advances", side: "out", defaultOn: true },
  { key: "cashback", label: "Cashback", side: "out", defaultOn: true },
]

function defaultEnabled(): Record<ToggleKey, boolean> {
  return Object.fromEntries(TOGGLES.map(t => [t.key, t.defaultOn])) as Record<ToggleKey, boolean>
}

function fmt(n: number, decimals = 0) {
  return `PKR ${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

const PERIODS = [
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "year", label: "This year" },
]

function emptyBreakdown(): Breakdown {
  return {
    moneyIn: { clientPayments: 0, posSales: 0, incomeRecords: 0, loans: 0 },
    moneyOut: {
      expenses: 0,
      salaries: 0,
      localPurchases: 0,
      purchaseLedger: 0,
      importedPurchases: 0,
      importShipments: 0,
      pettyCash: 0,
      advances: 0,
      cashback: 0,
    },
  }
}

function amountFor(b: Breakdown, key: ToggleKey): number {
  if (key in b.moneyIn) return b.moneyIn[key as keyof Breakdown["moneyIn"]]
  return b.moneyOut[key as keyof Breakdown["moneyOut"]] as number
}

function ToggleChip({
  on,
  label,
  amount,
  onClick,
}: {
  on: boolean
  label: string
  amount?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
        on
          ? "border-[hsl(var(--foreground))]/40 bg-[hsl(var(--muted))]/30 text-[hsl(var(--foreground))]"
          : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] opacity-60"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full border ${on ? "bg-[hsl(var(--foreground))] border-[hsl(var(--foreground))]" : "border-[hsl(var(--muted-foreground))]"}`} />
      {label}
      {amount != null && <span className="tabular-nums opacity-70">{fmt(amount, 2)}</span>}
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="tabular-nums font-medium shrink-0">{value}</span>
    </div>
  )
}

export function FinanceHub({ embedded: _embedded }: { embedded?: boolean }) {
  const [period, setPeriod] = useState("month")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [periodLabel, setPeriodLabel] = useState("This month")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [orderPayments, setOrderPayments] = useState<OrderPaymentsPayload | null>(null)
  const [includeOutstanding, setIncludeOutstanding] = useState(false)
  const [enabled, setEnabled] = useState<Record<ToggleKey, boolean>>(defaultEnabled)
  const [showDetails, setShowDetails] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/finance/overview?period=${period}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setPeriodLabel(data.periodLabel || "This month")
      setSummary(data.summary)
      setOrderPayments(data.orderPayments ?? null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const breakdown = summary?.breakdown ?? emptyBreakdown()

  const inLines = useMemo(
    () =>
      TOGGLES.filter(t => t.side === "in").map(t => ({
        key: t.key,
        label: t.label,
        amount: amountFor(breakdown, t.key),
        on: enabled[t.key],
      })),
    [breakdown, enabled],
  )

  const outLines = useMemo(
    () =>
      TOGGLES.filter(t => t.side === "out").map(t => ({
        key: t.key,
        label: t.label,
        amount: amountFor(breakdown, t.key),
        on: enabled[t.key],
      })),
    [breakdown, enabled],
  )

  const moneyIn = inLines.filter(l => l.on).reduce((s, l) => s + l.amount, 0)
  const moneyOut = outLines.filter(l => l.on).reduce((s, l) => s + l.amount, 0)
  const moneyInAll = inLines.reduce((s, l) => s + l.amount, 0)
  const moneyOutAll = outLines.reduce((s, l) => s + l.amount, 0)
  const net = moneyIn - moneyOut

  const toggle = (key: ToggleKey) => {
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const setSide = (side: "in" | "out", on: boolean) => {
    setEnabled(prev => {
      const next = { ...prev }
      for (const t of TOGGLES) {
        if (t.side === side) next[t.key] = on
      }
      return next
    })
  }

  if (loading && !summary) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border p-6 text-center space-y-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
        <Button size="sm" variant="outline" onClick={load}>Retry</Button>
      </div>
    )
  }

  if (!summary || !orderPayments) return null

  const periodReceived = orderPayments.inPeriod.approvedInPeriod
  const allTimeReceived = orderPayments.allTime.totalReceived
  const outstanding = orderPayments.allTime.totalOutstanding
  const loansInPeriod = breakdown.moneyIn.loans

  const displayTotal =
    periodReceived +
    (enabled.loans ? loansInPeriod : 0) +
    (includeOutstanding ? outstanding : 0)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border p-0.5">
          {PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p.id
                  ? "border border-[hsl(var(--foreground))]/20 bg-[hsl(var(--muted))]/40"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setShowDetails(v => !v)}>
            <ListTree className="h-3.5 w-3.5" />
            {showDetails ? "Hide" : "Details"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Client receipts */}
      <section className="rounded-lg border">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b">
          <div>
            <p className="text-xs font-semibold">Client receipts</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Matches CRM Orders · {orderPayments.allTime.orderCount} orders · excl. Branch POS
            </p>
          </div>
          <Link href="/crm?tab=orders" className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center gap-1">
            CRM <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {periodLabel} — received
              </p>
              <p className="text-2xl font-semibold tabular-nums mt-0.5">{fmt(displayTotal, 2)}</p>
              {(enabled.loans || includeOutstanding) && (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 tabular-nums">
                  Client {fmt(periodReceived, 2)}
                  {enabled.loans && loansInPeriod > 0 ? ` + loans ${fmt(loansInPeriod, 2)}` : ""}
                  {includeOutstanding ? ` + outstanding ${fmt(outstanding, 2)}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ToggleChip
                on={includeOutstanding}
                label="+ Still outstanding"
                amount={outstanding}
                onClick={() => setIncludeOutstanding(v => !v)}
              />
              <ToggleChip
                on={enabled.loans}
                label="+ Loans"
                amount={loansInPeriod}
                onClick={() => toggle("loans")}
              />
              <Link
                href="/finance?tab=manage&section=finance&add=loan"
                className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <Plus className="h-3 w-3" /> Add loan
              </Link>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-px rounded-lg border overflow-hidden bg-[hsl(var(--border))]">
            <div className="bg-[hsl(var(--card))] p-3">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{periodLabel} cash in</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{fmt(periodReceived, 2)}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Payment date in period</p>
            </div>
            <div className="bg-[hsl(var(--card))] p-3">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">All-time received</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{fmt(allTimeReceived, 2)}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">CRM Paid total</p>
            </div>
            <div className="bg-[hsl(var(--card))] p-3">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Still outstanding</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{fmt(outstanding, 2)}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Unpaid on active orders</p>
            </div>
          </div>

          {showDetails && (
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg border p-3 space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
                  All-time breakdown
                </p>
                <Row label="Delivered fully paid" value={fmt(orderPayments.allTime.deliveredFullyPaidReceived, 2)} />
                <Row label="Partial payments" value={fmt(orderPayments.allTime.partialPaymentsReceived, 2)} />
                <Row label="Credit installments" value={fmt(orderPayments.allTime.creditPaymentsReceived, 2)} />
                <Row label="Other" value={fmt(orderPayments.allTime.otherPaymentsReceived, 2)} />
              </div>
              <div className="rounded-lg border p-3 space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
                  {periodLabel} by payment date
                </p>
                <Row label="Delivered fully paid" value={fmt(orderPayments.inPeriod.deliveredFullyPaidInPeriod, 2)} />
                <Row label="Partial / credit" value={fmt(orderPayments.inPeriod.partialPaymentsInPeriod, 2)} />
                <Row label="Other" value={fmt(orderPayments.inPeriod.otherPaymentsInPeriod, 2)} />
                {orderPayments.inPeriod.pendingApprovalInPeriod > 0.004 && (
                  <Row label="Pending approval" value={fmt(orderPayments.inPeriod.pendingApprovalInPeriod, 2)} />
                )}
                {enabled.loans && loansInPeriod > 0 && (
                  <Row label="Loans received" value={fmt(loansInPeriod, 2)} />
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Cash snapshot */}
      <section className="rounded-lg border">
        <div className="px-4 py-2.5 border-b">
          <p className="text-xs font-semibold">{periodLabel} — cash snapshot</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Toggle sources below · client payments matches period received above
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Money in</p>
              <p className="text-xl font-semibold tabular-nums mt-1">{fmt(moneyInAll)}</p>
              {moneyIn !== moneyInAll && (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 tabular-nums">
                  In net: {fmt(moneyIn)}
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Money out</p>
              <p className="text-xl font-semibold tabular-nums mt-1">{fmt(moneyOutAll)}</p>
              {moneyOut !== moneyOutAll && (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 tabular-nums">
                  In net: {fmt(moneyOut)}
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Net</p>
              <p className="text-xl font-semibold tabular-nums mt-1">{fmt(net)}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Money in − money out (toggles)</p>
            </div>
          </div>

          {/* Money in breakdown */}
          <div className="rounded-lg border p-3 space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
              Money in — breakdown
            </p>
            {inLines.map(l => (
              <Row key={l.key} label={l.label} value={fmt(l.amount)} />
            ))}
            <div className="flex items-baseline justify-between gap-3 text-xs pt-1.5 border-t font-medium">
              <span>Total</span>
              <span className="tabular-nums">{fmt(moneyInAll)}</span>
            </div>
          </div>

          {/* Money out breakdown */}
          <div className="rounded-lg border p-3 space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
              Money out — breakdown
            </p>
            <Row label="Expenses (finance records)" value={fmt(breakdown.moneyOut.expenses)} />
            <Row label="Salaries" value={fmt(breakdown.moneyOut.salaries)} />
            <Row label="Local PO payments" value={fmt(breakdown.moneyOut.localPurchases)} />
            <Row label="Purchase ledger" value={fmt(breakdown.moneyOut.purchaseLedger)} />
            <Row label="Imported PO payments" value={fmt(breakdown.moneyOut.importedPurchases)} />
            <Row label="Import shipments" value={fmt(breakdown.moneyOut.importShipments)} />
            <Row label="Petty cash" value={fmt(breakdown.moneyOut.pettyCash)} />
            <Row label="Supplier advances" value={fmt(breakdown.moneyOut.supplierAdvances ?? 0)} />
            <Row label="Salary advances" value={fmt(breakdown.moneyOut.salaryAdvances ?? 0)} />
            <Row label="Cashback" value={fmt(breakdown.moneyOut.cashback)} />
            <div className="flex items-baseline justify-between gap-3 text-xs pt-1.5 border-t font-medium">
              <span>Total money out</span>
              <span className="tabular-nums">{fmt(moneyOutAll)}</span>
            </div>
          </div>

          {enabled.loans && loansInPeriod > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">Loans included in money in</span>
              <span className="tabular-nums font-medium">{fmt(loansInPeriod, 2)}</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium">
                Include in net calculation
              </p>
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setEnabled(defaultEnabled())} className="text-[10px] px-2 py-0.5 rounded border text-[hsl(var(--muted-foreground))]">Reset</button>
                <button type="button" onClick={() => setSide("in", true)} className="text-[10px] px-2 py-0.5 rounded border text-[hsl(var(--muted-foreground))]">All in</button>
                <button type="button" onClick={() => setSide("out", true)} className="text-[10px] px-2 py-0.5 rounded border text-[hsl(var(--muted-foreground))]">All out</button>
              </div>
            </div>

            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Money in</p>
            <div className="flex flex-wrap gap-1.5">
              {inLines.map(l => (
                <ToggleChip
                  key={l.key}
                  on={l.on}
                  label={l.label}
                  amount={l.amount}
                  onClick={() => toggle(l.key)}
                />
              ))}
            </div>

            <p className="text-[10px] text-[hsl(var(--muted-foreground))] pt-1">Money out</p>
            <div className="flex flex-wrap gap-1.5">
              {outLines.map(l => (
                <ToggleChip
                  key={l.key}
                  on={l.on}
                  label={l.label}
                  amount={l.amount}
                  onClick={() => toggle(l.key)}
                />
              ))}
            </div>
          </div>

          {showDetails && (
            <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t">
              <div className="pt-3 space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Money in detail</p>
                {inLines.map(l => (
                  <div key={l.key} className={`flex justify-between gap-2 text-xs ${l.on ? "" : "opacity-40 line-through"}`}>
                    <span className="text-[hsl(var(--muted-foreground))]">{l.label}</span>
                    <span className="tabular-nums font-medium">{fmt(l.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 text-xs pt-1.5 border-t font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(moneyIn)}</span>
                </div>
              </div>
              <div className="pt-3 space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Money out detail</p>
                {outLines.map(l => (
                  <div key={l.key} className={`flex justify-between gap-2 text-xs ${l.on ? "" : "opacity-40 line-through"}`}>
                    <span className="text-[hsl(var(--muted-foreground))]">{l.label}</span>
                    <span className="tabular-nums font-medium">{fmt(l.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 text-xs pt-1.5 border-t font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(moneyOut)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Link href="/finance?tab=reports" className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center gap-1">
              Full reports <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
