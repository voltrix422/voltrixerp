"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { ArrowRight, Loader2, RefreshCw, Plus, ChevronDown, X, HandCoins } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OrderPaymentAggregate, OrderPaymentPeriodBreakdown } from "@/lib/order-payment-stats"
import {
  type MoneyOutDetailLine,
  type MoneyOutDetailsPayload,
} from "@/lib/finance-money-out-details"
import type { LoanSnapshot } from "@/lib/finance-loans"

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
    loansReceived?: number
    loanRecoveries?: number
  }
  moneyOut: {
    expenses: number
    loansGiven?: number
    salaries: number
    localPurchases: number
    purchaseLedger: number
    purchaseLedgerPurchases?: number
    purchaseLedgerRents?: number
    importedPurchases: number
    importShipments: number
    importPsw?: number
    importCharges?: number
    importChargesCombined?: number
    pettyCash: number
    advances: number
    supplierAdvances?: number
    salaryAdvances?: number
    cashback: number
    clientRefunds?: number
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
  | "loansGiven"
  | "expenses"
  | "salaries"
  | "purchaseLedger"
  | "pettyCash"
  | "importCharges"
  | "cashback"
  | "clientRefunds"

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
  { key: "loansGiven", label: "Loans given", side: "out", defaultOn: true },
  { key: "salaries", label: "Salaries (payroll)", side: "out", defaultOn: true },
  { key: "purchaseLedger", label: "Purchase ledger (purchases + rents)", side: "out", defaultOn: true },
  { key: "pettyCash", label: "Petty cash", side: "out", defaultOn: true },
  { key: "importCharges", label: "Imported purchases (PSW + charges)", side: "out", defaultOn: true },
  { key: "cashback", label: "Cashback", side: "out", defaultOn: true },
  { key: "clientRefunds", label: "Client refunds", side: "out", defaultOn: true },
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
    moneyIn: { clientPayments: 0, posSales: 0, incomeRecords: 0, loans: 0, loansReceived: 0, loanRecoveries: 0 },
    moneyOut: {
      expenses: 0,
      loansGiven: 0,
      salaries: 0,
      localPurchases: 0,
      purchaseLedger: 0,
      purchaseLedgerPurchases: 0,
      purchaseLedgerRents: 0,
      importedPurchases: 0,
      importShipments: 0,
      importPsw: 0,
      importCharges: 0,
      importChargesCombined: 0,
      pettyCash: 0,
      advances: 0,
      cashback: 0,
      clientRefunds: 0,
    },
  }
}

function amountFor(b: Breakdown, key: ToggleKey): number {
  if (key === "loans") return b.moneyIn.loans
  if (key in b.moneyIn) return (b.moneyIn[key as keyof Breakdown["moneyIn"]] as number) || 0
  if (key === "purchaseLedger") return b.moneyOut.purchaseLedger
  if (key === "importCharges") return b.moneyOut.importChargesCombined ?? 0
  if (key === "loansGiven") return b.moneyOut.loansGiven ?? 0
  return (b.moneyOut[key as keyof Breakdown["moneyOut"]] as number) || 0
}

