"use client"

import { useMemo, useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import {
  INVESTOR_CRM2_FROM,
  INVESTOR_CRM2_ORDERS,
  INVESTOR_CRM2_TO,
  investorCrm2Clients,
  investorCrm2Stats,
} from "@/lib/investor-fake-crm"
import { formatInvestorCrore, formatInvestorRs } from "@/lib/investor-payout"

export function InvestorCrm2View() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"orders" | "clients">("orders")
  const stats = useMemo(() => investorCrm2Stats(), [])
  const clients = useMemo(() => investorCrm2Clients(), [])

  const tabClass = (active: boolean) =>
    `px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
      active
        ? "text-[hsl(var(--foreground))]"
        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    }`

  return (
    <>
      <Topbar title="CRM 2" description="Investor sales book — Aug–Sep 2026" />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-6 max-w-6xl space-y-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Signed in as {user?.name}. This sales book is the same for every investor.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Sales (2 months)" value={`${formatInvestorCrore(stats.total)} PKR`} />
            <Stat label="Orders" value={String(stats.orderCount)} />
            <Stat label="Clients" value={String(stats.clientCount)} />
            <Stat label="Period" value="1 Aug – 22 Sep 2026" />
          </div>

          <div className="flex items-center gap-1 border-b overflow-x-auto">
            <button type="button" onClick={() => setTab("orders")} className={tabClass(tab === "orders")}>
              Sales orders
              {tab === "orders" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
            </button>
            <button type="button" onClick={() => setTab("clients")} className={tabClass(tab === "clients")}>
              Clients
              {tab === "clients" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
            </button>
          </div>

          {tab === "orders" && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-[hsl(var(--muted))]/50 text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Order</th>
                    <th className="text-left font-medium px-3 py-2">Date</th>
                    <th className="text-left font-medium px-3 py-2">Client</th>
                    <th className="text-left font-medium px-3 py-2">City</th>
                    <th className="text-left font-medium px-3 py-2">Items</th>
                    <th className="text-right font-medium px-3 py-2">Amount</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {INVESTOR_CRM2_ORDERS.map((o) => (
                    <tr key={o.orderNumber} className="border-t">
                      <td className="px-3 py-2 font-mono font-medium">{o.orderNumber}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.date}</td>
                      <td className="px-3 py-2">{o.clientName}</td>
                      <td className="px-3 py-2">{o.city}</td>
                      <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                        {o.items.map((it) => `${it.qty}× ${it.product}`).join("; ")}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatInvestorRs(o.total)}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Paid · Delivered
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-[hsl(var(--muted))]/40">
                    <td className="px-3 py-2 font-semibold" colSpan={5}>
                      Total ({INVESTOR_CRM2_FROM} to {INVESTOR_CRM2_TO})
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{formatInvestorRs(stats.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {tab === "clients" && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-[hsl(var(--muted))]/50 text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Client</th>
                    <th className="text-left font-medium px-3 py-2">City</th>
                    <th className="text-left font-medium px-3 py-2">Phone</th>
                    <th className="text-right font-medium px-3 py-2">Orders</th>
                    <th className="text-right font-medium px-3 py-2">Purchased</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={`${c.name}-${c.city}`} className="border-t">
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2">{c.city}</td>
                      <td className="px-3 py-2 font-mono">{c.phone}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.orders}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatInvestorRs(c.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
