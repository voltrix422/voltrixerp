"use client"

import type { SalesAgentProfile } from "@/lib/sales-agents"
import { JOB_TITLE_LABELS } from "@/lib/sales-agents"
import { ChevronRight } from "lucide-react"

type Props = {
  agents: SalesAgentProfile[]
  loading?: boolean
  onSelectAgent?: (agent: SalesAgentProfile) => void
}

function formatMoney(n: number) {
  return (n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })
}

function sumAgents(agents: SalesAgentProfile[], pick: (s: NonNullable<SalesAgentProfile["stats"]>) => number) {
  return agents.reduce((acc, a) => acc + pick(a.stats ?? ({} as NonNullable<SalesAgentProfile["stats"]>)), 0)
}

const COLS = [
  { key: "clients", label: "Clients", align: "center" as const },
  { key: "quotes", label: "Quotes", align: "center" as const },
  { key: "orders", label: "Orders", align: "center" as const },
  { key: "pending", label: "Pending", align: "center" as const },
  { key: "delivered", label: "Done", align: "center" as const },
  { key: "sales", label: "Sales", align: "right" as const },
  { key: "commission", label: "Commission", align: "right" as const },
]

export function SalesAgentsDashboard({ agents, loading, onSelectAgent }: Props) {
  const totals = {
    agents: agents.length,
    clients: sumAgents(agents, s => s.clients ?? 0),
    quotations: sumAgents(agents, s => s.quotations ?? 0),
    quotationsValue: sumAgents(agents, s => s.quotationsValue ?? 0),
    orders: sumAgents(agents, s => s.orders ?? 0),
    ordersValue: sumAgents(agents, s => s.ordersValue ?? 0),
    delivered: sumAgents(agents, s => s.deliveredOrders ?? 0),
    totalSales: sumAgents(agents, s => s.totalSales ?? 0),
    commission: sumAgents(agents, s => s.commissionEarned ?? 0),
    pendingOrders: sumAgents(agents, s => s.pendingOrders ?? 0),
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-7 w-7 rounded-full border-2 border-[#0071e3] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] px-4 py-12 text-center text-[13px] text-[#86868b] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        No sales agents yet.
      </div>
    )
  }

  const summary = [
    { l: "Agents", v: String(totals.agents) },
    { l: "Clients", v: String(totals.clients) },
    { l: "Quotes", v: String(totals.quotations), sub: totals.quotationsValue > 0 ? formatMoney(totals.quotationsValue) : undefined },
    { l: "Orders", v: String(totals.orders), sub: totals.ordersValue > 0 ? formatMoney(totals.ordersValue) : undefined },
    { l: "Delivered", v: String(totals.delivered) },
    { l: "Sales", v: formatMoney(totals.totalSales) },
    { l: "Commission", v: formatMoney(totals.commission) },
    { l: "Pending", v: String(totals.pendingOrders) },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {summary.map(item => (
          <div
            key={item.l}
            className="rounded-[14px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#86868b]">{item.l}</p>
            <p className="text-[15px] font-semibold tabular-nums tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] mt-0.5">
              {item.v}
            </p>
            {item.sub ? (
              <p className="text-[11px] text-[#86868b] tabular-nums mt-0.5">{item.sub}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-[16px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.04] dark:border-[hsl(var(--border))]">
          <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            Agent performance
          </p>
          {onSelectAgent && (
            <span className="text-[11px] text-[#86868b]">Tap a row to open</span>
          )}
        </div>

        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.04] dark:border-[hsl(var(--border))] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/30">
                <th className="text-left font-medium text-[11px] text-[#86868b] px-4 py-2.5 w-[168px]">
                  Agent
                </th>
                {COLS.map(c => (
                  <th
                    key={c.key}
                    className={`font-medium text-[11px] text-[#86868b] py-2.5 px-2 whitespace-nowrap ${
                      c.align === "right" ? "text-right" : "text-center"
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
                {onSelectAgent && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-[hsl(var(--border))]">
              {agents.map(agent => {
                const s = agent.stats
                const cells = (
                  <>
                    <td className="px-4 py-2.5 align-middle">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2f2f7] dark:bg-[hsl(var(--muted))]/40 text-[12px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                          {agent.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <p className="font-semibold tracking-tight truncate max-w-[130px] text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                            {agent.name}
                          </p>
                          <p className="text-[11px] text-[#86868b] truncate max-w-[130px]">
                            {JOB_TITLE_LABELS[agent.jobTitle]}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums font-medium">{s?.clients ?? 0}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className="font-medium tabular-nums">{s?.quotations ?? 0}</span>
                      {(s?.quotationsValue ?? 0) > 0 && (
                        <span className="block text-[11px] text-[#86868b] tabular-nums">
                          {formatMoney(s?.quotationsValue ?? 0)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums font-medium">{s?.orders ?? 0}</td>
                    <td className="px-2 py-2.5 text-center tabular-nums text-amber-600 dark:text-amber-400">
                      {s?.pendingOrders ?? 0}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums">{s?.deliveredOrders ?? 0}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                      {formatMoney(s?.totalSales ?? 0)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-[#0071e3]">
                      {formatMoney(s?.commissionEarned ?? 0)}
                    </td>
                    {onSelectAgent && (
                      <td className="pr-3 py-2.5 text-[#86868b]">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </td>
                    )}
                  </>
                )

                if (onSelectAgent) {
                  return (
                    <tr
                      key={agent.id}
                      onClick={() => onSelectAgent(agent)}
                      className="cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    >
                      {cells}
                    </tr>
                  )
                }

                return <tr key={agent.id}>{cells}</tr>
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#fafafa] dark:bg-[hsl(var(--muted))]/25 text-[12px] font-semibold">
                <td className="px-4 py-2.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))] text-[#86868b]">
                  Total
                </td>
                <td className="px-2 py-2.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))] text-center tabular-nums">
                  {totals.clients}
                </td>
                <td className="px-2 py-2.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))] text-center tabular-nums">
                  {totals.quotations}
                  {totals.quotationsValue > 0 && (
                    <span className="block font-normal text-[11px] text-[#86868b]">
                      {formatMoney(totals.quotationsValue)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))] text-center tabular-nums">
                  {totals.orders}
                </td>
                <td className="px-2 py-2.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))] text-center tabular-nums">
                  {totals.pendingOrders}
                </td>
                <td className="px-2 py-2.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))] text-center tabular-nums">
                  {totals.delivered}
                </td>
                <td className="px-2 py-2.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))] text-right tabular-nums">
                  {formatMoney(totals.totalSales)}
                </td>
                <td className="px-2 py-2.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))] text-right tabular-nums text-[#0071e3]">
                  {formatMoney(totals.commission)}
                </td>
                {onSelectAgent && (
                  <td className="border-t border-black/[0.06] dark:border-[hsl(var(--border))]" />
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
