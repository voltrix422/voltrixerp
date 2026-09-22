"use client"

import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ClientsList } from "@/components/crm/clients-list"
import { LeadsManager } from "@/components/crm/leads-manager"
import { OrdersList } from "@/components/crm/orders-list"
import { QuotationsList } from "@/components/crm/quotations-list"
import { useAuth } from "@/components/auth-provider"
import type { CrmWorkspaceScope } from "@/lib/crm-workspace"

const INVESTOR_CRM: CrmWorkspaceScope = { mode: "main", readOnly: true }

export default function InvestorCrmPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"quotations" | "orders" | "clients" | "leads">("quotations")

  const tabClass = (active: boolean) =>
    `px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors relative cursor-pointer shrink-0 ${
      active
        ? "text-[hsl(var(--foreground))]"
        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    }`

  return (
    <>
      <Topbar title="CRM 2" description="Same CRM records — investor view" />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-6 max-w-6xl">
          <div className="flex items-center gap-1 border-b mb-4 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none">
            {(["quotations", "orders", "clients", "leads"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={tabClass(tab === id)}>
                {id[0].toUpperCase() + id.slice(1)}
                {tab === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
              </button>
            ))}
          </div>

          {tab === "quotations" && (
            <QuotationsList currentUser={user?.name || "Investor"} currentUserId={user?.id} workspace={INVESTOR_CRM} />
          )}
          {tab === "orders" && (
            <OrdersList currentUser={user?.name || "Investor"} currentUserId={user?.id} workspace={INVESTOR_CRM} />
          )}
          {tab === "clients" && (
            <ClientsList currentUser={user?.name || "Investor"} currentUserId={user?.id} workspace={INVESTOR_CRM} />
          )}
          {tab === "leads" && (
            <LeadsManager
              currentUser={user?.name || user?.email || "Investor"}
              currentUserId={user?.id}
              userRole={user?.role}
              readOnly
            />
          )}
        </div>
      </div>
    </>
  )
}
