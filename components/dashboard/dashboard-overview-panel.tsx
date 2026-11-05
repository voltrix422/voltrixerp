"use client"

import { useState, useEffect } from "react"
import {
  Area,
  AreaChart,
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

const PETTY_COLORS = ["#007aff", "#34c759", "#ff9f0a", "#af52de", "#ff375f", "#64d2ff"]

function PettyCashShare({
  rows,
  total,
}: {
  rows: Array<{ name: string; amount: number; role: string }>
  total: number
}) {
  const max = Math.max(...rows.map((r) => Number(r.amount) || 0), 1)
  const circumference = 2 * Math.PI * 36
  let offset = 0
  const segments = rows.map((row, i) => {
    const amount = Number(row.amount) || 0
    const share = total > 0 ? amount / total : 0
    const length = share * circumference
    const seg = {
      color: PETTY_COLORS[i % PETTY_COLORS.length],
      dash: `${length} ${circumference - length}`,
      offset,
      share,
      amount,
      name: row.name,
      role: row.role,
    }
    offset -= length
    return seg
  })

  return (
    <div className="h-full grid grid-cols-[112px_1fr] gap-3 items-center px-2 py-1">
      <div className="relative mx-auto h-[96px] w-[96px]">
        <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
          <circle cx="48" cy="48" r="36" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="48"
              cy="48"
              r="36"
              fill="none"
              stroke={seg.color}
              strokeWidth="10"
              strokeDasharray={seg.dash}
              strokeDashoffset={seg.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <p className="text-[10px] font-medium text-[#86868b]">Share</p>
          <p className="text-[13px] font-bold tabular-nums tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            {rows.length}
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-2.5 overflow-y-auto max-h-full pr-1">
        {rows.map((row, i) => {
          const amount = Number(row.amount) || 0
          const pct = Math.max(6, Math.round((amount / max) * 100))
          const sharePct = total > 0 ? Math.round((amount / total) * 100) : 0
          const color = PETTY_COLORS[i % PETTY_COLORS.length]
          const initials = String(row.name || "?")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() || "")
            .join("")

          return (
            <div key={`${row.name}-${i}`} className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {initials || "?"}
                </span>
                <div className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
                  <p className="text-[12px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
                    {row.name}
                  </p>
                  <p className="shrink-0 text-[11px] font-semibold tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    {formatRsFull(amount)}
                  </p>
                </div>
              </div>
              <div className="ml-8 flex items-center gap-2">
                <div className="h-[5px] flex-1 rounded-full bg-black/[0.05] dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-[#86868b] w-7 text-right">{sharePct}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AfterSaleApple({
  trend,
  opened,
  closed,
}: {
  trend: Array<{ day: string; opened: number; closed: number }>
  opened: number
  closed: number
}) {
  const maxDay = Math.max(...trend.map((d) => Math.max(d.opened, d.closed)), 1)
  const recent = trend.slice(-10)

  return (
    <div className="h-full flex flex-col justify-between gap-3 px-2.5 py-1">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[#ff9f0a]/10 px-3 py-2.5">
          <p className="text-[11px] font-medium text-[#b25000]">Opened</p>
          <p className="mt-1 text-[22px] font-bold tracking-tight tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            {opened}
          </p>
        </div>
        <div className="rounded-2xl bg-[#30d158]/10 px-3 py-2.5">
          <p className="text-[11px] font-medium text-[#1a7f37]">Closed</p>
          <p className="mt-1 text-[22px] font-bold tracking-tight tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            {closed}
          </p>
        </div>
      </div>

      <div className="flex items-end gap-1.5 h-[72px] px-0.5">
        {recent.map((d) => {
          const openH = Math.max(6, Math.round((d.opened / maxDay) * 100))
          const closeH = Math.max(6, Math.round((d.closed / maxDay) * 100))
          return (
            <div key={d.day} className="flex-1 min-w-0 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5 h-[52px]">
                <div
                  className="w-[45%] rounded-t-md bg-[#ff9f0a]"
                  style={{ height: `${openH}%`, opacity: d.opened ? 1 : 0.18 }}
                  title={`${d.day}: ${d.opened} opened`}
                />
                <div
                  className="w-[45%] rounded-t-md bg-[#30d158]"
                  style={{ height: `${closeH}%`, opacity: d.closed ? 1 : 0.18 }}
                  title={`${d.day}: ${d.closed} closed`}
                />
              </div>
              <span className="text-[9px] text-[#86868b] truncate w-full text-center">
                {d.day.replace(/^[A-Za-z]+ /, "")}
              </span>
            </div>
          )
        })}
      </div>
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
    { label: "Received", value: formatCurrency(stats?.deliveredValue ?? 0), href: crmHref, isMoney: true },
  ]

  const deliveredTrend = charts?.deliveredTrend ?? []
  const deliveredYDomain = chartAmountDomain(deliveredTrend.map((d) => d.amount))
  const pettyCashByEmployee = (charts?.pettyCashByEmployee ?? []).slice(0, 5)
  const ticketTrend = charts?.ticketTrend ?? []
  const pettyTotal = charts?.pettyTotal ?? pettyCashByEmployee.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const receivedCount = charts?.receivedCount ?? stats?.deliveredCount ?? 0
  const receivedPending = charts?.receivedPending ?? 0
  const deliveredOrdersCount = charts?.deliveredOrdersCount ?? stats?.deliveredOrdersCount ?? 0
  const ticketOpened = charts?.ticketOpened ?? ticketTrend.reduce((s, r) => s + r.opened, 0)
  const ticketClosed = charts?.ticketClosed ?? ticketTrend.reduce((s, r) => s + r.closed, 0)

  const axisTick = { fontSize: 10, fill: "#86868b" }
  const gridStroke = "#e5e5ea"
  const rangeLabel = `${rangeDays}D`

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
            title="Received"
            subtitle={`Cash in · ${rangeLabel}`}
            tall
            footer={
              <p className="text-[20px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums leading-none">
                {formatRsFull(charts?.deliveredTotal ?? 0)}
                <span className="ml-2 text-[12px] font-medium text-[#86868b]">
                  · {receivedCount} payment{receivedCount === 1 ? "" : "s"}
                  {receivedPending > 0 ? ` · ${formatRsFull(receivedPending)} pending` : ""}
                  {deliveredOrdersCount > 0 ? ` · ${deliveredOrdersCount} delivered` : ""}
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
            subtitle={`Allocated · ${rangeLabel}`}
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
              <PettyCashShare rows={pettyCashByEmployee} total={pettyTotal} />
            )}
          </ChartCard>

          <ChartCard
            title="After Sale"
            subtitle={`Cases · ${rangeLabel}`}
            tall
            footer={
              <p className="text-[13px] font-medium text-[#86868b]">
                <span className="text-[#1d1d1f] dark:text-[hsl(var(--foreground))] font-semibold tabular-nums">
                  {ticketOpened + ticketClosed}
                </span>{" "}
                activity
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
              <AfterSaleApple trend={ticketTrend} opened={ticketOpened} closed={ticketClosed} />
            )}
          </ChartCard>
        </div>
      </DashboardBlock>
    </>
  )
}
