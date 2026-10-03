"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { motion } from "motion/react"
import { useTheme } from "next-themes"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { InvestorDateFilter } from "@/components/investor/investor-date-filter"
import {
  formatInvestorCrmRangeLabel,
  INVESTOR_CRM2_FROM,
  INVESTOR_CRM2_ORDERS,
  INVESTOR_CRM2_TO,
  investorCrm2SalesInRange,
  investorCrm2Stats,
} from "@/lib/investor-fake-crm"
import {
  formatInvestorCrore,
  formatInvestorRs,
  investorPayoutSummary,
  investorRoiRangeLabel,
  INVESTOR_SALES_POOL_RATE,
  normalizeInvestorInvestedAt,
  normalizeInvestorRoiPeriod,
} from "@/lib/investor-payout"

export function InvestorDashboardView() {
  const { user, refreshUser } = useAuth()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const bookStats = useMemo(() => investorCrm2Stats(), [])
  const [fromDate, setFromDate] = useState(INVESTOR_CRM2_FROM)
  const [toDate, setToDate] = useState(INVESTOR_CRM2_TO)

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const from = fromDate || INVESTOR_CRM2_FROM
  const to = toDate || INVESTOR_CRM2_TO
  const rangeSales = useMemo(() => investorCrm2SalesInRange(from, to), [from, to])
  const rangeLabel = formatInvestorCrmRangeLabel(from, to)
  // ROI sales window is the same for every investor: 1 Jul → till Oct.
  const bookSales = useMemo(
    () => investorCrm2SalesInRange(INVESTOR_CRM2_FROM, INVESTOR_CRM2_TO),
    [],
  )
  const bookSalesLabel = formatInvestorCrmRangeLabel(INVESTOR_CRM2_FROM, INVESTOR_CRM2_TO)

  const byDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of INVESTOR_CRM2_ORDERS) {
      if (o.date < from || o.date > to) continue
      map.set(o.date, (map.get(o.date) || 0) + o.total)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        amount,
      }))
  }, [from, to])

  const investment = Number(user?.investorInvestment) || 0
  const poolShare = Number(user?.investorRoiPercent) || 0
  const investPeriod = normalizeInvestorRoiPeriod(user?.investorRoiPeriod)
  const investedAt = normalizeInvestorInvestedAt(user?.investorInvestedAt)
  const investedUntil = normalizeInvestorInvestedAt(user?.investorInvestedUntil)
  const investLabel = investorRoiRangeLabel(investedAt, investPeriod, investedUntil)
  const summary = investorPayoutSummary({
    investment,
    poolSharePercent: poolShare,
    salesAmount: bookSales,
    salesLabel: bookSalesLabel,
  })

  const axisFill = isDark ? "#a3a3a3" : "#737373"
  const gridStroke = isDark ? "#404040" : "#e5e7eb"
  const tipBg = isDark ? "#171717" : "#ffffff"
  const tipBorder = isDark ? "rgba(26,159,154,0.35)" : "rgba(26,159,154,0.2)"
  const tipColor = isDark ? "#f5f5f5" : "#171717"

  return (
    <>
      <Topbar title="Dashboard" description="Your returns" />
      <div className="flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(26,159,154,0.10)_0%,hsl(var(--background))_32%)] dark:bg-[linear-gradient(180deg,rgba(26,159,154,0.14)_0%,hsl(var(--background))_36%)]">
        <div className="mx-auto max-w-6xl space-y-5 p-3 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1a9f9a]">
                Voltrix investor
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-3xl">
                {summary.configured ? formatInvestorRs(summary.due) : "Your returns"}
              </h1>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Sales {bookSalesLabel}
                {investedAt && investedUntil ? ` · Invested ${investLabel}` : ""}
              </p>
            </motion.div>
            <InvestorDateFilter
              fromDate={fromDate}
              toDate={toDate}
              onFromChange={setFromDate}
              onToChange={setToDate}
              onClear={() => {
                setFromDate(INVESTOR_CRM2_FROM)
                setToDate(INVESTOR_CRM2_TO)
              }}
              rangeLabel={rangeLabel}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="grid grid-cols-2 gap-2 md:grid-cols-5"
          >
            <Metric label="Invested" value={formatInvestorRs(investment)} />
            <Metric label="Pool share" value={`${poolShare || 0}%`} />
            <Metric label="Invest period" value={investedAt && investedUntil ? investLabel : "—"} />
            <Metric label="Sales (Jul–Oct)" value={`${formatInvestorCrore(bookSales)} PKR`} />
            <Metric
              label="You receive"
              value={summary.configured ? formatInvestorRs(summary.due) : "—"}
              accent
            />
          </motion.div>

          {summary.configured && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-[#1a9f9a]/20 bg-[hsl(var(--card))]/90 px-4 py-3 text-xs text-[hsl(var(--muted-foreground))] backdrop-blur"
            >
              {formatInvestorCrore(bookSales)} × {INVESTOR_SALES_POOL_RATE}% × {poolShare}% ={" "}
              <span className="font-semibold text-[#1a9f9a]">{formatInvestorRs(summary.due)}</span>
              {investedAt && investedUntil ? (
                <span className="block mt-1">Your investment period: {investLabel}</span>
              ) : null}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm sm:p-5"
          >
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1a9f9a]">
                  Daily sales
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Delivered volume in range</p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">
                {formatInvestorCrore(rangeSales)} Cr
              </p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byDay} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="investorSalesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1a9f9a" stopOpacity={isDark ? 0.35 : 0.45} />
                      <stop offset="100%" stopColor="#1a9f9a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={gridStroke} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: axisFill }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: axisFill }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => {
                      const n = Number(v) || 0
                      if (n <= 0) return ""
                      if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`
                      return `${Math.round(n / 100_000) / 10}M`
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${tipBorder}`,
                      background: tipBg,
                      color: tipColor,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                    }}
                    labelStyle={{ color: tipColor }}
                    formatter={(v) => [formatInvestorRs(Number(v ?? 0)), "Sales"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#1a9f9a"
                    strokeWidth={2.5}
                    fill="url(#investorSalesFill)"
                    animationDuration={900}
                    animationEasing="ease-out"
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: "#1a9f9a",
                      stroke: isDark ? "#171717" : "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="grid grid-cols-2 gap-2 md:grid-cols-5"
          >
            <Metric label="July" value={formatInvestorRs(bookStats.jul)} compact />
            <Metric label="August" value={formatInvestorRs(bookStats.aug)} compact />
            <Metric label="September" value={formatInvestorRs(bookStats.sep)} compact />
            <Metric label="October" value={formatInvestorRs(bookStats.oct)} compact />
            <Metric label="Orders" value={String(bookStats.orderCount)} compact />
          </motion.div>
        </div>
      </div>
    </>
  )
}

function Metric({
  label,
  value,
  accent,
  compact,
}: {
  label: string
  value: string
  accent?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        accent
          ? "border-[#1a9f9a]/40 bg-[#1a9f9a] text-white shadow-md shadow-[#1a9f9a]/25"
          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]"
      } ${compact ? "py-2.5" : ""}`}
    >
      <p
        className={`text-[10px] uppercase tracking-wide ${
          accent ? "text-white/75" : "text-[hsl(var(--muted-foreground))]"
        }`}
      >
        {label}
      </p>
      <p className={`mt-1 font-semibold tabular-nums ${compact ? "text-sm" : "text-base"}`}>{value}</p>
    </div>
  )
}
