"use client"

import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { InvestorDateFilter } from "@/components/investor/investor-date-filter"
import {
  formatInvestorCrmRangeLabel,
  INVESTOR_CRM2_FROM,
  INVESTOR_CRM2_ORDERS,
  INVESTOR_CRM2_TO,
} from "@/lib/investor-fake-crm"
import {
  formatInvestorCrore,
  formatInvestorRs,
  investorPayoutSummary,
  INVESTOR_SALES_POOL_RATE,
} from "@/lib/investor-payout"

export function InvestorCrm2View() {
  const { user } = useAuth()
  const [fromDate, setFromDate] = useState(INVESTOR_CRM2_FROM)
  const [toDate, setToDate] = useState(INVESTOR_CRM2_TO)

  const filteredOrders = useMemo(() => {
    const from = fromDate || INVESTOR_CRM2_FROM
    const to = toDate || INVESTOR_CRM2_TO
    return INVESTOR_CRM2_ORDERS.filter((o) => o.date >= from && o.date <= to)
  }, [fromDate, toDate])

  const stats = useMemo(() => {
    const total = filteredOrders.reduce((s, o) => s + o.total, 0)
    const outstanding = filteredOrders
      .filter((o) => o.payment === "outstanding")
      .reduce((s, o) => s + o.total, 0)
    return {
      total,
      orderCount: filteredOrders.length,
      outstanding,
      outstandingCount: filteredOrders.filter((o) => o.payment === "outstanding").length,
    }
  }, [filteredOrders])

  const rangeLabel = formatInvestorCrmRangeLabel(
    fromDate || INVESTOR_CRM2_FROM,
    toDate || INVESTOR_CRM2_TO,
  )
  const poolShare = Number(user?.investorRoiPercent) || 0
  const investment = Number(user?.investorInvestment) || 0
  const summary = investorPayoutSummary({
    investment,
    poolSharePercent: poolShare,
    salesAmount: stats.total,
    salesLabel: rangeLabel,
  })

  return (
    <>
      <Topbar title="CRM" description="Sales book" />
      <div className="flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(26,159,154,0.10)_0%,hsl(var(--background))_28%)] dark:bg-[linear-gradient(180deg,rgba(26,159,154,0.14)_0%,hsl(var(--background))_34%)]">
        <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-6" data-readonly-allow>
          <div className="flex items-start justify-between gap-3">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1a9f9a]">
                Sales book
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
                {formatInvestorCrore(stats.total)} PKR
              </h1>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{rangeLabel}</p>
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
            className="grid grid-cols-2 gap-2 md:grid-cols-4"
          >
            <Metric label="Sales" value={`${formatInvestorCrore(stats.total)} PKR`} />
            <Metric label="Orders" value={String(stats.orderCount)} />
            <Metric label="Outstanding" value={`${formatInvestorCrore(stats.outstanding)} PKR`} />
            <Metric
              label="Your ROI"
              value={summary.configured ? formatInvestorRs(summary.due) : "—"}
              accent
            />
          </motion.div>

          {summary.configured && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {formatInvestorCrore(stats.total)} × {INVESTOR_SALES_POOL_RATE}% × {poolShare}% ={" "}
              <span className="font-semibold text-[#1a9f9a]">{formatInvestorRs(summary.due)}</span>
            </p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] bg-[#1a9f9a]/5 text-left text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] dark:bg-[#1a9f9a]/10">
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Client</th>
                    <th className="px-3 py-3 font-semibold">Items</th>
                    <th className="px-3 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[hsl(var(--muted-foreground))]">
                        No orders in this date range.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o, idx) => {
                      const credit = o.payment === "outstanding"
                      return (
                        <motion.tr
                          key={o.orderNumber}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: Math.min(idx * 0.012, 0.35) }}
                          className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[#1a9f9a]/5"
                        >
                          <td className="px-4 py-2.5 font-mono text-[11px] font-medium text-[hsl(var(--foreground))]">
                            {o.orderNumber}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[hsl(var(--muted-foreground))]">
                            {o.date}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-[hsl(var(--foreground))]">
                            {o.clientName}
                          </td>
                          <td className="max-w-[280px] truncate px-3 py-2.5 text-[hsl(var(--muted-foreground))]">
                            {o.items.map((it) => `${it.qty}× ${it.product}`).join("; ")}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[hsl(var(--foreground))]">
                            {formatInvestorRs(o.total)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                credit
                                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                                  : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                              }`}
                            >
                              {credit ? "Credit" : "Paid"}
                            </span>
                          </td>
                        </motion.tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1a9f9a]/10 dark:bg-[#1a9f9a]/15">
                    <td className="px-4 py-3 font-semibold text-[hsl(var(--foreground))]" colSpan={4}>
                      Total
                      {stats.outstandingCount > 0 && (
                        <span className="ml-2 font-normal text-[hsl(var(--muted-foreground))]">
                          · {stats.outstandingCount} on credit
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-[#1a9f9a]">
                      {formatInvestorRs(stats.total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
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
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        accent
          ? "border-[#1a9f9a]/40 bg-[#1a9f9a] text-white shadow-md shadow-[#1a9f9a]/25"
          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]"
      }`}
    >
      <p
        className={`text-[10px] uppercase tracking-wide ${
          accent ? "text-white/75" : "text-[hsl(var(--muted-foreground))]"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums sm:text-base">{value}</p>
    </div>
  )
}
