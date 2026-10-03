"use client"

import { useMemo, useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import {
  INVESTOR_CRM2_FROM,
  INVESTOR_CRM2_ORDERS,
  INVESTOR_CRM2_TO,
} from "@/lib/investor-fake-crm"
import { formatInvestorCrore, formatInvestorRs } from "@/lib/investor-payout"

export function InvestorCrm2View() {
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

  function clearRange() {
    setFromDate(INVESTOR_CRM2_FROM)
    setToDate(INVESTOR_CRM2_TO)
  }

  return (
    <>
      <Topbar title="CRM Investor" description="Sales book" />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-6 max-w-6xl space-y-4" data-readonly-allow>
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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Stat label="Sales" value={`${formatInvestorCrore(stats.total)} PKR`} />
            <Stat label="Orders" value={String(stats.orderCount)} />
            <Stat
              label="Outstanding"
              value={`${formatInvestorCrore(stats.outstanding)} PKR`}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(var(--muted))]/50 text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Order</th>
                  <th className="text-left font-medium px-3 py-2">Date</th>
                  <th className="text-left font-medium px-3 py-2">Client</th>
                  <th className="text-left font-medium px-3 py-2">Items</th>
                  <th className="text-right font-medium px-3 py-2">Amount</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">
                      No orders in this date range.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const credit = o.payment === "outstanding"
                    return (
                      <tr key={o.orderNumber} className="border-t">
                        <td className="px-3 py-2 font-mono font-medium">{o.orderNumber}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{o.date}</td>
                        <td className="px-3 py-2">{o.clientName}</td>
                        <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                          {o.items.map((it) => `${it.qty}× ${it.product}`).join("; ")}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatInvestorRs(o.total)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              credit
                                ? "text-amber-800 bg-amber-50"
                                : "text-emerald-700 bg-emerald-50"
                            }`}
                          >
                            {credit ? "Outstanding · Credit" : "Paid · Delivered"}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-[hsl(var(--muted))]/40">
                  <td className="px-3 py-2 font-semibold" colSpan={4}>
                    Total
                    {stats.outstandingCount > 0 && (
                      <span className="ml-2 font-normal text-[hsl(var(--muted-foreground))]">
                        · {stats.outstandingCount} on credit
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {formatInvestorRs(stats.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2">
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  )
}
