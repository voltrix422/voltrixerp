"use client"

import { useState, useEffect } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartCard,
  chartAmountDomain,
  ChartLoading,
  CHART_TOOLTIP_STYLE,
  DashboardBlock,
  DashboardMetricsStrip,
  formatRsAxis,
  formatRsFull,
  RangeToggle,
} from "@/components/dashboard/dashboard-ui"
import { useDashboardOverview } from "@/components/dashboard/use-dashboard-data"
import { FullBackupCard } from "@/components/dashboard/full-backup-card"

export function DashboardOverviewPanel() {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14)
  const { data, loading } = useDashboardOverview(rangeDays, true)
  const [showMoney, setShowMoney] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dashboard-show-money")
      if (stored === "0") setShowMoney(false)
    } catch {
      /* ignore */
    }
  }, [])

  function toggleShowMoney() {
    setShowMoney((prev) => {
      const next = !prev
      try {
        localStorage.setItem("dashboard-show-money", next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const stats = data?.stats
  const charts = data?.charts
  const formatCurrency = (value: number) =>
    `Rs. ${value.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`

  const stripItems = [
    { label: "Staff", value: stats?.staff ?? 0, href: "/hrm" },
    { label: "Clients", value: stats?.clients ?? 0, href: "/crm" },
    { label: "Products", value: stats?.products ?? 0, href: "/website" },
    { label: "Quotations", value: stats?.quotations ?? 0, href: "/crm" },
    { label: "Orders", value: stats?.orders ?? 0, href: "/crm" },
    { label: "Inventory", value: stats?.inventoryItems ?? 0, href: "/inventory" },
    { label: "Expenses", value: formatCurrency(stats?.financeTotal ?? 0), href: "/finance", isMoney: true },
    { label: "PO value", value: formatCurrency(stats?.totalPOValue ?? 0), href: "/purchase", isMoney: true },
    { label: "Delivered", value: formatCurrency(stats?.deliveredValue ?? 0), href: "/crm", isMoney: true },
  ]

  const chartPalette = ["#93c5fd", "#86efac", "#fde68a", "#c4b5fd", "#fbcfe8", "#99f6e4", "#bfdbfe"]
  const deliveredTrend = charts?.deliveredTrend ?? []
  const deliveredYDomain = chartAmountDomain(deliveredTrend.map((d) => d.amount))
  const pettyCashByEmployee = charts?.pettyCashByEmployee ?? []
  const inventoryTrend = charts?.inventoryTrend ?? []
  const ticketTrend = charts?.ticketTrend ?? []

  return (
    <>
      <FullBackupCard />

      <DashboardMetricsStrip
        items={stripItems}
        loading={loading}
        showMoney={showMoney}
        onToggleMoney={toggleShowMoney}
      />

      <DashboardBlock action={<RangeToggle value={rangeDays} onChange={setRangeDays} />}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          <ChartCard
            title="Delivered order amount"
            tall
            footer={
              <span className="flex flex-wrap gap-4 justify-between">
                <span>
                  <strong className="text-[hsl(var(--foreground))]">
                    {formatRsFull(charts?.deliveredTotal ?? 0)}
                  </strong>{" "}
                  delivered
                </span>
                <span>
                  <strong className="text-[hsl(var(--foreground))]">{stats?.deliveredCount ?? 0}</strong> orders
                </span>
              </span>
            }
          >
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={deliveredTrend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="miniDeliveredFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1faca6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#1faca6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis domain={deliveredYDomain} tickFormatter={formatRsAxis} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={42} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value) => formatRsFull(Number(value ?? 0))}
                    labelFormatter={(label, payload) => {
                      const ids = ((payload?.[0]?.payload as { orderIds?: string[] } | undefined)?.orderIds || [])
                        .slice(0, 3)
                        .join(", ")
                      const day = String(label ?? "")
                      return ids ? `${day} · ${ids}` : day
                    }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#1faca6" strokeWidth={2.5} fill="url(#miniDeliveredFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Inventory added" tall>
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inventoryTrend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => `${Number(v ?? 0).toLocaleString()} qty`} />
                  <Line type="monotone" dataKey="quantity" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <ChartCard title="Petty cash">
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pettyCashByEmployee.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatRsAxis} />
                  <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => String(v).split(" ").slice(0, 2).join(" ")} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRsFull(Number(v ?? 0))} />
                  <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                    {pettyCashByEmployee.slice(0, 6).map((entry, idx) => (
                      <Cell key={`${entry.name}-${idx}`} fill={chartPalette[idx % chartPalette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Support tickets">
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ticketTrend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="opened" stroke="#f59e0b" fill="#f59e0b22" strokeWidth={2} />
                  <Area type="monotone" dataKey="closed" stroke="#10b981" fill="#10b98118" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </DashboardBlock>
    </>
  )
}
