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

type CrmTab = "orders" | "quotations" | "clients" | "leads" | "prices"

export default function CRMPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const workspace = crmWorkspaceForUser(user)
  const isAdmin = isErpAdmin(user?.role)
  const [tab, setTab] = useState<CrmTab>("orders")

  useEffect(() => {
    if (user && isSalesAgentUser(user)) {
      router.replace("/crm/sales-agents")
    }
  }, [user, router])

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("crm-lead-detail-id")) {
      setTab("leads")
      return
    }
    const t = searchParams?.get("tab")
    if (t === "orders" || t === "quotations" || t === "clients" || t === "leads" || t === "prices") {
      if (t === "prices" && !isAdmin) {
        setTab("orders")
        return
      }
      setTab(t)
    }
  }, [searchParams, isAdmin])

  const tabs: { id: CrmTab; label: string; adminOnly?: boolean }[] = [
    { id: "orders", label: "Orders" },
    { id: "quotations", label: "Quotations" },
    { id: "clients", label: "Clients" },
    { id: "leads", label: "Leads" },
    { id: "prices", label: "Product Prices", adminOnly: true },
  ]

  return (
    <ModuleGuard module="crm">
      <Topbar title="Customer relationship management" />

      <div className="flex-1 overflow-auto">
        <div className={`p-3 sm:p-6 w-full min-w-0 ${tab === "orders" ? "max-w-[1400px]" : "max-w-6xl"}`}>
          <div className="flex items-center gap-1 border-b mb-4 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none">
            {tabs
              .filter((t) => !t.adminOnly || isAdmin)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
                    tab === t.id
                      ? "text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  {t.label}
                  {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
                </button>
              ))}
          </div>

          {tab === "orders" && (
            <OrdersList currentUser={user?.name || "Unknown"} currentUserId={user?.id} workspace={workspace} />
          )}
          {tab === "quotations" && (
            <QuotationsList currentUser={user?.name || "Unknown"} currentUserId={user?.id} workspace={workspace} />
          )}
          {tab === "clients" && (
            <ClientsList currentUser={user?.name || "Unknown"} currentUserId={user?.id} workspace={workspace} />
          )}
          {tab === "leads" && (
            <LeadsManager
              currentUser={user?.name || user?.email || "Staff"}
              currentUserId={user?.id}
              userRole={user?.role}
              readOnly={!!workspace?.readOnly}
            />
          )}
          {tab === "prices" && isAdmin && (
            <CrmProductPricesManager
              currentUser={user?.name || user?.email || "Staff"}
              currentUserId={user?.id}
              readOnly={!!workspace?.readOnly}
            />
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
