"use client"

import { useMemo } from "react"
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
import { investorCrm2Stats } from "@/lib/investor-fake-crm"
import {
  formatInvestorCrore,
  formatInvestorRs,
  investorPayoutDue,
  investorRoiPeriodLabel,
  normalizeInvestorRoiPeriod,
} from "@/lib/investor-payout"

export function InvestorDashboardView() {
  const { user } = useAuth()
  const stats = useMemo(() => investorCrm2Stats(), [])
  const period = normalizeInvestorRoiPeriod(user?.investorRoiPeriod)
  const investment = Number(user?.investorInvestment) || 0
  const roi = Number(user?.investorRoiPercent) || 0
  const due = investorPayoutDue(investment, roi, period)
  const configured = investment > 0 && roi > 0
  const periodScale =
    period === "3m" ? " × 3/12" : period === "6m" ? " × 6/12" : ""

  return (
    <>
      <Topbar title="Company progress" description="Investor dashboard" />
      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4 max-w-6xl">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Welcome{user?.name ? `, ${user.name}` : ""}. Sales below are the CRM 2 book shared with all investors.
        </p>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1a9f9a]">Your returns</p>
          {configured ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <PayStat label="Your investment" value={formatInvestorRs(investment)} />
                <PayStat label="ROI" value={`${roi}% annual`} />
                <PayStat label="Period" value={investorRoiPeriodLabel(period)} />
                <PayStat label="You receive" value={formatInvestorRs(due)} accent />
              </div>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                You receive = investment × {roi}%{periodScale} for this {investorRoiPeriodLabel(period).toLowerCase()} term.
                CRM 2 sales are company figures only and do not change your payout.
              </p>
            </>
          ) : (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Your investment and ROI have not been set yet. Voltrix will enter them in Manage Users; they will
              appear here for your login only.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <PayStat label="CRM 2 sales" value={`${formatInvestorCrore(stats.total)} PKR`} />
          <PayStat label="August" value={formatInvestorRs(stats.aug)} />
          <PayStat label="September" value={formatInvestorRs(stats.sep)} />
          <PayStat label="Paid orders" value={String(stats.orderCount)} />
        </div>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-3 h-72">
          <p className="text-xs font-medium mb-2">Daily delivered sales</p>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={stats.byDay} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="investorSalesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a9f9a" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1a9f9a" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
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
    <div className={`rounded-lg border px-3 py-2 ${accent ? "border-[#1a9f9a] bg-[#1a9f9a]/5" : "bg-[hsl(var(--card))]"}`}>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent ? "text-[#1a9f9a]" : ""}`}>{value}</p>
    </div>
  )
}
