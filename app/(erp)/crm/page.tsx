"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { ClientsList } from "@/components/crm/clients-list"
import { LeadsManager } from "@/components/crm/leads-manager"
import { OrdersList } from "@/components/crm/orders-list"
import { QuotationsList } from "@/components/crm/quotations-list"
import { CrmProductPricesManager } from "@/components/crm/crm-product-prices-manager"
import { useAuth } from "@/components/auth-provider"
import { isSalesAgentUser, crmWorkspaceForUser } from "@/lib/crm-workspace"
import { isErpAdmin } from "@/lib/auth"
import { cn } from "@/lib/utils"

type CrmTab = "orders" | "quotations" | "clients" | "leads" | "prices"

export default function CRMPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const workspace = crmWorkspaceForUser(user)
  const isAdmin = isErpAdmin(user?.role)
  const [tab, setTab] = useState<CrmTab>("orders")
  const [visited, setVisited] = useState<Set<CrmTab>>(() => new Set(["orders"]))

  useEffect(() => {
    if (user && isSalesAgentUser(user)) {
      router.replace("/crm/sales-agents")
    }
  }, [user, router])

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("crm-lead-detail-id")) {
      selectTab("leads")
      return
    }
    const t = searchParams?.get("tab")
    if (t === "orders" || t === "quotations" || t === "clients" || t === "leads" || t === "prices") {
      if (t === "prices" && !isAdmin) {
        selectTab("orders")
        return
      }
      selectTab(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isAdmin])

  function selectTab(next: CrmTab) {
    setTab(next)
    setVisited((prev) => {
      if (prev.has(next)) return prev
      const copy = new Set(prev)
      copy.add(next)
      return copy
    })
  }

  const tabs: { id: CrmTab; label: string; shortLabel: string; adminOnly?: boolean }[] = [
    { id: "orders", label: "Orders", shortLabel: "Orders" },
    { id: "quotations", label: "Quotations", shortLabel: "Quotes" },
    { id: "clients", label: "Clients", shortLabel: "Clients" },
    { id: "leads", label: "Leads", shortLabel: "Leads" },
    { id: "prices", label: "Product Prices", shortLabel: "Prices", adminOnly: true },
  ]

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin)

  return (
    <ModuleGuard module="crm">
      <Topbar title="Customer relationship management" />

      <div className="flex-1 overflow-auto bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
        <div className="mx-auto w-full max-w-[1180px] px-4 pt-1.5 pb-5 sm:px-6 sm:pt-2 sm:pb-6 space-y-1">
          <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-1 bg-[#f5f5f7]/90 dark:bg-[hsl(var(--background))]/90 backdrop-blur-xl">
            <div className="inline-flex max-w-full items-center rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px] overflow-x-auto scrollbar-none">
              {visibleTabs.map((t) => {
                const selected = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTab(t.id)}
                    className={cn(
                      "shrink-0 px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-colors duration-150 cursor-pointer",
                      selected
                        ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                        : "text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] hover:text-[#1d1d1f] dark:hover:text-[hsl(var(--foreground))]",
                    )}
                  >
                    <span className="sm:hidden">{t.shortLabel}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="relative min-w-0 overflow-x-hidden">
            {visited.has("orders") && (
              <div className={tab === "orders" ? "relative block" : "hidden"} aria-hidden={tab !== "orders"}>
                <OrdersList currentUser={user?.name || "Unknown"} currentUserId={user?.id} workspace={workspace} />
              </div>
            )}
            {visited.has("quotations") && (
              <div className={tab === "quotations" ? "relative block" : "hidden"} aria-hidden={tab !== "quotations"}>
                <QuotationsList currentUser={user?.name || "Unknown"} currentUserId={user?.id} workspace={workspace} />
              </div>
            )}
            {visited.has("clients") && (
              <div className={tab === "clients" ? "relative block" : "hidden"} aria-hidden={tab !== "clients"}>
                <ClientsList currentUser={user?.name || "Unknown"} currentUserId={user?.id} workspace={workspace} />
              </div>
            )}
            {visited.has("leads") && (
              <div className={tab === "leads" ? "relative block" : "hidden"} aria-hidden={tab !== "leads"}>
                <LeadsManager
                  currentUser={user?.name || user?.email || "Staff"}
                  currentUserId={user?.id}
                  userRole={user?.role}
                  readOnly={!!workspace?.readOnly}
                />
              </div>
            )}
            {isAdmin && visited.has("prices") && (
              <div className={tab === "prices" ? "relative block" : "hidden"} aria-hidden={tab !== "prices"}>
                <CrmProductPricesManager
                  currentUser={user?.name || user?.email || "Staff"}
                  currentUserId={user?.id}
                  readOnly={!!workspace?.readOnly}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </ModuleGuard>
  )
}
