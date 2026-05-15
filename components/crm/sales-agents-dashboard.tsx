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
  { key: "sales", label: "Sales (Rs)", align: "right" as const, accent: true },
  { key: "commission", label: "Comm. (Rs)", align: "right" as const, accent: true },
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
    return <p className="text-xs text-[hsl(var(--muted-foreground))] py-3">Loading…</p>
  }

  if (agents.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--muted-foreground))] py-3 px-3 rounded-md border">
        No sales agents yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-hidden text-xs">
        <div className="px-3 py-1.5 bg-[hsl(var(--muted))]/30 border-b">
          <span className="font-medium text-[hsl(var(--foreground))]">Team summary</span>
        </div>
        <div className="flex flex-wrap divide-x divide-[hsl(var(--border))]">
          {[
            { l: "Agents", v: totals.agents },
            { l: "Clients", v: totals.clients },
            { l: "Quotes", v: `${totals.quotations} · ${formatMoney(totals.quotationsValue)}` },
            { l: "Orders", v: `${totals.orders} · ${formatMoney(totals.ordersValue)}` },
            { l: "Delivered", v: totals.delivered },
            { l: "Sales", v: formatMoney(totals.totalSales), accent: true },
            { l: "Commission", v: formatMoney(totals.commission), accent: true },
            { l: "Pending", v: totals.pendingOrders },
          ].map(item => (
            <div key={item.l} className="flex-1 min-w-[72px] px-2.5 py-2 text-center">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{item.l}</p>
              <p
                className={`font-semibold tabular-nums mt-0.5 ${
                  item.accent ? "text-[#1faca6]" : ""
                }`}
              >
                {item.v}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[hsl(var(--muted))]/30 border-b">
          <span className="text-xs font-medium">Agent performance</span>
          {onSelectAgent && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Tap row to open</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs border-separate border-spacing-0">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/15">
                <th className="text-left font-medium px-3 py-2 w-[148px]">Agent</th>
                {COLS.map(c => (
                  <th
                    key={c.key}
                    className={`font-medium py-2 px-2 whitespace-nowrap ${
                      c.align === "right" ? "text-right" : "text-center"
                    } ${c.accent ? "text-[#1faca6]/80" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
                {onSelectAgent && <th className="w-7" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {agents.map(agent => {
                const s = agent.stats
                const row = (
                  <>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1faca6]/12 text-[11px] font-bold text-[#1faca6]">
                          {agent.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <p className="font-semibold truncate max-w-[120px]">{agent.name}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate max-w-[120px]">
                            {JOB_TITLE_LABELS[agent.jobTitle]}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums font-medium">{s?.clients ?? 0}</td>
                    <td className="px-2 py-2 text-center">
                      <span className="font-medium tabular-nums">{s?.quotations ?? 0}</span>
                      {(s?.quotationsValue ?? 0) > 0 && (
                        <span className="block text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums">
                          {formatMoney(s?.quotationsValue ?? 0)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums font-medium">{s?.orders ?? 0}</td>
                    <td className="px-2 py-2 text-center tabular-nums text-amber-600 dark:text-amber-400">
                      {s?.pendingOrders ?? 0}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{s?.deliveredOrders ?? 0}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium text-[#1faca6]">
                      {formatMoney(s?.totalSales ?? 0)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium text-[#1faca6]">
                      {formatMoney(s?.commissionEarned ?? 0)}
                    </td>
                    {onSelectAgent && (
                      <td className="pr-2 py-2 text-[hsl(var(--muted-foreground))]">
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
                      className="cursor-pointer transition-colors hover:bg-[#1faca6]/[0.06] group"
                    >
                      {row}
                    </tr>
                  )
                }

                return <tr key={agent.id}>{row}</tr>
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[hsl(var(--muted))]/30 text-[10px] font-semibold">
                <td className="px-3 py-2.5 border-t-2 border-[#1faca6]/50 text-[hsl(var(--muted-foreground))]">
                  Total
                </td>
                <td className="px-2 py-2.5 border-t-2 border-[#1faca6]/50 text-center tabular-nums">
                  {totals.clients}
                </td>
                <td className="px-2 py-2.5 border-t-2 border-[#1faca6]/50 text-center tabular-nums">
                  {totals.quotations}
                  {totals.quotationsValue > 0 && (
                    <span className="block font-normal text-[hsl(var(--muted-foreground))]">
                      {formatMoney(totals.quotationsValue)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 border-t-2 border-[#1faca6]/50 text-center tabular-nums">
                  {totals.orders}
                </td>
                <td className="px-2 py-2.5 border-t-2 border-[#1faca6]/50 text-center tabular-nums">
                  {totals.pendingOrders}
                </td>
                <td className="px-2 py-2.5 border-t-2 border-[#1faca6]/50 text-center tabular-nums">
                  {totals.delivered}
                </td>
                <td className="px-2 py-2.5 border-t-2 border-[#1faca6]/50 text-right tabular-nums text-[#1faca6]">
                  {formatMoney(totals.totalSales)}
                </td>
                <td className="px-2 py-2.5 border-t-2 border-[#1faca6]/50 text-right tabular-nums text-[#1faca6]">
                  {formatMoney(totals.commission)}
                </td>
                {onSelectAgent && (
                  <td className="border-t-2 border-[#1faca6]/50" />
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
