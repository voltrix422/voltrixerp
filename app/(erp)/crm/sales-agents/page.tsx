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
              ? "My team"
              : "Sales agents"
        }
      />

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
        <div
          className={`mx-auto flex w-full flex-1 min-h-0 flex-col px-4 pt-5 sm:px-6 sm:pt-6 pb-5 sm:pb-6 overflow-auto scrollbar-none ${
            isAgent ? "max-w-3xl" : "max-w-[1180px]"
          }`}
        >
          {isAdminView && <SalesAgentsHub user={user} />}
          {isAgent && <SalesAgentPortal user={user} />}
        </div>
      </div>
    </ModuleGuard>
  )
}
