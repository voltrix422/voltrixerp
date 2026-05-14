"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { ClientsList } from "@/components/crm/clients-list"
import { OrdersList } from "@/components/crm/orders-list"
import { QuotationsList } from "@/components/crm/quotations-list"
import { SalesAgentsManage } from "@/components/crm/sales-agents-manage"
import { useAuth } from "@/components/auth-provider"
import { canAccessSalesAgentsArea, isSalesAgentUser, type CrmWorkspaceScope } from "@/lib/crm-workspace"
import type { User } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

type AgentTab = "clients" | "quotations" | "orders"

export default function SalesAgentsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [tab, setTab] = useState<AgentTab>("clients")
  const [selectedAgent, setSelectedAgent] = useState<User | null>(null)

  useEffect(() => {
    if (!user) return
    if (!canAccessSalesAgentsArea(user)) {
      router.replace("/crm")
    }
  }, [user, router])

  if (!user || !canAccessSalesAgentsArea(user)) {
    return null
  }

  const isAdmin = user.role === "superadmin"
  const activeAgent = isSalesAgentUser(user) ? user : selectedAgent
  const workspace: CrmWorkspaceScope | undefined = activeAgent
    ? {
        mode: "sales_agent",
        ownerUserId: activeAgent.id,
        readOnly: isAdmin && !!selectedAgent,
      }
    : undefined

  return (
    <ModuleGuard module="crm">
      <Topbar title={isAdmin ? "CRM · Sales agents" : "Sales agent workspace"} />

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl space-y-6">
          {isAdmin && !selectedAgent && (
            <SalesAgentsManage onSelectAgent={setSelectedAgent} />
          )}

          {isAdmin && selectedAgent && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-[hsl(var(--muted))]/20 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{selectedAgent.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{selectedAgent.email}</p>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => setSelectedAgent(null)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to agents
              </Button>
            </div>
          )}

          {activeAgent && workspace && (
            <>
              <div className="flex items-center gap-1 border-b">
                {([
                  ["clients", "Clients"],
                  ["quotations", "Quotations"],
                  ["orders", "Orders"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                      tab === key
                        ? "text-[hsl(var(--foreground))]"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {label}
                    {tab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
                  </button>
                ))}
              </div>

              {tab === "clients" && (
                <ClientsList
                  currentUser={activeAgent.name}
                  currentUserId={activeAgent.id}
                  workspace={workspace}
                />
              )}
              {tab === "quotations" && (
                <QuotationsList
                  currentUser={activeAgent.name}
                  currentUserId={activeAgent.id}
                  workspace={workspace}
                />
              )}
              {tab === "orders" && (
                <OrdersList
                  currentUser={activeAgent.name}
                  currentUserId={activeAgent.id}
                  workspace={workspace}
                />
              )}
            </>
          )}

          {isAdmin && !selectedAgent && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Select a sales agent to review their clients, quotations, and orders.
            </p>
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
