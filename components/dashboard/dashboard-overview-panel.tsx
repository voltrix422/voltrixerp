"use client"

import { useState, useEffect } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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

/** Voltrix logo teal — used across all overview charts */
const CHART = "#1a9f9a"

function PettyCashGraph({
  rows,
}: {
  rows: Array<{ name: string; amount: number; role: string }>
}) {
  const data = rows.map((row) => ({
    name: String(row.name || "").split(" ")[0] || "—",
    fullName: row.name,
    amount: Number(row.amount) || 0,
  }))

  return (
    <div className="chart-glow h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="0" horizontal={false} stroke="#e5e5ea" />
          <XAxis
            type="number"
            tickFormatter={formatRsAxis}
            tick={{ fontSize: 10, fill: "#86868b" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={56}
            tick={{ fontSize: 11, fill: "#6e6e73" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(26,159,154,0.06)" }}
            contentStyle={CHART_TOOLTIP_STYLE}
            itemStyle={{ color: "#fff" }}
            labelStyle={{ color: "rgba(255,255,255,0.7)", marginBottom: 4 }}
            formatter={(value) => formatRsFull(Number(value ?? 0))}
            labelFormatter={(_, payload) =>
              String((payload?.[0]?.payload as { fullName?: string } | undefined)?.fullName || "")
            }
          />
          <Bar dataKey="amount" fill={CHART} radius={[0, 7, 7, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function AfterSaleGraph({
  trend,
  opened,
  closed,
}: {
  trend: Array<{ day: string; opened: number; closed: number }>
  opened: number
  closed: number
}) {
  const data = trend.map((d) => ({
    day: d.day,
    opened: d.opened,
    closed: d.closed,
  }))

  return (
    <div className="h-full flex flex-col gap-2.5 px-1 py-0.5">
      <div className="flex flex-wrap gap-1.5 px-1.5">
        <span className="inline-flex items-center rounded-full bg-black/[0.05] dark:bg-white/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
          {opened} opened
        </span>
        <span className="inline-flex items-center rounded-full bg-black/[0.05] dark:bg-white/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
          {closed} closed
        </span>
      </div>
      <div className="chart-glow flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" vertical={false} stroke="#e5e5ea" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "#86868b" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#86868b" }}
              tickLine={false}
              axisLine={false}
              width={22}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              itemStyle={{ color: "#fff" }}
              labelStyle={{ color: "rgba(255,255,255,0.7)", marginBottom: 4 }}
            />
            <Area
              type="monotone"
              dataKey="opened"
              name="Opened"
              stroke={CHART}
              strokeWidth={2.25}
              fill={CHART}
              fillOpacity={0.12}
              dot={false}
              activeDot={{ r: 3.5, fill: CHART, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="closed"
              name="Closed"
              stroke={CHART}
              strokeWidth={2}
              strokeOpacity={0.45}
              fill={CHART}
              fillOpacity={0.04}
              dot={false}
              activeDot={{ r: 3, fill: CHART, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ReceivedStats({
  total,
  payments,
  pending,
  delivered,
}: {
  total: number
  payments: number
  pending: number
  delivered: number
}) {
  const pill =
    "inline-flex items-center rounded-full bg-black/[0.05] dark:bg-white/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))]"

  return (
    <div className="space-y-2.5">
      <p className="text-[26px] font-bold tracking-tight tabular-nums leading-none text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
        {formatRsFull(total)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className={pill}>
          {payments} payment{payments === 1 ? "" : "s"}
        </span>
        {pending > 0 && <span className={pill}>{formatRsFull(pending)} pending</span>}
        {delivered > 0 && <span className={pill}>{delivered} delivered</span>}
      </div>
    </div>
  )
}

export function DashboardOverviewPanel({ variant = "erp" }: { variant?: "erp" | "investor" }) {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14)
  const { data, loading } = useDashboardOverview(rangeDays, true)
  const [showMoney, setShowMoney] = useState(true)
  const [animTick, setAnimTick] = useState(0)

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

  function handleRangeChange(v: 7 | 14 | 30) {
    if (v === rangeDays) return
    setRangeDays(v)
    setAnimTick((t) => t + 1)
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
    { label: "Received", value: formatCurrency(stats?.deliveredValue ?? 0), href: crmHref, isMoney: true },
  ]

  const deliveredTrend = charts?.deliveredTrend ?? []
  const deliveredYDomain = chartAmountDomain(deliveredTrend.map((d) => d.amount))
  const pettyCashByEmployee = (charts?.pettyCashByEmployee ?? []).slice(0, 5)
  const ticketTrend = charts?.ticketTrend ?? []
  const pettyTotal =
    charts?.pettyTotal ??
    pettyCashByEmployee.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const receivedCount = charts?.receivedCount ?? stats?.deliveredCount ?? 0
  const receivedPending = charts?.receivedPending ?? 0
  const deliveredOrdersCount = charts?.deliveredOrdersCount ?? stats?.deliveredOrdersCount ?? 0
  const ticketOpened = charts?.ticketOpened ?? ticketTrend.reduce((s, r) => s + r.opened, 0)
  const ticketClosed = charts?.ticketClosed ?? ticketTrend.reduce((s, r) => s + r.closed, 0)

  const axisTick = { fontSize: 10, fill: "#86868b" }
  const gridStroke = "#e5e5ea"

  return (
    <div key={animTick} className="dashboard-content-in space-y-5">
      <DashboardMetricsStrip
        items={stripItems}
        loading={loading}
        showMoney={showMoney}
        onToggleMoney={toggleShowMoney}
      />

      <DashboardBlock action={<RangeToggle value={rangeDays} onChange={handleRangeChange} />}>
        <div className="grid grid-cols-1 gap-3">
          <ChartCard
            title="Received"
            tall
            footer={
              <ReceivedStats
                total={charts?.deliveredTotal ?? 0}
                payments={receivedCount}
                pending={receivedPending}
                delivered={deliveredOrdersCount}
              />
            }
          >
            {loading ? (
              <ChartLoading />
            ) : (
              <div className="chart-glow h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={deliveredTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke={gridStroke} />
                    <XAxis
                      dataKey="day"
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={22}
                    />
                    <YAxis
                      domain={deliveredYDomain}
                      tickFormatter={formatRsAxis}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{ color: "rgba(255,255,255,0.7)", marginBottom: 4 }}
                      formatter={(value) => formatRsFull(Number(value ?? 0))}
                      labelFormatter={(label, payload) => {
                        const ids = (
                          (payload?.[0]?.payload as { orderIds?: string[] } | undefined)?.orderIds || []
                        )
                          .slice(0, 3)
                          .join(", ")
                        const day = String(label ?? "")
                        return ids ? `${day} · ${ids}` : day
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke={CHART}
                      strokeWidth={2.5}
                      fill={CHART}
                      fillOpacity={0.12}
                      dot={false}
                      activeDot={{ r: 4, fill: CHART, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ChartCard
            title="Petty cash"
            tall
            footer={
              <p className="text-[22px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums leading-none">
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
              <PettyCashGraph rows={pettyCashByEmployee} />
            )}
          </ChartCard>

          <ChartCard
            title="After Sale"
            tall
            footer={
              <p className="text-[22px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums leading-none">
                {ticketOpened + ticketClosed}
                <span className="ml-1.5 text-[12px] font-medium text-[#86868b]">cases</span>
              </p>
            }
          >
            {loading ? (
              <ChartLoading />
            ) : ticketOpened === 0 && ticketClosed === 0 ? (
              <div className="h-full flex items-center justify-center text-[12px] text-[#86868b]">
                No after-sale activity in range
              </div>
            ) : (
              <AfterSaleGraph trend={ticketTrend} opened={ticketOpened} closed={ticketClosed} />
            )}
          </ChartCard>
        </div>
      </DashboardBlock>
    </div>
  )
}
