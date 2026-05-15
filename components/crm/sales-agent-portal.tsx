"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchSalesAgents, fetchCommissionSummary, type SalesAgentProfile, type CommissionSummary } from "@/lib/sales-agents"
import type { User } from "@/lib/auth"
import type { CrmWorkspaceScope } from "@/lib/crm-workspace"
import { ClientsList } from "@/components/crm/clients-list"
import { OrdersList } from "@/components/crm/orders-list"
import { QuotationsList } from "@/components/crm/quotations-list"
import { useToast } from "@/components/ui/toast"
import { DollarSign, FileText, Package, Users } from "lucide-react"

type PortalTab = "home" | "clients" | "quotations" | "orders" | "commission"

type Props = {
  user: User
}

function formatMoney(n: number) {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

export function SalesAgentPortal({ user }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<PortalTab>("home")
  const [profile, setProfile] = useState<SalesAgentProfile | null>(null)
  const [commission, setCommission] = useState<CommissionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const workspace: CrmWorkspaceScope = {
    mode: "sales_agent",
    ownerUserId: user.id,
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const agents = await fetchSalesAgents({ withStats: true })
      const me = agents.find(a => a.id === user.id) ?? null
      setProfile(me)
      const summaries = await fetchCommissionSummary({ agentId: user.id })
      setCommission(summaries[0] ?? null)
    } catch {
      toast({ title: "Error", message: "Failed to load your profile.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [user.id, toast])

  useEffect(() => {
    load()
  }, [load])

  const tabs: Array<{ key: PortalTab; label: string; icon: typeof Users }> = [
    { key: "home", label: "Home", icon: DollarSign },
    { key: "clients", label: "Clients", icon: Users },
    { key: "quotations", label: "Quotes", icon: FileText },
    { key: "orders", label: "Orders", icon: Package },
    { key: "commission", label: "Commission", icon: DollarSign },
  ]

  return (
    <div className="flex flex-col min-h-0 -mx-2 sm:mx-0">
      <div className="sticky top-0 z-10 bg-[hsl(var(--background))] border-b px-2 pb-2">
        <p className="text-sm font-semibold px-1 pt-1">Hi, {user.name}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] px-1 pb-2">
          {profile?.location || "Sales agent"} · {profile?.commissionPercent ?? 0}% per delivered order
        </p>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
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

      <div className="flex-1 overflow-auto px-2 py-4 space-y-4">
        {loading && tab === "home" && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</p>
        )}

        {tab === "home" && !loading && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 col-span-2 bg-[#1faca6]/10 border-[#1faca6]/30">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Commission earned (delivered)</p>
              <p className="text-xl font-bold text-[#1faca6] mt-1">
                {formatMoney(profile?.stats?.commissionEarned ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Clients</p>
              <p className="text-lg font-semibold mt-1">{profile?.stats?.clients ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Quotations</p>
              <p className="text-lg font-semibold mt-1">{profile?.stats?.quotations ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Orders</p>
              <p className="text-lg font-semibold mt-1">{profile?.stats?.orders ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Pending approval</p>
              <p className="text-lg font-semibold mt-1">{profile?.stats?.pendingOrders ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3 col-span-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Delivered sales</p>
              <p className="text-lg font-semibold mt-1">{formatMoney(profile?.stats?.totalSales ?? 0)}</p>
            </div>
            <p className="col-span-2 text-xs text-[hsl(var(--muted-foreground))]">
              Clients are active immediately. Quotations stay as draft until you send them. Orders and
              quotation conversions need admin approval. Commission is calculated when an order is marked
              delivered.
            </p>
          </div>
        )}

        {tab === "clients" && (
          <ClientsList currentUser={user.name} currentUserId={user.id} workspace={workspace} />
        )}
        {tab === "quotations" && (
          <QuotationsList currentUser={user.name} currentUserId={user.id} workspace={workspace} />
        )}
        {tab === "orders" && (
          <OrdersList currentUser={user.name} currentUserId={user.id} workspace={workspace} />
        )}

        {tab === "commission" && (
          <div className="space-y-3">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Total commission (delivered)</p>
              <p className="text-2xl font-bold text-[#1faca6] mt-1">
                {formatMoney(commission?.commissionEarned ?? profile?.stats?.commissionEarned ?? 0)}
              </p>
              <p className="text-xs mt-2 text-[hsl(var(--muted-foreground))]">
                {commission?.deliveredOrderCount ?? profile?.stats?.deliveredOrders ?? 0} delivered orders
              </p>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <p className="px-3 py-2 text-xs font-medium border-b bg-[hsl(var(--muted))]/20">
                Your orders
              </p>
              {!commission?.orders?.length ? (
                <p className="p-4 text-xs text-[hsl(var(--muted-foreground))]">No orders yet.</p>
              ) : (
                <ul className="divide-y max-h-[50vh] overflow-y-auto">
                  {commission.orders.map(o => (
                    <li key={o.id} className="px-3 py-2.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{o.orderNumber}</span>
                        <span className="capitalize text-[hsl(var(--muted-foreground))]">
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[hsl(var(--muted-foreground))] mt-0.5">{o.clientName}</p>
                      <div className="flex justify-between mt-1">
                        <span>{formatMoney(o.total)}</span>
                        {o.status === "delivered" && o.commissionAmount != null ? (
                          <span className="text-[#1faca6] font-medium">
                            +{formatMoney(o.commissionAmount)}
                          </span>
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

