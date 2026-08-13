"use client"

import { useEffect, useState, useCallback, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight, Loader2, TrendingUp, TrendingDown, RefreshCw, CircleHelp,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type Summary = {
  moneyIn: number
  moneyOut: number
  netCashFlow: number
}

function fmt(n: number) {
  return `PKR ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const PERIODS = [
  { id: "month", label: "This month", hint: "From the 1st of this month through today." },
  { id: "last_month", label: "Last month", hint: "The full previous calendar month." },
  { id: "year", label: "This year", hint: "From 1 January this year through today." },
]

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

export function FinanceHub({ embedded: _embedded }: { embedded?: boolean }) {
  const [period, setPeriod] = useState("month")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [periodLabel, setPeriodLabel] = useState("This month")
  const [summary, setSummary] = useState<Summary | null>(null)

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
      value: fmt(summary.moneyIn),
      hint: `Cash that came in during ${periodLabel.toLowerCase()}: approved client payments + POS sales + income-type finance records (invoice / payment / refund).`,
      detail: "Clients + POS + income records",
      icon: TrendingUp,
      tone: "in" as const,
    },
    {
      label: "Money out",
      value: fmt(summary.moneyOut),
      hint: `Cash that left during ${periodLabel.toLowerCase()}: finance expenses (expense, payment, tax, salary) + purchase-order payments + petty-cash receipts.`,
      detail: "Expenses + PO + petty cash",
      icon: TrendingDown,
      tone: "out" as const,
    },
    {
      label: "Net",
      value: fmt(summary.netCashFlow),
      hint: "Money in minus money out for the selected period. Positive means more cash came in than went out. This is a cash snapshot, not profit.",
      detail: "In − out for this period",
      icon: summary.netCashFlow >= 0 ? TrendingUp : TrendingDown,
      tone: summary.netCashFlow >= 0 ? ("net-pos" as const) : ("net-neg" as const),
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
        <Button
          size="sm"
          variant="outline"
          className="w-full sm:w-auto h-9 sm:h-8 gap-1.5"
          onClick={load}
          disabled={loading}
          title="Reload live numbers from the database."
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="rounded-2xl border bg-gradient-to-br from-[#1faca6]/12 via-[hsl(var(--card))] to-transparent p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[11px] sm:text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            {periodLabel} — cash snapshot
          </p>
          <Hint text="A quick cash picture for the selected period. Hover each number for what is included. Open Reports for charts and export." />
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
                  <Hint text={s.hint} />
                </p>
                <p className={`text-xl sm:text-2xl font-bold tabular-nums break-words leading-snug mt-1.5 ${valueClass}`}>
                  {s.value}
                </p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">{s.detail}</p>
                {s.label === "Net" && (
                  <Link
                    href="/finance?tab=reports"
                    className="text-[10px] text-[#1faca6] hover:underline mt-2 inline-flex items-center gap-1"
                  >
                    View full reports <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                <span className="pointer-events-none absolute left-3 right-3 top-full z-30 mt-2 rounded-lg border bg-[hsl(var(--popover))] px-3 py-2 text-[11px] leading-relaxed text-[hsl(var(--popover-foreground))] shadow-lg opacity-0 translate-y-1 transition-all duration-150 group-hover/snap:opacity-100 group-hover/snap:translate-y-0">
                  {s.hint}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
