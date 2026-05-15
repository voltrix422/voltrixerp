"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { SalesAgentsHub } from "@/components/crm/sales-agents-hub"
import { SalesAgentPortal } from "@/components/crm/sales-agent-portal"
import { useAuth } from "@/components/auth-provider"
import {
  canAccessSalesAgentsArea,
  isSalesAgentUser,
  isSalesAgentsAdminView,
} from "@/lib/crm-workspace"

export default function SalesAgentsPage() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    if (!canAccessSalesAgentsArea(user)) {
      router.replace("/crm")
    }
  }, [user, router])

  if (!user || !canAccessSalesAgentsArea(user)) {
    return null
  }

  const isAgent = isSalesAgentUser(user)
  const isAdminView = isSalesAgentsAdminView(user)

  return (
    <ModuleGuard module="crm">
      <Topbar
        title={
          isAgent
            ? "Sales portal"
            : user.role === "sales_manager"
              ? "CRM · My team"
              : "CRM · Sales agents"
        }
      />

      <div className="flex-1 overflow-auto">
        <div className={`p-4 sm:p-6 ${isAgent ? "max-w-3xl mx-auto" : "max-w-6xl"} space-y-6`}>
          {isAdminView && <SalesAgentsHub user={user} />}
          {isAgent && <SalesAgentPortal user={user} />}
        </div>
      </div>
    </ModuleGuard>
  )
}
