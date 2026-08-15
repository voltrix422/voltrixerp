"use client"

import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight, Loader2, TrendingUp, TrendingDown, RefreshCw, CircleHelp, ListTree,
} from "lucide-react"
import { Button } from "@/components/ui/button"

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
  cashbackInPeriod?: number
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
  { key: "loans", label: "Loans", side: "in", defaultOn: true },
  { key: "expenses", label: "Expenses", side: "out", defaultOn: true },
  { key: "salaries", label: "Salaries", side: "out", defaultOn: true },
  { key: "localPurchases", label: "Local purchases", side: "out", defaultOn: true },
  { key: "importedPurchases", label: "Imported purchases", side: "out", defaultOn: false },
  { key: "importShipments", label: "Import shipments", side: "out", defaultOn: false },
  { key: "pettyCash", label: "Petty cash", side: "out", defaultOn: true },
  { key: "advances", label: "Advances", side: "out", defaultOn: true },
  { key: "cashback", label: "Cashback", side: "out", defaultOn: true },
]

function defaultEnabled(): Record<ToggleKey, boolean> {
  return Object.fromEntries(TOGGLES.map(t => [t.key, t.defaultOn])) as Record<ToggleKey, boolean>
}

function fmt(n: number) {
  return `PKR ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const PERIODS = [
  { id: "month", label: "This month", hint: "From the 1st of this month through today." },
  { id: "last_month", label: "Last month", hint: "The full previous calendar month." },
  { id: "year", label: "This year", hint: "From 1 January this year through today." },
]

function emptyBreakdown(): Breakdown {
  return {
    moneyIn: { clientPayments: 0, posSales: 0, incomeRecords: 0, loans: 0 },
    moneyOut: {
      expenses: 0,
      salaries: 0,
      localPurchases: 0,
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

function Hint({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <span className="relative inline-flex items-center group/hint">
      {children ?? (
        <CircleHelp className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]/70 group-hover/hint:text-[#1faca6] transition-colors" />
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-64 -translate-x-1/2 rounded-lg border bg-[hsl(var(--popover))] px-3 py-2 text-left text-[11px] leading-relaxed text-[hsl(var(--popover-foreground))] shadow-lg opacity-0 translate-y-1 transition-all duration-150 group-hover/hint:opacity-100 group-hover/hint:translate-y-0"
      >
        {text}
      </span>
    </span>
  )
}

function BreakdownTooltip({
  lines,
  emptyLabel,
}: {
  lines: { label: string; amount: number; on: boolean }[]
  emptyLabel: string
}) {
  const shown = lines.filter(l => l.on)
  return (
    <span className="pointer-events-none absolute left-3 right-3 top-full z-30 mt-2 rounded-lg border bg-[hsl(var(--popover))] px-3 py-2.5 text-[11px] leading-relaxed text-[hsl(var(--popover-foreground))] shadow-lg opacity-0 translate-y-1 transition-all duration-150 group-hover/snap:opacity-100 group-hover/snap:translate-y-0">
      {shown.length === 0 ? (
        <p className="text-[hsl(var(--muted-foreground))]">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {shown.map(l => (
            <li key={l.label} className="flex items-center justify-between gap-3">
              <span className="text-[hsl(var(--muted-foreground))]">{l.label}</span>
              <span className="tabular-nums font-medium shrink-0">{fmt(l.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}

export function FinanceHub({ embedded: _embedded }: { embedded?: boolean }) {
  const [period, setPeriod] = useState("month")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [periodLabel, setPeriodLabel] = useState("This month")
  const [summary, setSummary] = useState<Summary | null>(null)
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
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#1faca6]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-500/5 p-6 text-center space-y-3">
        <p className="text-sm text-red-700">{error}</p>
        <Button size="sm" variant="outline" onClick={load}>Retry</Button>
      </div>
    )
  }

  if (!summary) return null

  const snapshot = [
    {
      label: "Money in",
      value: fmt(moneyIn),
      detail: inLines.filter(l => l.on).map(l => l.label).join(" · ") || "Nothing selected",
      icon: TrendingUp,
      tone: "in" as const,
      lines: inLines,
      emptyLabel: "Turn on at least one money-in source below.",
    },
    {
      label: "Money out",
      value: fmt(moneyOut),
      detail: outLines.filter(l => l.on).map(l => l.label).join(" · ") || "Nothing selected",
      icon: TrendingDown,
      tone: "out" as const,
      lines: outLines,
      emptyLabel: "Turn on at least one money-out source below.",
    },
    {
      label: "Net / profit",
      value: fmt(net),
      detail: "Money in − money out (using toggles below). Cash snapshot, not accounting profit.",
      icon: net >= 0 ? TrendingUp : TrendingDown,
      tone: net >= 0 ? ("net-pos" as const) : ("net-neg" as const),
      lines: [
        { label: "Money in (selected)", amount: moneyIn, on: true },
        { label: "Money out (selected)", amount: moneyOut, on: true },
        { label: "Net", amount: net, on: true },
      ],
      emptyLabel: "",
    },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex w-full sm:w-auto rounded-xl border bg-[hsl(var(--muted))]/20 p-0.5">
          {PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              onClick={() => setPeriod(p.id)}
              className={`group/period relative flex-1 sm:flex-none px-2.5 sm:px-3 py-2 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-colors cursor-pointer text-center ${
                period === p.id
                  ? "bg-[#1faca6] text-white shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {p.label}
              <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-52 -translate-x-1/2 rounded-lg border bg-[hsl(var(--popover))] px-3 py-2 text-left text-[11px] leading-relaxed text-[hsl(var(--popover-foreground))] shadow-lg opacity-0 translate-y-1 transition-all duration-150 group-hover/period:opacity-100 group-hover/period:translate-y-0">
                {p.hint}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-none h-9 sm:h-8 gap-1.5"
            onClick={() => setShowDetails(v => !v)}
            title="Show every bucket with amounts"
          >
            <ListTree className="h-3.5 w-3.5" />
            {showDetails ? "Hide details" : "Details"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-none h-9 sm:h-8 gap-1.5"
            onClick={load}
            disabled={loading}
            title="Reload live numbers from the database."
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-gradient-to-br from-[#1faca6]/12 via-[hsl(var(--card))] to-transparent p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <p className="text-[11px] sm:text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            {periodLabel} — cash snapshot
          </p>
          <Hint text="Totals follow the include toggles below. Imported purchases and import shipments are off by default. Hover each card for a line-by-line split. Add loans as finance records with category Loan." />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {snapshot.map(s => {
            const Icon = s.icon
            const valueClass =
              s.tone === "in"
                ? "text-emerald-700"
                : s.tone === "out"
                  ? "text-red-700"
                  : s.tone === "net-pos"
                    ? "text-[#1faca6]"
                    : "text-red-700"
            const iconClass =
              s.tone === "in" || s.tone === "net-pos"
                ? "text-emerald-600"
                : "text-red-600"
            return (
              <div
                key={s.label}
                className="group/snap relative rounded-xl border bg-[hsl(var(--background))]/70 p-3.5 transition-all hover:border-[#1faca6]/40 hover:shadow-md hover:-translate-y-0.5"
              >
                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
                  {s.label}
                </p>
                <p className={`text-xl sm:text-2xl font-bold tabular-nums break-words leading-snug mt-1.5 ${valueClass}`}>
                  {s.value}
                </p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed line-clamp-2">
                  {s.detail}
                </p>
                {s.label === "Net / profit" && (
                  <Link
                    href="/finance?tab=reports"
                    className="text-[10px] text-[#1faca6] hover:underline mt-2 inline-flex items-center gap-1"
                  >
                    View full reports <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                <BreakdownTooltip lines={s.lines} emptyLabel={s.emptyLabel} />
              </div>
            )
          })}
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">
              Include in totals
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setEnabled(defaultEnabled())}
                className="text-[10px] px-2 py-1 rounded-md border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={() => setSide("in", true)}
                className="text-[10px] px-2 py-1 rounded-md border text-emerald-700 hover:bg-emerald-500/10"
              >
                All in
              </button>
              <button
                type="button"
                onClick={() => setSide("out", true)}
                className="text-[10px] px-2 py-1 rounded-md border text-red-700 hover:bg-red-500/10"
              >
                All out
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-emerald-700/80 font-medium">Money in</p>
            <div className="flex flex-wrap gap-1.5">
              {TOGGLES.filter(t => t.side === "in").map(t => {
                const on = enabled[t.key]
                const amt = amountFor(breakdown, t.key)
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggle(t.key)}
                    title={`${t.label}: ${fmt(amt)}. Click to ${on ? "exclude" : "include"}.`}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
                      on
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800"
                        : "bg-[hsl(var(--muted))]/20 text-[hsl(var(--muted-foreground))] opacity-70"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-600" : "bg-[hsl(var(--muted-foreground))]"}`} />
                    {t.label}
                    <span className="tabular-nums text-[10px] opacity-80">{fmt(amt)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-red-700/80 font-medium">Money out</p>
            <div className="flex flex-wrap gap-1.5">
              {TOGGLES.filter(t => t.side === "out").map(t => {
                const on = enabled[t.key]
                const amt = amountFor(breakdown, t.key)
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggle(t.key)}
                    title={`${t.label}: ${fmt(amt)}. Click to ${on ? "exclude" : "include"}.`}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
                      on
                        ? "bg-red-500/10 border-red-500/35 text-red-800"
                        : "bg-[hsl(var(--muted))]/20 text-[hsl(var(--muted-foreground))] opacity-70"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-red-600" : "bg-[hsl(var(--muted-foreground))]"}`} />
                    {t.label}
                    <span className="tabular-nums text-[10px] opacity-80">{fmt(amt)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {showDetails && (
          <div className="rounded-xl border bg-[hsl(var(--background))]/80 p-3.5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mb-2">
                  Money in detail
                </p>
                <ul className="space-y-1.5">
                  {inLines.map(l => (
                    <li
                      key={l.key}
                      className={`flex items-center justify-between gap-2 text-xs ${l.on ? "" : "opacity-45 line-through"}`}
                    >
                      <span className="text-[hsl(var(--muted-foreground))]">{l.label}</span>
                      <span className="tabular-nums font-medium text-emerald-800">{fmt(l.amount)}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t font-semibold">
                    <span>Total in</span>
                    <span className="tabular-nums text-emerald-800">{fmt(moneyIn)}</span>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-red-700 font-semibold mb-2">
                  Money out detail
                </p>
                <ul className="space-y-1.5">
                  {outLines.map(l => (
                    <li
                      key={l.key}
                      className={`flex items-center justify-between gap-2 text-xs ${l.on ? "" : "opacity-45 line-through"}`}
                    >
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {l.label}
                        {l.key === "advances" && breakdown.moneyOut.supplierAdvances != null && (
                          <span className="block text-[10px] font-normal">
                            Supplier {fmt(breakdown.moneyOut.supplierAdvances || 0)} · Salary{" "}
                            {fmt(breakdown.moneyOut.salaryAdvances || 0)}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums font-medium text-red-800 shrink-0">{fmt(l.amount)}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t font-semibold">
                    <span>Total out</span>
                    <span className="tabular-nums text-red-800">{fmt(moneyOut)}</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-[hsl(var(--muted))]/20 px-3 py-2.5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Net / profit (selected)
                </p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  In − out for {periodLabel.toLowerCase()} with current toggles
                </p>
              </div>
              <p className={`text-lg font-bold tabular-nums ${net >= 0 ? "text-[#1faca6]" : "text-red-700"}`}>
                {fmt(net)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