function buildMoneyOutDisplayRows(
  b: Breakdown["moneyOut"],
  details?: MoneyOutDetailsPayload | null,
) {
  const rows: { label: string; amount: number; details?: MoneyOutDetailLine[] }[] = []
  if (b.expenses > 0.004) rows.push({ label: "Expenses", amount: b.expenses })
  const loansGiven = b.loansGiven ?? 0
  if (loansGiven > 0.004) {
    rows.push({
      label: "Loans given",
      amount: loansGiven,
      details: details?.loansGiven,
    })
  }
  if (b.salaries > 0.004) rows.push({ label: "Salaries", amount: b.salaries })

  const ledgerPurchases = b.purchaseLedgerPurchases ?? b.purchaseLedger
  const ledgerRents = b.purchaseLedgerRents ?? 0
  if (ledgerPurchases > 0.004) {
    rows.push({ label: "Purchases (ledger)", amount: ledgerPurchases })
  }
  if (ledgerRents > 0.004) {
    rows.push({ label: "Rents (ledger)", amount: ledgerRents })
  }
  if (b.pettyCash > 0.004) rows.push({ label: "Petty cash", amount: b.pettyCash })

  const importPsw = b.importPsw ?? 0
  const importCharges = b.importCharges ?? 0
  if (importPsw > 0.004) {
    rows.push({
      label: "Import · PSW duties",
      amount: importPsw,
      details: details?.importPsw,
    })
  }
  if (importCharges > 0.004) {
    rows.push({
      label: "Import · charges",
      amount: importCharges,
      details: details?.importCharges,
    })
  }

  const clientRefunds = b.clientRefunds ?? 0
  if (clientRefunds > 0.004) {
    rows.push({
      label: "Client refunds",
      amount: clientRefunds,
      details: details?.clientRefunds,
    })
  }
  if (b.cashback > 0.004) {
    rows.push({
      label: "Cashback",
      amount: b.cashback,
      details: details?.cashback,
    })
  }
  return rows
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

function BreakdownTable({
  rows,
  total,
  onOpenDetails,
}: {
  rows: { label: string; value: string; details?: MoneyOutDetailLine[] }[]
  total: string
  onOpenDetails?: (row: { label: string; value: string; details: MoneyOutDetailLine[] }) => void
}) {
  return (
    <div className="w-full rounded-md border overflow-visible">
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {rows.map((row, i) => {
            const hasDetails = (row.details?.length ?? 0) > 0
            return (
              <tr key={row.label} className={`group ${i > 0 ? "border-t" : ""}`}>
                <td className="relative pl-2.5 pr-2 py-1.5 align-middle">
                  {hasDetails ? (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDetails?.({
                          label: row.label,
                          value: row.value,
                          details: row.details || [],
                        })
                      }
                      className="text-left text-[hsl(var(--muted-foreground))] cursor-pointer underline decoration-dotted decoration-[hsl(var(--muted-foreground))]/50 underline-offset-2 hover:text-[hsl(var(--foreground))]"
                      title="Hover for preview · click for full detail"
                    >
                      {row.label}
                    </button>
                  ) : (
                    <span className="text-[hsl(var(--muted-foreground))]">{row.label}</span>
                  )}
                  {hasDetails && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden min-w-[15rem] max-w-[22rem] group-hover:block rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg p-2 text-[10px]"
                    >
                      <p className="text-[9px] text-[hsl(var(--muted-foreground))] mb-1.5">
                        Preview · click for full report
                      </p>
                      <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                        {row.details!.slice(0, 6).map(d => (
                          <li key={d.id} className="flex justify-between gap-3 leading-snug">
                            <span className="min-w-0">
                              <span className="font-medium text-[hsl(var(--foreground))]">{d.label}</span>
                              {d.sublabel ? (
                                <span className="text-[hsl(var(--muted-foreground))]"> · {d.sublabel}</span>
                              ) : null}
                              {d.items && d.items.length > 0 ? (
                                <span className="block text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5">
                                  {d.items.length} charge{d.items.length === 1 ? "" : "s"}
                                </span>
                              ) : null}
                            </span>
                            <span className="tabular-nums font-medium shrink-0">{fmt(d.amount)}</span>
                          </li>
                        ))}
                        {row.details!.length > 6 && (
                          <li className="text-[9px] text-[hsl(var(--muted-foreground))]">
                            +{row.details!.length - 6} more — click to open
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </td>
                <td className="pl-2 pr-2.5 py-1.5 tabular-nums font-semibold text-right align-middle whitespace-nowrap">
                  {row.value}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-[hsl(var(--muted))]/20">
            <td className="pl-2.5 pr-2 py-1.5 font-semibold align-middle">Total</td>
            <td className="pl-2 pr-2.5 py-1.5 tabular-nums font-bold text-right align-middle whitespace-nowrap">
              {total}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function MoneyOutDetailsModal({
  title,
  totalLabel,
  details,
  onClose,
}: {
  title: string
  totalLabel: string
  details: MoneyOutDetailLine[]
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const total = details.reduce((s, d) => s + (Number(d.amount) || 0), 0)
  if (!mounted) return null

  function toggleRow(id: string) {
    setOpenIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-5">
      <button type="button" className="absolute inset-0 bg-black/40 cursor-pointer" aria-label="Close" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-xl">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b shrink-0">
          <div className="min-w-0">
            <p className="text-base font-semibold truncate">{title}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {details.length} shipment{details.length === 1 ? "" : "s"} · {totalLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))]/40 cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 sm:px-5 py-3 space-y-2.5">
          {details.map(d => {
            const open = !!openIds[d.id]
            const hasItems = (d.items?.length ?? 0) > 0
            return (
              <div key={d.id} className="rounded-lg border overflow-hidden">
                <div className="flex items-stretch gap-0 bg-[hsl(var(--muted))]/15">
                  <button
                    type="button"
                    onClick={() => hasItems && toggleRow(d.id)}
                    className={`flex-1 min-w-0 px-3 sm:px-3.5 py-3 flex items-start justify-between gap-3 text-left ${
                      hasItems ? "cursor-pointer hover:bg-[hsl(var(--muted))]/25" : "cursor-default"
                    }`}
                  >
                    <div className="min-w-0 flex items-start gap-2">
                      {hasItems ? (
                        <ChevronDown
                          className={`h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${
                            open ? "" : "-rotate-90"
                          }`}
                        />
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{d.label}</p>
                        {d.sublabel ? (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-snug">{d.sublabel}</p>
                        ) : null}
                        {d.date ? (
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{d.date}</p>
                        ) : null}
                        {hasItems && !open ? (
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                            {d.items!.length} line{d.items!.length === 1 ? "" : "s"} · click to expand
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0 pt-0.5">{fmt(d.amount)}</p>
                  </button>
                  {d.href ? (
                    <Link
                      href={d.href}
                      onClick={onClose}
                      className="shrink-0 border-l px-3 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/30 cursor-pointer"
                      title="Open imported purchase"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Detail
                    </Link>
                  ) : null}
                </div>
                {open && hasItems && (
                  <ul className="divide-y border-t">
                    {d.items!.map((item, idx) => (
                      <li
                        key={`${d.id}-item-${idx}`}
                        className="px-3 sm:px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-[hsl(var(--muted-foreground))] min-w-0 pl-6">{item.label}</span>
                        <span className="tabular-nums font-medium shrink-0">{fmt(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
        <div className="border-t px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 bg-[hsl(var(--muted))]/10">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-base font-bold tabular-nums">{fmt(total)}</span>
        </div>
      </div>
    </div>,
    document.body,
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
  const [moneyOutDetails, setMoneyOutDetails] = useState<MoneyOutDetailsPayload | null>(null)
  const [loans, setLoans] = useState<LoanSnapshot | null>(null)
  const [togglesOpen, setTogglesOpen] = useState(false)
  const [detailsModal, setDetailsModal] = useState<{
    label: string
    value: string
    details: MoneyOutDetailLine[]
  } | null>(null)

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
      setMoneyOutDetails(data.moneyOutDetails ?? null)
      setLoans(data.summary?.loans ?? null)
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

  const moneyOutDisplayRows = useMemo(
    () => buildMoneyOutDisplayRows(breakdown.moneyOut, moneyOutDetails),
    [breakdown.moneyOut, moneyOutDetails],
  )
  const moneyInDisplayRows = useMemo(() => {
    const rows: { label: string; amount: number }[] = []
    const mi = breakdown.moneyIn
    if (mi.clientPayments > 0.004) rows.push({ label: "Client payments", amount: mi.clientPayments })
    if (mi.posSales > 0.004) rows.push({ label: "POS sales", amount: mi.posSales })
    if (mi.incomeRecords > 0.004) rows.push({ label: "Income records", amount: mi.incomeRecords })
    const received = mi.loansReceived ?? (mi.loans - (mi.loanRecoveries ?? 0))
    const recovered = mi.loanRecoveries ?? 0
    if (received > 0.004) rows.push({ label: "Loans received", amount: received })
    if (recovered > 0.004) rows.push({ label: "Returned to us", amount: recovered })
    return rows
  }, [breakdown.moneyIn])

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
  const returnedOrderCount = orderPayments.allTime.returnedCount
  const activeOrderCount = orderPayments.allTime.orderCount
  const displayTotal = periodReceived + (includeOutstanding ? outstanding : 0)
  const loanSnap: LoanSnapshot = loans ?? {
    receivedInPeriod: breakdown.moneyIn.loansReceived ?? breakdown.moneyIn.loans,
    recoveredInPeriod: breakdown.moneyIn.loanRecoveries ?? 0,
    givenInPeriod: breakdown.moneyOut.loansGiven ?? 0,
    repaidInPeriod: 0,
    moneyIn: breakdown.moneyIn.loans,
    moneyOut: breakdown.moneyOut.loansGiven ?? 0,
    weOwe: 0,
    theyOwe: 0,
    peopleCount: 0,
  }

  return (
    <div className="space-y-3 max-w-5xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-md border p-0.5 bg-[hsl(var(--muted))]/15">
          {PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                period === p.id
                  ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/finance?tab=reports"
            className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center gap-0.5"
          >
            Reports <ArrowRight className="h-3 w-3" />
          </Link>
          <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[11px]" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Hero: In / Out / Net — always visible */}
      <section className="grid grid-cols-3 gap-px rounded-lg border overflow-hidden bg-[hsl(var(--border))]">
        <div className="bg-[hsl(var(--card))] px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-medium">Money in</p>
          <p className="text-base sm:text-lg font-bold tabular-nums leading-tight mt-0.5 text-emerald-800 dark:text-emerald-300">
            {fmt(moneyInAll)}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{periodLabel}</p>
        </div>
        <div className="bg-[hsl(var(--card))] px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] uppercase tracking-wide text-rose-700 dark:text-rose-400 font-medium">Money out</p>
          <p className="text-base sm:text-lg font-bold tabular-nums leading-tight mt-0.5 text-rose-800 dark:text-rose-300">
            {fmt(moneyOutAll)}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">Cash leaving</p>
        </div>
        <div className="bg-[hsl(var(--card))] px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-medium">Net</p>
          <p
            className={`text-base sm:text-lg font-bold tabular-nums leading-tight mt-0.5 ${
              net >= 0
                ? "text-emerald-800 dark:text-emerald-300"
                : "text-rose-800 dark:text-rose-300"
            }`}
          >
            {fmt(net)}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
            {net >= 0 ? "Surplus" : "Deficit"}
          </p>
        </div>
      </section>

      {/* Main grid: receipts + breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {/* Client receipts */}
        <section className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-[hsl(var(--muted))]/15">
            <div className="min-w-0">
              <p className="text-xs font-semibold">Client receipts</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                CRM · {activeOrderCount} active
                {returnedOrderCount > 0 ? ` · +${returnedOrderCount} returned` : ""}
              </p>
            </div>
            <Link
              href="/crm?tab=orders"
              className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center gap-0.5 shrink-0"
            >
              CRM <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-3 space-y-2.5">
            <div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{periodLabel} received</p>
              <p className="text-xl font-bold tabular-nums leading-none mt-1">{fmt(displayTotal, 0)}</p>
              {includeOutstanding ? (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums mt-1">
                  Base {fmt(periodReceived, 0)} + outstanding
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
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-md border px-2 py-1.5">
                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Period</p>
                <p className="text-[11px] font-semibold tabular-nums mt-0.5">{fmt(periodReceived, 0)}</p>
              </div>
              <div className="rounded-md border px-2 py-1.5">
                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">All-time</p>
                <p className="text-[11px] font-semibold tabular-nums mt-0.5">{fmt(orderPayments.allTime.totalReceived, 0)}</p>
              </div>
              <div className="rounded-md border px-2 py-1.5">
                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Outstanding</p>
                <p className="text-[11px] font-semibold tabular-nums mt-0.5 text-amber-700 dark:text-amber-400">
                  {fmt(outstanding, 0)}
                </p>
              </div>
            </div>
            {moneyInDisplayRows.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] mb-1">Money in breakdown</p>
                <BreakdownTable
                  rows={moneyInDisplayRows.map(r => ({ label: r.label, value: fmt(r.amount) }))}
                  total={fmt(moneyInAll)}
                />
              </div>
            )}
          </div>
        </section>

        {/* Loans */}
        <section className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-[hsl(var(--muted))]/15">
            <div className="min-w-0 flex items-center gap-2">
              <HandCoins className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold">Loans</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                  {loanSnap.peopleCount} {loanSnap.peopleCount === 1 ? "person" : "people"} · give, receive & return
                </p>
              </div>
            </div>
            <Link
              href="/finance?tab=manage&section=finance"
              className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center gap-0.5 shrink-0"
            >
              Records <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-emerald-200/70 dark:border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-medium">
                  {periodLabel} in
                </p>
                <p className="text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-300 mt-0.5">
                  {fmt(loanSnap.moneyIn, 0)}
                </p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums mt-0.5">
                  Received {fmt(loanSnap.receivedInPeriod, 0)}
                  {loanSnap.recoveredInPeriod > 0.004 ? ` · returned to us ${fmt(loanSnap.recoveredInPeriod, 0)}` : ""}
                </p>
              </div>
              <div className="rounded-md border border-rose-200/70 dark:border-rose-500/30 bg-rose-500/5 px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-wide text-rose-700 dark:text-rose-400 font-medium">
                  {periodLabel} out
                </p>
                <p className="text-base font-bold tabular-nums text-rose-800 dark:text-rose-300 mt-0.5">
                  {fmt(loanSnap.moneyOut, 0)}
                </p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums mt-0.5">
                  Given {fmt(loanSnap.givenInPeriod, 0)}
                  {loanSnap.repaidInPeriod > 0.004 ? ` · we returned ${fmt(loanSnap.repaidInPeriod, 0)}` : ""}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md border px-2 py-1.5">
                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">We owe</p>
                <p className="text-[11px] font-semibold tabular-nums mt-0.5 text-rose-700 dark:text-rose-400">
                  {fmt(loanSnap.weOwe, 0)}
                </p>
              </div>
              <div className="rounded-md border px-2 py-1.5">
                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Owed to us</p>
                <p className="text-[11px] font-semibold tabular-nums mt-0.5 text-emerald-700 dark:text-emerald-400">
                  {fmt(loanSnap.theyOwe, 0)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Link
                href="/finance?tab=manage&section=finance&add=loan"
                className="inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <Plus className="h-3 w-3" /> Add loan
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Money out */}
      <section className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-[hsl(var(--muted))]/15">
            <div className="min-w-0">
              <p className="text-xs font-semibold">Money out</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Dotted lines open detail · {periodLabel}
              </p>
            </div>
            <p className="text-xs font-bold tabular-nums text-rose-700 dark:text-rose-400 shrink-0">
              {fmt(moneyOutAll)}
            </p>
          </div>
          <div className="p-3">
            <BreakdownTable
              rows={moneyOutDisplayRows.map(r => ({
                label: r.label,
                value: fmt(r.amount),
                details: r.details,
              }))}
              total={fmt(moneyOutAll)}
              onOpenDetails={setDetailsModal}
            />
          </div>
        </section>

      {/* Net toggles — compact, collapsed */}
      <section className="rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => setTogglesOpen(v => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[hsl(var(--muted))]/15 transition-colors"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${togglesOpen ? "" : "-rotate-90"}`}
            />
            <span className="text-[11px] font-medium">Adjust what counts in net</span>
          </span>
          <span className="text-[10px] tabular-nums text-[hsl(var(--muted-foreground))] shrink-0">
            Net {fmt(net)}
          </span>
        </button>
        {togglesOpen && (
          <div className="px-3 pb-3 pt-1 border-t space-y-2">
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => setEnabled(defaultEnabled())} className="text-[9px] px-1.5 py-0.5 rounded border cursor-pointer">Reset</button>
              <button type="button" onClick={() => setSide("in", true)} className="text-[9px] px-1.5 py-0.5 rounded border cursor-pointer">All in</button>
              <button type="button" onClick={() => setSide("out", true)} className="text-[9px] px-1.5 py-0.5 rounded border cursor-pointer">All out</button>
            </div>
            <div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase mb-1">Money in</p>
              <div className="flex flex-wrap gap-1">
                {inLines.filter(l => l.amount > 0.004).map(l => (
                  <ToggleChip key={l.key} on={l.on} label={l.label} amount={l.amount} onClick={() => toggle(l.key)} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase mb-1">Money out</p>
              <div className="flex flex-wrap gap-1">
                {outLines.filter(l => l.amount > 0.004).map(l => (
                  <ToggleChip key={l.key} on={l.on} label={l.label} amount={l.amount} onClick={() => toggle(l.key)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {detailsModal && (
        <MoneyOutDetailsModal
          title={detailsModal.label}
          totalLabel={detailsModal.value}
          details={detailsModal.details}
          onClose={() => setDetailsModal(null)}
        />
      )}
    </div>
  )
}
