"use client"

import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { isErpAdmin } from "@/lib/auth"
import { ShieldOff } from "lucide-react"
import { FinanceApprovalPanel } from "@/components/finance/finance-approval-panel"

export default function FinanceApprovalsPage() {
  const { user } = useAuth()
  if (!user) return null

  if (!isErpAdmin(user.role)) {
    return (
      <>
        <Topbar title="Finance Approval" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 text-center">
          <ShieldOff className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium">Admin only</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Cash request approvals are available on admin IDs.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title="Finance Approval" description="Open a request to review, then approve or reject" />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 max-w-5xl">
          <FinanceApprovalPanel />
        </div>
      </div>
    </>
  )
}
