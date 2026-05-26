"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  ArrowRight, Wallet, ShoppingCart, FileText, Users,
  AlertCircle, Loader2, Receipt, Banknote,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type Summary = {
  pendingClientPayments: number
  ordersNeedingAction: number
  clientReceivedThisMonth: number
  clientOutstanding: number
  poPaidThisMonth: number
  expensesThisMonth: number
  financeRecordsCount: number
  importedAwaitingFinance: number
  pettyCashActive: number
  pettyCashRemaining: number
}

type Action = {
  id: string
  type: string
  title: string
  subtitle: string
  amount: number
  href: string
  priority: string
}

type Activity = {
  id: string
  date: string
  label: string
  amount: number
  category: string
  source: string
}

function fmt(n: number) {
  return `PKR ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

const QUICK_LINKS = [
  { href: "/finance?tab=client", label: "Client order payments", desc: "Approve CRM payment proofs", icon: Users },
  { href: "/finance?tab=purchase", label: "Purchase order payments", desc: "Supplier & import PO payments", icon: ShoppingCart },
  { href: "/finance?tab=manage", label: "Finance records", desc: "Expenses, invoices, salary, tax", icon: FileText },
  { href: "/finance?tab=manage&section=petty-cash", label: "Petty cash", desc: "Staff allocations & receipts", icon: Wallet },
]

export function FinanceHub() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [activity, setActivity] = useState<Activity[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/finance/overview")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setSummary(data.summary)
      setActions(data.actions ?? [])
      setActivity(data.recentActivity ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  if (loading) {
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
      sub: `${summary.ordersNeedingAction} order(s) need review`,
      alert: summary.pendingClientPayments > 0,
      href: "/finance?tab=client",
    },
    {
      label: "Client payments (this month)",
      value: fmt(summary.clientReceivedThisMonth),
      sub: "Approved CRM payments",
      href: "/finance?tab=client",
    },
    {
      label: "Outstanding from clients",
      value: fmt(summary.clientOutstanding),
      sub: "Orders not fully paid",
      alert: summary.clientOutstanding > 0,
      href: "/finance?tab=client",
    },
    {
      label: "PO payments (this month)",
      value: fmt(summary.poPaidThisMonth),
      sub: summary.importedAwaitingFinance > 0
        ? `${summary.importedAwaitingFinance} import PO(s) at finance step`
        : "Recorded on purchase orders",
      alert: summary.importedAwaitingFinance > 0,
      href: "/finance?tab=purchase",
    },
    {
      label: "Expenses (this month)",
      value: fmt(summary.expensesThisMonth),
      sub: `${summary.financeRecordsCount} total finance records`,
      href: "/finance?tab=manage",
    },
    {
      label: "Petty cash remaining",
      value: fmt(summary.pettyCashRemaining),
      sub: `${summary.pettyCashActive} active allocation(s)`,
      href: "/finance?tab=manage&section=petty-cash",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-[#1faca6]/5 border-[#1faca6]/20 px-4 py-3 text-sm">
        <p className="font-medium text-[hsl(var(--foreground))]">This is your Voltrix finance command center</p>
        <p className="text-[hsl(var(--muted-foreground))] text-xs mt-1">
          Numbers come from <strong>CRM client orders</strong>, <strong>purchase orders</strong>, <strong>finance records</strong>, and <strong>petty cash</strong> — the same data you already use in Payments &amp; records.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(c => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-lg border p-4 transition-colors hover:border-[#1faca6]/50 hover:bg-[hsl(var(--muted))]/20 ${
              c.alert ? "border-amber-300/60 bg-amber-500/5" : "bg-[hsl(var(--card))]"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{c.label}</p>
            <p className="text-xl font-bold tabular-nums mt-1">{c.value}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Needs your attention</h3>
          </div>
          {actions.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">Nothing urgent right now.</p>
          ) : (
            <ul className="space-y-2">
              {actions.map(a => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs hover:bg-[hsl(var(--muted))]/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.title}</p>
                      <p className="text-[hsl(var(--muted-foreground))] truncate">{a.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.amount > 0 && <span className="font-semibold tabular-nums">{fmt(a.amount)}</span>}
                      <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <h3 className="text-sm font-semibold mb-3">Go to workspace</h3>
          <div className="grid gap-2">
            {QUICK_LINKS.map(({ href, label, desc, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-md border px-3 py-2.5 hover:bg-[#1faca6]/5 hover:border-[#1faca6]/30 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1faca6]/10">
                  <Icon className="h-4 w-4 text-[#1faca6]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
        <h3 className="text-sm font-semibold mb-3">Recent money activity</h3>
        {activity.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">No recent activity.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-[hsl(var(--muted-foreground))]">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {activity.map(row => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 text-[hsl(var(--muted-foreground))]">{fmtDate(row.date)}</td>
                    <td className="py-2">{row.label}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        {row.source === "client" && <Users className="h-3 w-3" />}
                        {row.source === "record" && <Receipt className="h-3 w-3" />}
                        {row.source === "purchase" && <ShoppingCart className="h-3 w-3" />}
                        {row.source === "petty_cash" && <Banknote className="h-3 w-3" />}
                        {row.category || row.source}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">{fmt(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
