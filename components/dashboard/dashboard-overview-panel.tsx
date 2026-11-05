"use client"

import { useState, useEffect } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
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

export function DashboardOverviewPanel({ variant = "erp" }: { variant?: "erp" | "investor" }) {
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

  const crmHref = variant === "investor" ? "/investor/crm" : "/crm"
  const stripItems = [
    { label: "Staff", value: stats?.staff ?? 0, href: variant === "investor" ? undefined : "/hrm" },
    { label: "Clients", value: stats?.clients ?? 0, href: crmHref },
    { label: "Products", value: stats?.products ?? 0, href: variant === "investor" ? undefined : "/website" },
    { label: "Quotations", value: stats?.quotations ?? 0, href: crmHref },
    { label: "Orders", value: stats?.orders ?? 0, href: crmHref },
    { label: "Inventory", value: stats?.inventoryItems ?? 0, href: variant === "investor" ? undefined : "/inventory" },
    { label: "Expenses", value: formatCurrency(stats?.financeTotal ?? 0), href: variant === "investor" ? undefined : "/finance", isMoney: true },
    { label: "PO value", value: formatCurrency(stats?.totalPOValue ?? 0), href: variant === "investor" ? undefined : "/purchase", isMoney: true },
    { label: "Delivered", value: formatCurrency(stats?.deliveredValue ?? 0), href: crmHref, isMoney: true },
  ]

  const deliveredTrend = charts?.deliveredTrend ?? []
  const deliveredYDomain = chartAmountDomain(deliveredTrend.map((d) => d.amount))
  const pettyCashByEmployee = (charts?.pettyCashByEmployee ?? []).slice(0, 6)
  const inventoryTrend = charts?.inventoryTrend ?? []
  const ticketTrend = charts?.ticketTrend ?? []
  const pettyTotal = pettyCashByEmployee.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

  const pieColors = ["#0f766e", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4", "#ccfbf1"]
  const axisTick = { fontSize: 9, fill: "hsl(var(--muted-foreground))" }

  return (
    <>
      <DashboardMetricsStrip
        items={stripItems}
        loading={loading}
        showMoney={showMoney}
        onToggleMoney={toggleShowMoney}
      />

      <DashboardBlock
        action={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))] hidden sm:inline">
              Trends
            </span>
            <RangeToggle value={rangeDays} onChange={setRangeDays} />
          </div>
        }
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
          <ChartCard
            title="Delivered order amount"
            subtitle="Daily delivered value"
            tall
            footer={
              <span className="flex flex-wrap gap-3 justify-between">
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
                <ComposedChart data={deliveredTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="deliveredBarFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis domain={deliveredYDomain} tickFormatter={formatRsAxis} tick={axisTick} tickLine={false} axisLine={false} width={36} />
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
                  <Bar dataKey="amount" fill="url(#deliveredBarFill)" radius={[6, 6, 2, 2]} maxBarSize={18} />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#042f2e"
                    strokeWidth={1.75}
                    dot={false}
                    activeDot={{ r: 4, fill: "#0f766e" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Inventory added" subtitle="Units added per day" tall>
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inventoryBarFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#0e7490" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => `${Number(v ?? 0).toLocaleString()} qty`} />
                  <Bar dataKey="quantity" fill="url(#inventoryBarFill)" radius={[7, 7, 2, 2]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <ChartCard
            title="Petty cash"
            subtitle="Share by employee"
            footer={
              <span>
                Total{" "}
                <strong className="text-[hsl(var(--foreground))]">{formatRsFull(pettyTotal)}</strong>
              </span>
            }
          >
            {loading ? (
              <ChartLoading />
            ) : pettyCashByEmployee.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-[hsl(var(--muted-foreground))]">
                No petty cash in range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pettyCashByEmployee}
                    dataKey="amount"
                    nameKey="name"
                    cx="42%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={58}
                    paddingAngle={3}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {pettyCashByEmployee.map((entry, idx) => (
                      <Cell key={`${entry.name}-${idx}`} fill={pieColors[idx % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v, name) => [formatRsFull(Number(v ?? 0)), String(name)]}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={7}
                    formatter={(value) => (
                      <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
                        {String(value).split(" ").slice(0, 2).join(" ")}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="After Sale cases" subtitle="Opened vs closed">
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ticketTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={24} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend
                    iconType="circle"
                    iconSize={7}
                    wrapperStyle={{ fontSize: 10, paddingTop: 2 }}
                  />
                  <Bar dataKey="opened" name="Opened" stackId="tickets" fill="#f59e0b" radius={[0, 0, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="closed" name="Closed" stackId="tickets" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </DashboardBlock>
    </>
  )
}
