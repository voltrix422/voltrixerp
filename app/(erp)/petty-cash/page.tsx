"use client"

import { Topbar } from "@/components/layout/topbar"
import { PettyCashDashboard } from "@/components/finance/petty-cash-dashboard"
import { useAuth } from "@/components/auth-provider"

export default function PettyCashPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <Topbar title="Petty Cash" description="Request cash, track payouts, and submit settlements" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          <PettyCashDashboard />
        </div>
      </div>
    </>
  )
}
