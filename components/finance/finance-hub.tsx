"use client"

import { useEffect, useState, useCallback, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight, Wallet, ShoppingCart, FileText, Users,
  AlertCircle, Loader2, Receipt, Store,
  TrendingUp, TrendingDown, Percent, Package, Clock, Info,
  RefreshCw, CircleHelp,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type Summary = {
  pendingClientPayments: number
  ordersNeedingAction: number
  clientReceivedInPeriod: number
  clientOutstanding: number
  poPaidInPeriod: number
  expensesInPeriod: number
  financeRecordsCount: number
  importedAwaitingFinance: number
  pettyCashActive: number
  pettyCashRemaining: number
  pettyCashPendingReceipts: number
  posSalesInPeriod: number
  posTransactionsInPeriod: number
  salesCommissionInPeriod: number
  confirmedOrderValueInPeriod: number
  ordersConfirmedInPeriod: number
  openPoCount: number
  moneyIn: number
  moneyOut: number
  netCashFlow: number
}

type Action = {
  id: string
  title: string
  subtitle: string
  amount: number
  href: string
}

type Activity = {
  id: string
  date: string
  label: string
  amount: number
  category: string
  source: string
}

type Outstanding = { name: string; orderNumber: string; remaining: number }

function fmt(n: number) {
  return `PKR ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const PERIODS = [
  { id: "month", label: "This month", hint: "From the 1st of this month through today." },
  { id: "last_month", label: "Last month", hint: "The full previous calendar month." },
  { id: "year", label: "This year", hint: "From 1 January this year through today." },
]

const QUICK_LINKS = [
  { href: "/finance?tab=client", label: "Client order payments", desc: "Approve CRM payment proofs", icon: Users },
  { href: "/finance?tab=purchase", label: "Purchase order payments", desc: "Supplier & import PO payments", icon: ShoppingCart },
  { href: "/finance?tab=payroll", label: "Salaries & payroll", desc: "All staff & sales agents — PDF salary slips", icon: Users },
  { href: "/finance?tab=manage", label: "Finance records", desc: "Expenses, invoices, salary, tax", icon: FileText },
  { href: "/finance?tab=manage&section=petty-cash", label: "Petty cash", desc: "Staff allocations & receipts", icon: Wallet },
  { href: "/finance?tab=reports", label: "Reports & export", desc: "Trends, categories, CSV download", icon: TrendingUp },
  { href: "/crm", label: "CRM orders", desc: "View all sales orders", icon: Package },
  { href: "/pos", label: "POS sales", desc: "Retail counter receipts", icon: Store },
]

const SOURCE_LABELS: Record<string, string> = {
  client: "Client",
  record: "Record",
  purchase: "Purchase",
  petty_cash: "Petty cash",
  pos: "POS",
}

const SOURCE_HINTS: Record<string, string> = {
  client: "Approved payment collected on a CRM / client order.",
  record: "Manual finance record (expense, invoice, salary, tax, or refund).",
  purchase: "Payment made against a purchase order.",
  petty_cash: "Staff petty-cash receipt submitted or approved.",
  pos: "Retail POS counter sale.",
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

export function FinanceHub({ embedded }: { embedded?: boolean }) {
  const [period, setPeriod] = useState("month")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [periodLabel, setPeriodLabel] = useState("This month")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [topOutstanding, setTopOutstanding] = useState<Outstanding[]>([])
  const [expensesByCategory, setExpensesByCategory] = useState<{ category: string; amount: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/finance/overview?period=${period}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setPeriodLabel(data.periodLabel || "This month")
      setSummary(data.summary)
      setActions(data.actions ?? [])
      setActivity(data.recentActivity ?? [])
      setTopOutstanding(data.topOutstandingClients ?? [])
      setExpensesByCategory(data.expensesByCategory ?? [])
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

  const cards = [
    {
      label: "Pending approvals",
      value: String(summary.pendingClientPayments),
      sub: `${summary.ordersNeedingAction} order(s) waiting`,
      alert: summary.pendingClientPayments > 0,
      href: "/finance?tab=client",
      icon: Clock,
      hint: "Client payment proofs uploaded in CRM that finance has not approved yet. Click to review and approve them.",
    },
    {
      label: `Client payments`,
      value: fmt(summary.clientReceivedInPeriod),
      sub: `Approved CRM payments · ${periodLabel}`,
      href: "/finance?tab=client",
      icon: Users,
      hint: `Cash actually received from clients in ${periodLabel.toLowerCase()}. Only approved payments that count toward the order balance are included.`,
    },
    {
      label: "Outstanding from clients",
      value: fmt(summary.clientOutstanding),
      sub: "Credit still unpaid",
      alert: summary.clientOutstanding > 0,
      href: "/finance?tab=client",
      icon: AlertCircle,
      hint: "Total remaining balance on confirmed, processing, shipped, or delivered orders that are not fully paid. This is all-time outstanding, not limited to the selected period.",
    },
    {
      label: "POS sales",
      value: fmt(summary.posSalesInPeriod),
      sub: `${summary.posTransactionsInPeriod} receipt(s) · ${periodLabel}`,
      href: "/pos",
      icon: Store,
      hint: `Retail counter sales recorded in POS during ${periodLabel.toLowerCase()}. Separate from CRM client orders.`,
    },
    {
      label: "Confirmed orders",
      value: fmt(summary.confirmedOrderValueInPeriod),
      sub: `${summary.ordersConfirmedInPeriod} order(s) value · ${periodLabel}`,
      href: "/finance?tab=client",
      icon: Package,
      hint: `Full invoice value of orders that became confirmed, processing, shipped, or delivered in ${periodLabel.toLowerCase()}. This is sales booked — not necessarily cash collected.`,
    },
    {
      label: "Sales commission",
      value: fmt(summary.salesCommissionInPeriod),
      sub: `On confirmed orders · ${periodLabel}`,
      href: "/crm",
      icon: Percent,
      hint: `Commission amounts attached to orders confirmed in ${periodLabel.toLowerCase()}. Payable to sales agents — not deducted from money in.`,
    },
    {
      label: "PO payments",
      value: fmt(summary.poPaidInPeriod),
      sub: summary.importedAwaitingFinance > 0
        ? `${summary.importedAwaitingFinance} import PO at finance`
        : `${summary.openPoCount} open PO(s)`,
      alert: summary.importedAwaitingFinance > 0,
      href: "/finance?tab=purchase",
      icon: ShoppingCart,
      hint: `Money paid to suppliers on purchase orders during ${periodLabel.toLowerCase()}. Highlighted if an imported PO is waiting at the finance step.`,
    },
    {
      label: "Expenses",
      value: fmt(summary.expensesInPeriod),
      sub: `${summary.financeRecordsCount} records on file · ${periodLabel}`,
      href: "/finance?tab=manage",
      icon: Receipt,
      hint: `Expense, payment, tax, and salary records created in ${periodLabel.toLowerCase()}. Click to open Finance Records.`,
    },
    {
      label: "Petty cash left",
      value: fmt(summary.pettyCashRemaining),
      sub: summary.pettyCashPendingReceipts > 0
        ? `${summary.pettyCashPendingReceipts} receipt(s) pending`
        : `${summary.pettyCashActive} active allocation(s)`,
      alert: summary.pettyCashPendingReceipts > 0,
      href: "/finance?tab=manage&section=petty-cash",
      icon: Wallet,
      hint: "Unspent balance on active petty-cash allocations (allocated minus receipts). Pending receipts still need finance approval.",
    },
  ]

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

  const maxCat = expensesByCategory[0]?.amount || 1

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(c => {
          const Icon = c.icon
          return (
            <Link
              key={c.label}
              href={c.href}
              title={c.hint}
              className={`group/card relative rounded-xl border p-3.5 sm:p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                c.alert
                  ? "border-amber-300/70 bg-amber-500/[0.06] hover:border-amber-400"
                  : "bg-[hsl(var(--card))] hover:border-[#1faca6]/50 hover:bg-[#1faca6]/[0.04]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  c.alert ? "bg-amber-500/15" : "bg-[#1faca6]/10"
                }`}>
                  <Icon className={`h-4 w-4 ${c.alert ? "text-amber-700" : "text-[#1faca6]"}`} />
                </span>
                <span className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]/50 group-hover/card:text-[#1faca6] transition-colors" />
                  <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] opacity-0 -translate-x-1 transition-all group-hover/card:opacity-100 group-hover/card:translate-x-0" />
                </span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mt-2.5 leading-snug">
                {c.label}
              </p>
              <p className="text-base sm:text-lg font-bold tabular-nums mt-1 break-words leading-snug">{c.value}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">{c.sub}</p>
              <span className="pointer-events-none absolute left-3 right-3 top-full z-30 mt-2 rounded-lg border bg-[hsl(var(--popover))] px-3 py-2 text-[11px] leading-relaxed text-[hsl(var(--popover-foreground))] shadow-lg opacity-0 translate-y-1 transition-all duration-150 group-hover/card:opacity-100 group-hover/card:translate-y-0">
                {c.hint}
              </span>
            </Link>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-1 rounded-xl border bg-[hsl(var(--card))] p-4 hover:border-[#1faca6]/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Needs attention</h3>
            <Hint text="Work items for finance: approve uploaded proofs, collect remaining credit on delivered/confirmed orders, or move imported POs through finance." />
          </div>
          {actions.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">All clear — nothing waiting.</p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {actions.map(a => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    title={`${a.title} — ${a.subtitle}${a.amount > 0 ? ` · ${fmt(a.amount)}` : ""}. Open Client Orders or Purchase Orders to act.`}
                    className="block rounded-lg border px-2.5 py-2 text-xs transition-all hover:border-[#1faca6]/40 hover:bg-[#1faca6]/[0.05] hover:shadow-sm"
                  >
                    <p className="font-medium truncate">{a.title}</p>
                    <p className="text-[hsl(var(--muted-foreground))] truncate">{a.subtitle}</p>
                    {a.amount > 0 && <p className="font-semibold mt-0.5 tabular-nums">{fmt(a.amount)}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-1 rounded-xl border bg-[hsl(var(--card))] p-4 hover:border-[#1faca6]/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold">Top outstanding</h3>
            <Hint text="Largest unpaid client balances right now. Amount is what is still due on that order, not the original invoice total." />
          </div>
          {topOutstanding.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">No balances due.</p>
          ) : (
            <ul className="space-y-1.5">
              {topOutstanding.map((r, i) => (
                <li key={i}>
                  <Link
                    href="/finance?tab=client"
                    title={`${r.name} still owes ${fmt(r.remaining)} on ${r.orderNumber}. Open Client Orders to collect or record a payment.`}
                    className="flex justify-between gap-2 text-xs rounded-lg border border-transparent px-2 py-2 transition-all hover:border-[#1faca6]/30 hover:bg-[#1faca6]/[0.05]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-[hsl(var(--muted-foreground))]">{r.orderNumber}</p>
                    </div>
                    <span className="font-semibold tabular-nums shrink-0">{fmt(r.remaining)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/finance?tab=client"
            className="text-[10px] text-[#1faca6] mt-2 inline-flex items-center gap-1 hover:underline"
            title="Open the Client Orders tab to see every order and remaining credit."
          >
            View all client orders <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="lg:col-span-1 rounded-xl border bg-[hsl(var(--card))] p-4 hover:border-[#1faca6]/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold">Expenses ({periodLabel})</h3>
            <Hint text={`Finance records created in ${periodLabel.toLowerCase()}, grouped by category (Expense, Payment, Tax, Salary, Invoice, etc.). Bar length is relative to the largest category.`} />
          </div>
          {expensesByCategory.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">No records in this period.</p>
          ) : (
            <ul className="space-y-2.5">
              {expensesByCategory.slice(0, 6).map(row => (
                <li
                  key={row.category}
                  title={`${row.category}: ${fmt(row.amount)} recorded in ${periodLabel.toLowerCase()}.`}
                  className="rounded-md px-1 py-0.5 transition-colors hover:bg-[hsl(var(--muted))]/40"
                >
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>{row.category}</span>
                    <span className="tabular-nums">{fmt(row.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--muted))]/40">
                    <div className="h-full bg-[#1faca6] rounded-full transition-all" style={{ width: `${(row.amount / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!embedded && (
        <div className="rounded-xl border bg-[hsl(var(--card))] p-4">
          <h3 className="text-sm font-semibold mb-3">Quick links</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {QUICK_LINKS.map(({ href, label, desc, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={desc}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all hover:border-[#1faca6]/40 hover:bg-[#1faca6]/[0.05] hover:shadow-sm"
              >
                <Icon className="h-4 w-4 text-[#1faca6] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-[hsl(var(--card))] p-3.5 sm:p-4 hover:border-[#1faca6]/30 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold">Recent activity</h3>
          <Hint text="Latest money movements: approved client payments, POS sales, finance records, and petty-cash receipts. Hover a row for the source meaning." />
        </div>
        <div className="sm:hidden divide-y divide-[hsl(var(--border))]/60 max-h-80 overflow-y-auto">
          {activity.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">No recent activity.</p>
          ) : (
            activity.map(row => (
              <div
                key={row.id}
                title={`${row.label} · ${SOURCE_HINTS[row.source] ?? row.source} · ${fmt(row.amount)}`}
                className="py-3 first:pt-0 last:pb-0 rounded-md px-1 -mx-1 transition-colors hover:bg-[hsl(var(--muted))]/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium leading-snug break-words flex-1 min-w-0">{row.label}</p>
                  <p className="text-xs font-semibold tabular-nums shrink-0">{fmt(row.amount)}</p>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                  <span>{fmtDate(row.date)}</span>
                  <span className="uppercase">{SOURCE_LABELS[row.source] ?? row.source}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="hidden sm:block overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[hsl(var(--card))]">
              <tr className="border-b text-[hsl(var(--muted-foreground))]">
                <th className="text-left py-2 font-medium">Date</th>
                <th className="text-left py-2 font-medium">Description</th>
                <th className="text-left py-2 font-medium">Source</th>
                <th className="text-right py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {activity.map(row => (
                <tr
                  key={row.id}
                  title={`${row.label}. ${SOURCE_HINTS[row.source] ?? ""}`}
                  className="border-b last:border-0 transition-colors hover:bg-[#1faca6]/[0.06]"
                >
                  <td className="py-2.5 text-[hsl(var(--muted-foreground))] whitespace-nowrap">{fmtDate(row.date)}</td>
                  <td className="py-2.5 max-w-[240px] truncate">{row.label}</td>
                  <td className="py-2.5">
                    <span className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">
                      {SOURCE_LABELS[row.source] ?? row.source}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums whitespace-nowrap">{fmt(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
