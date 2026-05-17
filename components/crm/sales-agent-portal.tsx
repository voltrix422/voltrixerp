"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchSalesAgents, fetchPortalSummary, type PortalSummary } from "@/lib/sales-agents"
import type { User } from "@/lib/auth"
import type { CrmWorkspaceScope } from "@/lib/crm-workspace"
import { ClientsList } from "@/components/crm/clients-list"
import { OrdersList } from "@/components/crm/orders-list"
import { QuotationsList } from "@/components/crm/quotations-list"
import { useToast } from "@/components/ui/toast"
import { SalesDateRangePanel } from "@/components/crm/sales-date-range-panel"
import { DollarSign, FileText, Package, Users } from "lucide-react"

type PortalTab = "home" | "clients" | "quotations" | "orders" | "commission"

type Props = {
  user: User
}

function formatMoney(n: number) {
  return `Rs ${(n ?? 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function defaultFromDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export function SalesAgentPortal({ user }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<PortalTab>("home")
  const [summary, setSummary] = useState<PortalSummary | null>(null)
  const [commissionPercent, setCommissionPercent] = useState(0)
  const [location, setLocation] = useState("")
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [dateFrom, setDateFrom] = useState(defaultFromDate)
  const [dateTo, setDateTo] = useState(todayDate)
  const [appliedFrom, setAppliedFrom] = useState(defaultFromDate)
  const [appliedTo, setAppliedTo] = useState(todayDate)

  const workspace: CrmWorkspaceScope = {
    mode: "sales_agent",
    ownerUserId: user.id,
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [agents, portal] = await Promise.all([
        fetchSalesAgents({ withStats: false }),
        fetchPortalSummary({
          agentId: user.id,
          from: appliedFrom || undefined,
          to: appliedTo || undefined,
        }),
      ])
      const me = agents.find(a => a.id === user.id)
      setCommissionPercent(me?.commissionPercent ?? portal.commissionPercent ?? 0)
      setLocation(me?.location || portal.location || "")
      setSummary(portal)
    } catch {
      toast({ title: "Error", message: "Failed to load your data.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [user.id, appliedFrom, appliedTo, toast])

  useEffect(() => {
    load()
  }, [load])

  function applyDates() {
    setAppliedFrom(dateFrom)
    setAppliedTo(dateTo)
  }

  function clearDates() {
    setDateFrom("")
    setDateTo("")
    setAppliedFrom("")
    setAppliedTo("")
  }

  async function exportPdf() {
    if (!summary) return
    setExporting(true)
    try {
      const { downloadSalesAgentReportPDF } = await import("@/lib/generate-sales-agent-report-pdf")
      await downloadSalesAgentReportPDF(summary)
      toast({ title: "Downloaded", message: "Performance report saved as PDF.", type: "success" })
    } catch {
      toast({ title: "Error", message: "Could not generate PDF.", type: "error" })
    } finally {
      setExporting(false)
    }
  }

  const tabs: Array<{ key: PortalTab; label: string; icon: typeof Users }> = [
    { key: "home", label: "Home", icon: DollarSign },
    { key: "clients", label: "Clients", icon: Users },
    { key: "quotations", label: "Quotes", icon: FileText },
    { key: "orders", label: "Orders", icon: Package },
    { key: "commission", label: "Commission", icon: DollarSign },
  ]

  const showDateBar = tab === "home" || tab === "commission"
  const s = summary

  return (
    <div className="flex flex-col min-h-0 -mx-2 sm:mx-0">
      <div className="sticky top-0 z-10 bg-[hsl(var(--background))] border-b px-2 pb-2">
        <p className="text-sm font-semibold px-1 pt-1">Hi, {user.name}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] px-1 pb-2">
          {location || "Sales agent"} · {commissionPercent}% per delivered order
        </p>
        <div className="flex flex-wrap gap-1.5 pb-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                tab === key
                  ? "bg-[#1faca6] text-white"
                  : "bg-[hsl(var(--muted))]/50 text-[hsl(var(--muted-foreground))]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 py-3 space-y-3 max-w-full overflow-x-hidden">
        {showDateBar && (
          <SalesDateRangePanel
            dateFrom={dateFrom}
            dateTo={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            onApply={applyDates}
            onClear={clearDates}
            onExport={exportPdf}
            loading={loading}
            exporting={exporting}
            showExport
            defaultOpen={false}
            subtitle="Performance stats & PDF export"
          />
        )}

        {loading && (tab === "home" || tab === "commission") && (
          <p className="text-sm text-[hsl(var(--muted-foreground))] px-1">Loading…</p>
        )}

        {tab === "home" && !loading && s && (
          <div className="grid grid-cols-2 gap-3">
            {(appliedFrom || appliedTo) && (
              <p className="col-span-2 text-[10px] text-center text-[hsl(var(--muted-foreground))] -mb-1">
                {appliedFrom && appliedTo
                  ? `${appliedFrom} → ${appliedTo}`
                  : appliedFrom
                    ? `From ${appliedFrom}`
                    : `Until ${appliedTo}`}
              </p>
            )}
            <div className="rounded-lg border p-3 col-span-2 bg-[#1faca6]/10 border-[#1faca6]/30">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Commission earned (delivered)</p>
              <p className="text-xl font-bold text-[#1faca6] mt-1">{formatMoney(s.commissionEarned)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Clients</p>
              <p className="text-lg font-semibold mt-1">{s.clients}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Quotations</p>
              <p className="text-lg font-semibold mt-1">{s.quotations}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatMoney(s.quotationsValue)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Orders</p>
              <p className="text-lg font-semibold mt-1">{s.orderCount}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatMoney(s.ordersValue)} pipeline</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Pending approval</p>
              <p className="text-lg font-semibold mt-1">{s.pendingOrders}</p>
            </div>
            <div className="rounded-lg border p-3 col-span-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Delivered sales</p>
              <p className="text-lg font-semibold mt-1">{formatMoney(s.totalSales)}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.deliveredOrders} delivered orders</p>
            </div>
            <p className="col-span-2 text-xs text-[hsl(var(--muted-foreground))]">
              Stats respect the date range above. Commission is counted on delivered orders only.
            </p>
          </div>
        )}

        {tab === "clients" && (
          <ClientsList currentUser={user.name} currentUserId={user.id} workspace={workspace} />
        )}
        {tab === "quotations" && (
          <QuotationsList
            currentUser={user.name}
            currentUserId={user.id}
            workspace={workspace}
            agentDisplayName={user.name}
          />
        )}
        {tab === "orders" && (
          <OrdersList currentUser={user.name} currentUserId={user.id} workspace={workspace} />
        )}

        {tab === "commission" && !loading && s && (
          <div className="space-y-3">
            <div className="rounded-lg border p-4 bg-[#1faca6]/5">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Total commission (delivered)</p>
              <p className="text-2xl font-bold text-[#1faca6] mt-1">{formatMoney(s.commissionEarned)}</p>
              <p className="text-xs mt-2 text-[hsl(var(--muted-foreground))]">
                {s.deliveredOrders} delivered · {formatMoney(s.totalSales)} sales
              </p>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <p className="px-3 py-2 text-xs font-medium border-b bg-[hsl(var(--muted))]/20">Your orders</p>
              {!s.orderRows.length ? (
                <p className="p-4 text-xs text-[hsl(var(--muted-foreground))]">No orders in this period.</p>
              ) : (
                <ul className="divide-y max-h-[50vh] overflow-y-auto">
                  {s.orderRows.map(o => (
                    <li key={o.id} className="px-3 py-2.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{o.orderNumber}</span>
                        <span className="capitalize text-[hsl(var(--muted-foreground))]">
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[hsl(var(--muted-foreground))] mt-0.5">
                        {o.clientName} · {new Date(o.createdAt).toLocaleDateString("en-PK")}
                      </p>
                      <div className="flex justify-between mt-1">
                        <span>{formatMoney(o.total)}</span>
                        {o.status === "delivered" && o.commissionAmount != null ? (
                          <span className="text-[#1faca6] font-medium">+{formatMoney(o.commissionAmount)}</span>
                        ) : (
                          <span className="text-[hsl(var(--muted-foreground))]">Pending delivery</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
