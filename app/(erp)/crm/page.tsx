"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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

export default function CRMPage() {
  const router = useRouter()
  const { user } = useAuth()
  const workspace = crmWorkspaceForUser(user)
  const isAdmin = isErpAdmin(user?.role)
  const [tab, setTab] = useState<"quotations" | "orders" | "clients" | "leads" | "prices">("quotations")

  useEffect(() => {
    if (user && isSalesAgentUser(user)) {
      router.replace("/crm/sales-agents")
    }
  }, [user, router])

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("crm-lead-detail-id")) {
      setTab("leads")
    }
  }, [])
  
  return (
    <ModuleGuard module="crm">
      <Topbar title="Customer relationship management" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-6 max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b mb-4 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none">
            <button
              onClick={() => setTab("quotations")}
              className={`px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
                tab === "quotations"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Quotations
              {tab === "quotations" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              onClick={() => setTab("orders")}
              className={`px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
                tab === "orders"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Orders
              {tab === "orders" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              onClick={() => setTab("clients")}
              className={`px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
                tab === "clients"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Clients
              {tab === "clients" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              onClick={() => setTab("leads")}
              className={`px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
                tab === "leads"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Leads
              {tab === "leads" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            {isAdmin && (
            <button
              onClick={() => setTab("prices")}
              className={`px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
                tab === "prices"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Product Prices
              {tab === "prices" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            )}
          </div>

          {/* Tab Content */}
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
          {tab === "orders" && (
            <OrdersList currentUser={user?.name || "Unknown"} currentUserId={user?.id} workspace={workspace} />
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
