"use client"

import { useState, useEffect } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
  const pettyCashByEmployee = (charts?.pettyCashByEmployee ?? []).slice(0, 5)
  const inventoryTrend = charts?.inventoryTrend ?? []
  const ticketTrend = charts?.ticketTrend ?? []
  const pettyTotal = pettyCashByEmployee.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

  const axisTick = { fontSize: 10, fill: "#86868b" }
  const gridStroke = "#e5e5ea"

  return (
    <>
      <DashboardMetricsStrip
        items={stripItems}
        loading={loading}
        showMoney={showMoney}
        onToggleMoney={toggleShowMoney}
      />

      <DashboardBlock action={<RangeToggle value={rangeDays} onChange={setRangeDays} />}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ChartCard
            title="Delivered"
            subtitle="Order amount"
            tall
            footer={
              <p className="text-[20px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums leading-none">
                {formatRsFull(charts?.deliveredTotal ?? 0)}
                <span className="ml-2 text-[12px] font-medium text-[#86868b]">
                  · {stats?.deliveredCount ?? 0} orders
                </span>
              </p>
            }
          >
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={deliveredTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
                  <YAxis domain={deliveredYDomain} tickFormatter={formatRsAxis} tick={axisTick} tickLine={false} axisLine={false} width={36} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)", marginBottom: 4 }}
                    formatter={(value) => formatRsFull(Number(value ?? 0))}
                    labelFormatter={(label, payload) => {
                      const ids = ((payload?.[0]?.payload as { orderIds?: string[] } | undefined)?.orderIds || [])
                        .slice(0, 3)
                        .join(", ")
                      const day = String(label ?? "")
                      return ids ? `${day} · ${ids}` : day
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#0071e3"
                    strokeWidth={2.25}
                    fill="#0071e3"
                    fillOpacity={0.12}
                    dot={false}
                    activeDot={{ r: 4, fill: "#0071e3", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Inventory" subtitle="Units added" tall>
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                    formatter={(v) => `${Number(v ?? 0).toLocaleString()} qty`}
                  />
                  <Bar dataKey="quantity" fill="#34c759" radius={[5, 5, 5, 5]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ChartCard
            title="Petty cash"
            subtitle="By employee"
            footer={
              <p className="text-[20px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums leading-none">
                {formatRsFull(pettyTotal)}
              </p>
            }
          >
            {loading ? (
              <ChartLoading />
            ) : pettyCashByEmployee.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[12px] text-[#86868b]">
                No petty cash in range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pettyCashByEmployee} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="0" horizontal={false} stroke={gridStroke} />
                  <XAxis type="number" tick={axisTick} tickFormatter={formatRsAxis} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={72}
                    tick={axisTick}
                    tickFormatter={(v) => String(v).split(" ").slice(0, 2).join(" ")}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    itemStyle={{ color: "#fff" }}
                    formatter={(v) => formatRsFull(Number(v ?? 0))}
                  />
                  <Bar dataKey="amount" fill="#af52de" radius={[0, 6, 6, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="After Sale" subtitle="Opened vs closed">
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ticketTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={24} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="opened"
                    name="Opened"
                    stroke="#ff9f0a"
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="closed"
                    name="Closed"
                    stroke="#30d158"
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </DashboardBlock>
    </>
  )
}
