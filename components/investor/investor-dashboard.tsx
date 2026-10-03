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
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
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
  INVESTOR_SALES_POOL_RATE,
} from "@/lib/investor-payout"

export function InvestorDashboardView() {
  const { user, refreshUser } = useAuth()
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
  const summary = investorPayoutSummary({
    investment,
    poolSharePercent: poolShare,
    salesAmount: rangeSales,
    salesLabel: rangeLabel,
  })

  function clearRange() {
    setFromDate(INVESTOR_CRM2_FROM)
    setToDate(INVESTOR_CRM2_TO)
  }

  return (
    <>
      <Topbar title="Your returns" description="Personal investment summary" />
      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2 sm:gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              min={INVESTOR_CRM2_FROM}
              max={INVESTOR_CRM2_TO}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">
              To
            </label>
            <input
              type="date"
              value={toDate}
              min={INVESTOR_CRM2_FROM}
              max={INVESTOR_CRM2_TO}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={clearRange}
            className="h-8 px-3 rounded-md border text-xs font-medium hover:bg-[hsl(var(--muted))]/40 cursor-pointer"
          >
            All dates
          </button>
        </div>

        <div className="rounded-xl border border-[#1a9f9a]/35 bg-[hsl(var(--card))] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1a9f9a]">
                Your ROI
              </p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                {user?.name ? `${user.name} · ` : ""}
                Sales in selected range × {INVESTOR_SALES_POOL_RATE}% × your pool share
              </p>
            </div>
            {summary.configured && (
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-[#1a9f9a]">
                {formatInvestorRs(summary.due)}
              </p>
            )}
          </div>

          {summary.configured ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <PayStat label="Invested" value={formatInvestorRs(investment)} />
                <PayStat label="Pool share" value={`${poolShare}%`} />
                <PayStat label="Sales (range)" value={`${formatInvestorCrore(rangeSales)} PKR`} />
                <PayStat label="You receive" value={formatInvestorRs(summary.due)} accent />
              </div>
              <div className="rounded-lg border border-[#1a9f9a]/25 bg-[#1a9f9a]/5 px-3 py-2.5">
                <p className="text-sm font-semibold text-[#1a9f9a]">
                  You receive {formatInvestorRs(summary.due)}
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                  Calc ({rangeLabel}): {formatInvestorCrore(rangeSales)} × {INVESTOR_SALES_POOL_RATE}% ×{" "}
                  {poolShare}% = {formatInvestorRs(summary.due)}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Your investment amount and pool share are not set yet. Ask Voltrix to set them in Manage
              Users.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Company CRM sales · {bookStats.periodLabel}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <PayStat label="Total sales" value={`${formatInvestorCrore(bookStats.total)} PKR`} />
            <PayStat label="July" value={formatInvestorRs(bookStats.jul)} />
            <PayStat label="August" value={formatInvestorRs(bookStats.aug)} />
            <PayStat label="September" value={formatInvestorRs(bookStats.sep)} />
            <PayStat label="October (to date)" value={formatInvestorRs(bookStats.oct)} />
            <PayStat label="Orders" value={String(bookStats.orderCount)} />
          </div>
        </div>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-3 h-72">
          <p className="text-xs font-medium mb-2">Daily delivered sales ({rangeLabel})</p>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={byDay} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="investorSalesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a9f9a" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1a9f9a" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}M`}
              />
              <Tooltip formatter={(v) => formatInvestorRs(Number(v ?? 0))} />
              <Area type="monotone" dataKey="amount" stroke="#1a9f9a" strokeWidth={2} fill="url(#investorSalesFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}

function PayStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${accent ? "border-[#1a9f9a] bg-[#1a9f9a]/5" : "bg-[hsl(var(--card))]"}`}
    >
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent ? "text-[#1a9f9a]" : ""}`}>{value}</p>
    </div>
  )
}
