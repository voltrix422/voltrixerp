"use client"

import type { SalesAgentProfile } from "@/lib/sales-agents"
import { JOB_TITLE_LABELS } from "@/lib/sales-agents"
import { ChevronRight, MapPin } from "lucide-react"

type Props = {
  agents: SalesAgentProfile[]
  loading?: boolean
  onSelectAgent?: (agent: SalesAgentProfile) => void
}

function formatMoney(n: number) {
  if (!n) return "Rs 0"
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function sumAgents(agents: SalesAgentProfile[], pick: (s: NonNullable<SalesAgentProfile["stats"]>) => number) {
  return agents.reduce((acc, a) => acc + pick(a.stats ?? ({} as NonNullable<SalesAgentProfile["stats"]>)), 0)
}

function StatCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={`text-center px-2 py-1 min-w-0 ${highlight ? "text-[#1faca6]" : ""}`}>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{label}</p>
      <p className={`text-sm font-semibold tabular-nums leading-tight ${highlight ? "text-[#1faca6]" : ""}`}>
        {value}
      </p>
      {sub ? (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{sub}</p>
      ) : null}
    </div>
  )
}

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
    return <p className="text-xs text-[hsl(var(--muted-foreground))] py-4">Loading dashboard…</p>
  }

  if (agents.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 rounded-md border px-3">
        No sales agents yet.
      </p>
    )
  }

  const teamStats = [
    { label: "Agents", value: totals.agents },
    { label: "Clients", value: totals.clients },
    { label: "Quotations", value: totals.quotations, sub: formatMoney(totals.quotationsValue) },
    { label: "Orders", value: totals.orders, sub: formatMoney(totals.ordersValue) },
    { label: "Delivered", value: totals.delivered },
    { label: "Sales", value: formatMoney(totals.totalSales), highlight: true },
    { label: "Commission", value: formatMoney(totals.commission), highlight: true },
    { label: "Pending", value: totals.pendingOrders },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-[hsl(var(--muted))]/15 overflow-hidden">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] px-3 pt-2 pb-1">
          Team summary
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-8 divide-x divide-[hsl(var(--border))] border-t border-[hsl(var(--border))]">
          {teamStats.map(s => (
            <StatCell
              key={s.label}
              label={s.label}
              value={s.value}
              sub={s.sub}
              highlight={s.highlight}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2 px-0.5">
          Agent performance
        </p>
        <div className="rounded-lg border overflow-hidden divide-y">
          <div className="hidden sm:grid sm:grid-cols-[minmax(140px,1.2fr)_repeat(6,1fr)_28px] gap-0 bg-[hsl(var(--muted))]/25 text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            <p className="px-3 py-2">Agent</p>
            <p className="py-2 text-center">Clients</p>
            <p className="py-2 text-center">Quotes</p>
            <p className="py-2 text-center">Orders</p>
            <p className="py-2 text-center">Pending</p>
            <p className="py-2 text-center">Delivered</p>
            <p className="py-2 text-center">Sales</p>
            <p className="py-2 text-center">Commission</p>
            <span />
          </div>

          {agents.map(agent => {
            const s = agent.stats
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent?.(agent)}
                className={`w-full text-left transition-colors hover:bg-[#1faca6]/5 ${
                  onSelectAgent ? "cursor-pointer" : ""
                }`}
              >
                <div className="sm:grid sm:grid-cols-[minmax(140px,1.2fr)_repeat(6,1fr)_28px] sm:items-center gap-2 sm:gap-0 p-3 sm:py-2.5 sm:px-0">
                  <div className="flex items-center gap-2 sm:px-3 min-w-0">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[#1faca6]/15 text-[#1faca6] flex items-center justify-center text-xs font-bold">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{agent.name}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                        {JOB_TITLE_LABELS[agent.jobTitle]}
                        {agent.location ? (
                          <span className="inline-flex items-center gap-0.5 ml-1">
                            · <MapPin className="h-2.5 w-2.5 inline" /> {agent.location}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2 sm:mt-0 sm:contents">
                    <StatCell label="Clients" value={s?.clients ?? 0} />
                    <StatCell
                      label="Quotes"
                      value={s?.quotations ?? 0}
                      sub={formatMoney(s?.quotationsValue ?? 0)}
                    />
                    <StatCell label="Orders" value={s?.orders ?? 0} />
                    <StatCell label="Pending" value={s?.pendingOrders ?? 0} />
                    <StatCell label="Delivered" value={s?.deliveredOrders ?? 0} />
                    <StatCell label="Sales" value={formatMoney(s?.totalSales ?? 0)} highlight />
                    <StatCell
                      label="Commission"
                      value={formatMoney(s?.commissionEarned ?? 0)}
                      highlight
                    />
                  </div>

                  {onSelectAgent && (
                    <ChevronRight className="hidden sm:block h-4 w-4 text-[hsl(var(--muted-foreground))] mx-auto" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
