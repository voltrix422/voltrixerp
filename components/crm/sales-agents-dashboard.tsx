"use client"

import type { SalesAgentProfile } from "@/lib/sales-agents"
import { JOB_TITLE_LABELS } from "@/lib/sales-agents"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  DollarSign,
  FileText,
  MapPin,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react"

type Props = {
  agents: SalesAgentProfile[]
  loading?: boolean
  onSelectAgent?: (agent: SalesAgentProfile) => void
}

function formatMoney(n: number) {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function sumAgents(agents: SalesAgentProfile[], pick: (s: NonNullable<SalesAgentProfile["stats"]>) => number) {
  return agents.reduce((acc, a) => acc + pick(a.stats ?? ({} as NonNullable<SalesAgentProfile["stats"]>)), 0)
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

  const chartData = agents.map(a => ({
    name: a.name.split(" ")[0] || a.name,
    fullName: a.name,
    clients: a.stats?.clients ?? 0,
    quotations: a.stats?.quotations ?? 0,
    orders: a.stats?.orders ?? 0,
    sales: Math.round((a.stats?.totalSales ?? 0) / 1000),
  }))

  const salesChartData = agents
    .map(a => ({
      name: a.name.split(" ")[0] || a.name,
      sales: a.stats?.totalSales ?? 0,
    }))
    .sort((a, b) => b.sales - a.sales)

  if (loading) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))] p-6">Loading dashboard...</p>
  }

  if (agents.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))] p-6 rounded-lg border">
        No sales agents yet. Add agents to see team performance here.
      </p>
    )
  }

  const kpiCards = [
    { label: "Sales agents", value: String(totals.agents), icon: Users, accent: "text-[#1faca6]" },
    { label: "Clients added", value: String(totals.clients), icon: Users, accent: "text-blue-500" },
    { label: "Quotations", value: String(totals.quotations), sub: formatMoney(totals.quotationsValue), icon: FileText, accent: "text-violet-500" },
    { label: "Total orders", value: String(totals.orders), sub: formatMoney(totals.ordersValue), icon: ShoppingCart, accent: "text-amber-500" },
    { label: "Delivered orders", value: String(totals.delivered), icon: Package, accent: "text-emerald-500" },
    { label: "Sales (delivered)", value: formatMoney(totals.totalSales), icon: TrendingUp, accent: "text-[#1faca6]" },
    { label: "Commission earned", value: formatMoney(totals.commission), icon: DollarSign, accent: "text-[#1faca6]" },
    { label: "Pending approval", value: String(totals.pendingOrders), icon: Package, accent: "text-orange-500" },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        {kpiCards.map(({ label, value, sub, icon: Icon, accent }) => (
          <div
            key={label}
            className="rounded-lg border bg-[hsl(var(--card))] p-3 sm:p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide">
                {label}
              </p>
              <Icon className={`h-4 w-4 shrink-0 ${accent}`} />
            </div>
            <p className="text-lg sm:text-xl font-bold mt-2 tabular-nums">{value}</p>
            {sub && (
              <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-semibold mb-1">Activity by agent</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
            Clients, quotations, and orders per agent
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-[hsl(var(--border))]" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [value, String(name)]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                />
                <Bar dataKey="clients" name="Clients" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="quotations" name="Quotations" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="orders" name="Orders" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm font-semibold mb-1">Delivered sales by agent</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
            Revenue from delivered orders only
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesChartData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-[hsl(var(--border))]" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(Number(v) / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => [formatMoney(Number(value)), "Sales"]}
                />
                <Bar dataKey="sales" name="Sales" fill="#1faca6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-3">Agent performance</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {agents.map(agent => (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelectAgent?.(agent)}
              className={`text-left rounded-lg border p-4 transition-colors hover:border-[#1faca6]/50 hover:bg-[#1faca6]/5 ${
                onSelectAgent ? "cursor-pointer" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{agent.name}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {JOB_TITLE_LABELS[agent.jobTitle]}
                  </p>
                </div>
                {agent.location && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                    <MapPin className="h-3 w-3" />
                    {agent.location}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-md bg-[hsl(var(--muted))]/30 px-2 py-1.5">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Clients</p>
                  <p className="text-base font-semibold">{agent.stats?.clients ?? 0}</p>
                </div>
                <div className="rounded-md bg-[hsl(var(--muted))]/30 px-2 py-1.5">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Quotations</p>
                  <p className="text-base font-semibold">{agent.stats?.quotations ?? 0}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {formatMoney(agent.stats?.quotationsValue ?? 0)}
                  </p>
                </div>
                <div className="rounded-md bg-[hsl(var(--muted))]/30 px-2 py-1.5">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Orders</p>
                  <p className="text-base font-semibold">{agent.stats?.orders ?? 0}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {agent.stats?.pendingOrders ?? 0} pending
                  </p>
                </div>
                <div className="rounded-md bg-[#1faca6]/10 px-2 py-1.5 border border-[#1faca6]/20">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Sold (delivered)</p>
                  <p className="text-base font-semibold text-[#1faca6]">
                    {formatMoney(agent.stats?.totalSales ?? 0)}
                  </p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {agent.stats?.deliveredOrders ?? 0} delivered
                  </p>
                </div>
              </div>

              {onSelectAgent && (
                <p className="text-[10px] text-[#1faca6] mt-3 font-medium">View details →</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
