"use client"

import { useState, useEffect } from "react"
import {
  Area,
  AreaChart,
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

const PETTY_BAR_COLORS = ["#007aff", "#34c759", "#ff9f0a", "#af52de", "#ff375f"]

function PettyCashAppleList({
  rows,
}: {
  rows: Array<{ name: string; amount: number; role: string }>
}) {
  const max = Math.max(...rows.map((r) => Number(r.amount) || 0), 1)

  return (
    <div className="h-full flex flex-col justify-center gap-3 px-2.5 py-1">
      {rows.map((row, i) => {
        const amount = Number(row.amount) || 0
        const pct = Math.max(4, Math.round((amount / max) * 100))
        const initials = String(row.name || "?")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase() || "")
          .join("")
        const color = PETTY_BAR_COLORS[i % PETTY_BAR_COLORS.length]

        return (
          <div key={`${row.name}-${i}`} className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {initials || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
                    {row.name}
                  </p>
                  <p className="shrink-0 text-[12px] font-semibold tabular-nums tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    {formatRsFull(amount)}
                  </p>
                </div>
                {row.role ? (
                  <p className="text-[10px] text-[#86868b] truncate mt-0.5">{row.role}</p>
                ) : null}
              </div>
            </div>
            <div className="ml-9 h-[6px] rounded-full bg-black/[0.05] dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
    { label: "Delivered", value: formatCurrency(stats?.deliveredValue ?? 0), href: crmHref, isMoney: true },
  ]

  const deliveredTrend = charts?.deliveredTrend ?? []
  const deliveredYDomain = chartAmountDomain(deliveredTrend.map((d) => d.amount))
  const pettyCashByEmployee = (charts?.pettyCashByEmployee ?? []).slice(0, 5)
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
        <div className="grid grid-cols-1 gap-3">
          <ChartCard
            title="Delivered"
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ChartCard
            title="Petty cash"
            subtitle="By person"
            tall
            footer={
              <p className="text-[22px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums leading-none">
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
              <PettyCashAppleList rows={pettyCashByEmployee} />
            )}
          </ChartCard>

          <ChartCard title="After Sale" tall>
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
