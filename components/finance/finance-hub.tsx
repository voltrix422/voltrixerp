"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  ArrowRight, Wallet, ShoppingCart, FileText, Users,
  AlertCircle, Loader2, Receipt, Banknote, Store,
  TrendingUp, TrendingDown, Percent, Package, Clock,
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
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "year", label: "This year" },
]

const QUICK_LINKS = [
  { href: "/finance?tab=client", label: "Client order payments", desc: "Approve CRM payment proofs", icon: Users },
  { href: "/finance?tab=purchase", label: "Purchase order payments", desc: "Supplier & import PO payments", icon: ShoppingCart },
  { href: "/finance?tab=sales-salaries", label: "Sales salaries", desc: "Agent payroll, commission & PDF slips", icon: Users },
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
    { label: "Pending approvals", value: String(summary.pendingClientPayments), sub: `${summary.ordersNeedingAction} order(s)`, alert: summary.pendingClientPayments > 0, href: "/finance?tab=client", icon: Clock },
    { label: `Client payments (${periodLabel})`, value: fmt(summary.clientReceivedInPeriod), sub: "Approved CRM payments", href: "/finance?tab=client", icon: Users },
    { label: "Outstanding from clients", value: fmt(summary.clientOutstanding), sub: "Not fully paid yet", alert: summary.clientOutstanding > 0, href: "/finance?tab=client", icon: AlertCircle },
    { label: `POS sales (${periodLabel})`, value: fmt(summary.posSalesInPeriod), sub: `${summary.posTransactionsInPeriod} receipt(s)`, href: "/pos", icon: Store },
    { label: `Confirmed orders (${periodLabel})`, value: fmt(summary.confirmedOrderValueInPeriod), sub: `${summary.ordersConfirmedInPeriod} order(s) value`, href: "/finance?tab=client", icon: Package },
    { label: `Sales commission (${periodLabel})`, value: fmt(summary.salesCommissionInPeriod), sub: "On confirmed orders", href: "/crm", icon: Percent },
    { label: `PO payments (${periodLabel})`, value: fmt(summary.poPaidInPeriod), sub: summary.importedAwaitingFinance > 0 ? `${summary.importedAwaitingFinance} import PO at finance` : `${summary.openPoCount} open PO(s)`, alert: summary.importedAwaitingFinance > 0, href: "/finance?tab=purchase", icon: ShoppingCart },
    { label: `Expenses (${periodLabel})`, value: fmt(summary.expensesInPeriod), sub: `${summary.financeRecordsCount} records total`, href: "/finance?tab=manage", icon: Receipt },
    { label: "Petty cash left", value: fmt(summary.pettyCashRemaining), sub: summary.pettyCashPendingReceipts > 0 ? `${summary.pettyCashPendingReceipts} receipt(s) pending` : `${summary.pettyCashActive} active`, alert: summary.pettyCashPendingReceipts > 0, href: "/finance?tab=manage&section=petty-cash", icon: Wallet },
  ]

  const maxCat = expensesByCategory[0]?.amount || 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border p-0.5 bg-[hsl(var(--muted))]/20">
          {PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                period === p.id ? "bg-[#1faca6] text-white" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {/* Cash flow snapshot */}
      <div className="rounded-xl border bg-gradient-to-br from-[#1faca6]/10 to-transparent p-4">
        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">{periodLabel} — cash snapshot</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-600" /> Money in</p>
            <p className="text-xl font-bold text-green-700 tabular-nums">{fmt(summary.moneyIn)}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Clients + POS + income records</p>
          </div>
          <div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-600" /> Money out</p>
            <p className="text-xl font-bold text-red-700 tabular-nums">{fmt(summary.moneyOut)}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Expenses + PO + petty cash</p>
          </div>
          <div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Net</p>
            <p className={`text-xl font-bold tabular-nums ${summary.netCashFlow >= 0 ? "text-[#1faca6]" : "text-red-700"}`}>{fmt(summary.netCashFlow)}</p>
            <Link href="/finance?tab=reports" className="text-[10px] text-[#1faca6] hover:underline mt-0.5 inline-block">View full reports →</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(c => {
          const Icon = c.icon
          return (
            <Link
              key={c.label}
              href={c.href}
              className={`rounded-lg border p-3 transition-colors hover:border-[#1faca6]/50 hover:bg-[hsl(var(--muted))]/20 ${
                c.alert ? "border-amber-300/60 bg-amber-500/5" : "bg-[hsl(var(--card))]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-4 w-4 text-[#1faca6] shrink-0 mt-0.5" />
                <ArrowRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mt-2">{c.label}</p>
              <p className="text-lg font-bold tabular-nums mt-0.5">{c.value}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{c.sub}</p>
            </Link>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 rounded-lg border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Needs attention</h3>
          </div>
          {actions.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">All clear.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {actions.map(a => (
                <li key={a.id}>
                  <Link href={a.href} className="block rounded-md border px-2 py-2 text-xs hover:bg-[hsl(var(--muted))]/30">
                    <p className="font-medium truncate">{a.title}</p>
                    <p className="text-[hsl(var(--muted-foreground))] truncate">{a.subtitle}</p>
                    {a.amount > 0 && <p className="font-semibold mt-0.5 tabular-nums">{fmt(a.amount)}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-1 rounded-lg border bg-[hsl(var(--card))] p-4">
          <h3 className="text-sm font-semibold mb-3">Top outstanding</h3>
          {topOutstanding.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">No balances due.</p>
          ) : (
            <ul className="space-y-2">
              {topOutstanding.map((r, i) => (
                <li key={i} className="flex justify-between gap-2 text-xs border-b pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.name}</p>
                    <p className="text-[hsl(var(--muted-foreground))]">{r.orderNumber}</p>
                  </div>
                  <span className="font-semibold tabular-nums shrink-0">{fmt(r.remaining)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/finance?tab=client" className="text-[10px] text-[#1faca6] mt-2 inline-block hover:underline">View all client orders →</Link>
        </div>

        <div className="lg:col-span-1 rounded-lg border bg-[hsl(var(--card))] p-4">
          <h3 className="text-sm font-semibold mb-3">Expenses ({periodLabel})</h3>
          {expensesByCategory.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">No records in period.</p>
          ) : (
            <ul className="space-y-2">
              {expensesByCategory.slice(0, 6).map(row => (
                <li key={row.category}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>{row.category}</span>
                    <span className="tabular-nums">{fmt(row.amount)}</span>
                  </div>
                  <div className="h-1 rounded-full bg-[hsl(var(--muted))]/30">
                    <div className="h-full bg-[#1faca6] rounded-full" style={{ width: `${(row.amount / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!embedded && (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <h3 className="text-sm font-semibold mb-3">Quick links</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {QUICK_LINKS.map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-[#1faca6]/5 transition-colors">
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

      <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
        <h3 className="text-sm font-semibold mb-3">Recent activity</h3>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
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
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2 text-[hsl(var(--muted-foreground))] whitespace-nowrap">{fmtDate(row.date)}</td>
                  <td className="py-2 max-w-[200px] truncate">{row.label}</td>
                  <td className="py-2">
                    <span className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{SOURCE_LABELS[row.source] ?? row.source}</span>
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums whitespace-nowrap">{fmt(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
