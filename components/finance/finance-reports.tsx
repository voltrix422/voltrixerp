"use client"

import { useEffect, useState, useCallback } from "react"
import { Loader2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

type OverviewData = {
  periodLabel: string
  summary: Record<string, number>
  expensesByCategory: { category: string; amount: number }[]
  paymentMethods: { method: string; amount: number }[]
  topOutstandingClients: { name: string; orderNumber: string; remaining: number }[]
  monthlyTrend: { month: string; moneyIn: number; moneyOut: number }[]
  recentActivity: { id: string; date: string; label: string; amount: number; category: string; source: string }[]
}

function fmt(n: number) {
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function FinanceReports({ period }: { period: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<OverviewData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/finance/overview?period=${period}`)
    const json = await res.json()
    if (res.ok) setData(json)
    setLoading(false)
  }, [period])

  useEffect(() => { load() }, [load])

  function exportCsv() {
    if (!data) return
    const rows = [
      ["Date", "Description", "Type", "Source", "Amount (PKR)"],
      ...data.recentActivity.map(a => [
        new Date(a.date).toISOString().slice(0, 10),
        a.label,
        a.category,
        a.source,
        String(a.amount),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `voltrix-finance-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#1faca6]" />
      </div>
    )
  }

  if (!data) return <p className="text-sm text-center py-8 text-[hsl(var(--muted-foreground))]">Could not load reports.</p>

  const maxTrend = Math.max(...data.monthlyTrend.map(m => Math.max(m.moneyIn, m.moneyOut)), 1)

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1" />
          Export activity CSV
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-4">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Money in ({data.periodLabel})</p>
          <p className="text-lg font-bold text-green-700">{fmt(data.summary.moneyIn)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Money out ({data.periodLabel})</p>
          <p className="text-lg font-bold text-red-700">{fmt(data.summary.moneyOut)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Net ({data.periodLabel})</p>
          <p className={`text-lg font-bold ${data.summary.netCashFlow >= 0 ? "text-[#1faca6]" : "text-red-700"}`}>
            {fmt(data.summary.netCashFlow)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold mb-4">6-month cash trend</h3>
        <div className="flex items-end gap-2 h-32">
          {data.monthlyTrend.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex gap-0.5 items-end justify-center h-24">
                <div
                  className="w-2 bg-green-500/70 rounded-t"
                  style={{ height: `${(m.moneyIn / maxTrend) * 100}%`, minHeight: m.moneyIn > 0 ? 4 : 0 }}
                  title={`In: ${fmt(m.moneyIn)}`}
                />
                <div
                  className="w-2 bg-red-500/70 rounded-t"
                  style={{ height: `${(m.moneyOut / maxTrend) * 100}%`, minHeight: m.moneyOut > 0 ? 4 : 0 }}
                  title={`Out: ${fmt(m.moneyOut)}`}
                />
              </div>
              <span className="text-[9px] text-[hsl(var(--muted-foreground))] truncate w-full text-center">{m.month}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500/70" /> Money in</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/70" /> Money out</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-3">Expenses by category ({data.periodLabel})</h3>
          {data.expensesByCategory.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No finance records in this period.</p>
          ) : (
            <ul className="space-y-2">
              {data.expensesByCategory.map(row => {
                const max = data.expensesByCategory[0]?.amount || 1
                return (
                  <li key={row.category}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>{row.category}</span>
                      <span className="font-medium tabular-nums">{fmt(row.amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[hsl(var(--muted))]/30 overflow-hidden">
                      <div className="h-full bg-[#1faca6] rounded-full" style={{ width: `${(row.amount / max) * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-3">Client payments by method ({data.periodLabel})</h3>
          {data.paymentMethods.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No approved client payments in this period.</p>
          ) : (
            <ul className="space-y-2">
              {data.paymentMethods.map(row => {
                const max = data.paymentMethods[0]?.amount || 1
                return (
                  <li key={row.method}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>{row.method}</span>
                      <span className="font-medium tabular-nums">{fmt(row.amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[hsl(var(--muted))]/30 overflow-hidden">
                      <div className="h-full bg-blue-500/70 rounded-full" style={{ width: `${(row.amount / max) * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold mb-3">Top outstanding client orders</h3>
        {data.topOutstandingClients.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">No outstanding balances.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-[hsl(var(--muted-foreground))]">
                <th className="text-left py-2">Client</th>
                <th className="text-left py-2">Order</th>
                <th className="text-right py-2">Due</th>
              </tr>
            </thead>
            <tbody>
              {data.topOutstandingClients.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-[hsl(var(--muted-foreground))]">{r.orderNumber}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{fmt(r.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
