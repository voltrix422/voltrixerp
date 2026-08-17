"use client"

import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, RefreshCw, Plus, ChevronDown } from "lucide-react"
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
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors ${
        on
          ? "border-[hsl(var(--foreground))]/40 bg-[hsl(var(--muted))]/30"
          : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] opacity-60"
      }`}
    >
      <span className={`h-1 w-1 rounded-full ${on ? "bg-[hsl(var(--foreground))]" : "bg-[hsl(var(--muted-foreground))]"}`} />
      {label}
      {amount != null && amount > 0.004 && (
        <span className="tabular-nums opacity-70">{fmt(amount, 0)}</span>
      )}
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px] py-0.5">
      <span className="text-[hsl(var(--muted-foreground))] truncate">{label}</span>
      <span className="tabular-nums font-medium shrink-0">{value}</span>
    </div>
  )
}

function Accordion({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  summary?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[hsl(var(--muted))]/20 transition-colors"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="text-[11px] font-medium truncate">{title}</span>
        </span>
        {summary && !open && (
          <span className="text-[10px] tabular-nums text-[hsl(var(--muted-foreground))] shrink-0">{summary}</span>
        )}
      </button>
      {open && <div className="px-3 pb-2.5 pt-0 border-t">{children}</div>}
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
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [inBreakdownOpen, setInBreakdownOpen] = useState(false)
  const [outBreakdownOpen, setOutBreakdownOpen] = useState(false)
  const [togglesOpen, setTogglesOpen] = useState(false)

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
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border p-4 text-center space-y-2">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{error}</p>
        <Button size="sm" variant="outline" onClick={load}>Retry</Button>
      </div>
    )
  }

  if (!summary || !orderPayments) return null

  const periodReceived = orderPayments.inPeriod.approvedInPeriod
  const outstanding = orderPayments.allTime.totalOutstanding
  const loansInPeriod = breakdown.moneyIn.loans

  const displayTotal =
    periodReceived +
    (enabled.loans ? loansInPeriod : 0) +
    (includeOutstanding ? outstanding : 0)

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-md border p-0.5">
          {PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                period === p.id
                  ? "bg-[hsl(var(--muted))]/50 text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[11px]" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </Button>
      </div>

      {/* Client receipts — always visible */}
      <section className="rounded-lg border">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
          <div>
            <p className="text-xs font-semibold">Client receipts</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              CRM · {orderPayments.allTime.orderCount} orders · excl. Branch POS
            </p>
          </div>
          <Link
            href="/crm?tab=orders"
            className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center gap-0.5"
          >
            CRM <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{periodLabel} — received</p>
              <p className="text-xl font-semibold tabular-nums leading-tight">{fmt(displayTotal, 2)}</p>
              {(enabled.loans && loansInPeriod > 0) || includeOutstanding ? (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums">
                  Client {fmt(periodReceived, 2)}
                  {enabled.loans && loansInPeriod > 0 ? ` + loans ${fmt(loansInPeriod, 2)}` : ""}
                  {includeOutstanding ? ` + owed ${fmt(outstanding, 2)}` : ""}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1">
              <ToggleChip
                on={includeOutstanding}
                label="+ Outstanding"
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
                className="inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]"
              >
                <Plus className="h-3 w-3" /> Loan
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-px rounded-md border overflow-hidden bg-[hsl(var(--border))] text-center sm:text-left">
            <div className="bg-[hsl(var(--card))] px-2 py-1.5">
              <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{periodLabel} cash in</p>
              <p className="text-xs font-semibold tabular-nums">{fmt(periodReceived, 2)}</p>
            </div>
            <div className="bg-[hsl(var(--card))] px-2 py-1.5">
              <p className="text-[9px] text-[hsl(var(--muted-foreground))]">All-time received</p>
              <p className="text-xs font-semibold tabular-nums">{fmt(orderPayments.allTime.totalReceived, 2)}</p>
            </div>
            <div className="bg-[hsl(var(--card))] px-2 py-1.5">
              <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Still outstanding</p>
              <p className="text-xs font-semibold tabular-nums">{fmt(outstanding, 2)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cash snapshot — collapsed by default */}
      <section className="rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => setSnapshotOpen(v => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[hsl(var(--muted))]/15 transition-colors"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${snapshotOpen ? "" : "-rotate-90"}`}
            />
            <span>
              <span className="text-xs font-semibold block">{periodLabel} — cash snapshot</span>
              {!snapshotOpen && (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  In {fmt(moneyInAll)} · Out {fmt(moneyOutAll)} · Net {fmt(net)}
                </span>
              )}
            </span>
          </span>
          {!snapshotOpen && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">Open</span>
          )}
        </button>

        {snapshotOpen && (
          <div className="border-t px-3 pb-3 pt-2 space-y-2">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border px-2 py-1.5">
                <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Money in</p>
                <p className="text-sm font-semibold tabular-nums">{fmt(moneyInAll)}</p>
                {moneyIn !== moneyInAll && (
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))] tabular-nums">Net: {fmt(moneyIn)}</p>
                )}
              </div>
              <div className="rounded-md border px-2 py-1.5">
                <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Money out</p>
                <p className="text-sm font-semibold tabular-nums">{fmt(moneyOutAll)}</p>
                {moneyOut !== moneyOutAll && (
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))] tabular-nums">Net: {fmt(moneyOut)}</p>
                )}
              </div>
              <div className="rounded-md border px-2 py-1.5">
                <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Net</p>
                <p className="text-sm font-semibold tabular-nums">{fmt(net)}</p>
              </div>
            </div>

            <Accordion
              title="Money in — breakdown"
              summary={fmt(moneyInAll)}
              open={inBreakdownOpen}
              onToggle={() => setInBreakdownOpen(v => !v)}
            >
              <div className="pt-1.5 space-y-0">
                {inLines.map(l => (
                  <Row key={l.key} label={l.label} value={fmt(l.amount)} />
                ))}
                <div className="flex justify-between gap-2 text-[11px] font-medium pt-1 border-t mt-1">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(moneyInAll)}</span>
                </div>
              </div>
            </Accordion>

            <Accordion
              title="Money out — breakdown"
              summary={fmt(moneyOutAll)}
              open={outBreakdownOpen}
              onToggle={() => setOutBreakdownOpen(v => !v)}
            >
              <div className="pt-1.5 space-y-0">
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
                <div className="flex justify-between gap-2 text-[11px] font-medium pt-1 border-t mt-1">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(moneyOutAll)}</span>
                </div>
              </div>
            </Accordion>

            <Accordion
              title="Include in net calculation"
              summary={`Net ${fmt(net)}`}
              open={togglesOpen}
              onToggle={() => setTogglesOpen(v => !v)}
            >
              <div className="pt-1.5 space-y-2">
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => setEnabled(defaultEnabled())} className="text-[9px] px-1.5 py-0.5 rounded border">Reset</button>
                  <button type="button" onClick={() => setSide("in", true)} className="text-[9px] px-1.5 py-0.5 rounded border">All in</button>
                  <button type="button" onClick={() => setSide("out", true)} className="text-[9px] px-1.5 py-0.5 rounded border">All out</button>
                </div>
                <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Money in</p>
                <div className="flex flex-wrap gap-1">
                  {inLines.map(l => (
                    <ToggleChip key={l.key} on={l.on} label={l.label} amount={l.amount} onClick={() => toggle(l.key)} />
                  ))}
                </div>
                <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Money out</p>
                <div className="flex flex-wrap gap-1">
                  {outLines.map(l => (
                    <ToggleChip key={l.key} on={l.on} label={l.label} amount={l.amount} onClick={() => toggle(l.key)} />
                  ))}
                </div>
              </div>
            </Accordion>

            <div className="flex justify-end pt-0.5">
              <Link
                href="/finance?tab=reports"
                className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center gap-0.5"
              >
                Full reports <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
