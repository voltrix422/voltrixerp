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
import { DashboardBirdsEyeCard } from "@/components/dashboard/dashboard-birds-eye-card"

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

  const chartPalette = ["#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#99f6e4", "#67e8f9", "#a5b4fc"]
  const deliveredTrend = charts?.deliveredTrend ?? []
  const deliveredYDomain = chartAmountDomain(deliveredTrend.map((d) => d.amount))
  const pettyCashByEmployee = charts?.pettyCashByEmployee ?? []
  const inventoryTrend = charts?.inventoryTrend ?? []
  const ticketTrend = charts?.ticketTrend ?? []

  const axisTick = { fontSize: 9, fill: "hsl(var(--muted-foreground))" }

  return (
    <>
      {variant === "erp" ? <DashboardBirdsEyeCard /> : null}

      <DashboardMetricsStrip
        items={stripItems}
        loading={loading}
        showMoney={showMoney}
        onToggleMoney={toggleShowMoney}
      />

      <DashboardBlock
        action={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] hidden sm:inline">
              Charts
            </span>
            <RangeToggle value={rangeDays} onChange={setRangeDays} />
          </div>
        }
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          <ChartCard
            title="Delivered order amount"
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
                <AreaChart data={deliveredTrend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="miniDeliveredFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a9f9a" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#1a9f9a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.45} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
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
                  <Area type="monotone" dataKey="amount" stroke="#1a9f9a" strokeWidth={2} fill="url(#miniDeliveredFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Inventory added" tall>
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inventoryTrend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.45} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => `${Number(v ?? 0).toLocaleString()} qty`} />
                  <Line type="monotone" dataKey="quantity" stroke="#0f766e" strokeWidth={2} dot={{ r: 2, fill: "#0f766e" }} activeDot={{ r: 4 }} />
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
                <BarChart data={pettyCashByEmployee.slice(0, 6)} layout="vertical" margin={{ top: 2, right: 6, left: 0, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis type="number" tick={axisTick} tickFormatter={formatRsAxis} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={64}
                    tick={axisTick}
                    tickFormatter={(v) => String(v).split(" ").slice(0, 2).join(" ")}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRsFull(Number(v ?? 0))} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={12}>
                    {pettyCashByEmployee.slice(0, 6).map((entry, idx) => (
                      <Cell key={`${entry.name}-${idx}`} fill={chartPalette[idx % chartPalette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="After Sale cases">
            {loading ? (
              <ChartLoading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ticketTrend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.45} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={24} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="opened" stroke="#d97706" fill="#d9770618" strokeWidth={1.75} />
                  <Area type="monotone" dataKey="closed" stroke="#059669" fill="#05966914" strokeWidth={1.75} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </DashboardBlock>
    </>
  )
}
