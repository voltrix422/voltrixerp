"use client"

import { Topbar } from "@/components/layout/topbar"
import { ClientAuditPanel } from "@/components/client-audit/client-audit-panel"
import { useAuth } from "@/components/auth-provider"
import { hasModuleAccess } from "@/lib/auth"
import { ComingSoon } from "@/components/layout/coming-soon"

export default function ClientAuditPage() {
  const { user } = useAuth()

  if (!user) return null

  if (!hasModuleAccess(user, "crm")) {
    return (
      <>
        <Topbar title="Client audit" description="Stock · sold · left · credit" />
        <ComingSoon title="Client audit" />
      </>
    )
  }

  return (
    <>
      <Topbar
        title="Client audit"
        description="Reconcile stock given to clients, sales at any rates, remaining stock, and credit"
      />
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-5xl">
          <ClientAuditPanel />
        </div>
      </div>
    </>
  )
}
