"use client"

import { Topbar } from "@/components/layout/topbar"
import { PettyCashDashboard } from "@/components/finance/petty-cash-dashboard"
import { useAuth } from "@/components/auth-provider"

export default function PettyCashPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <Topbar title="Petty Cash" description="" />
      <div className="flex-1 overflow-auto bg-[#f5f5f7]">
        <div className="p-3 sm:p-4 max-w-[90rem]">
          <PettyCashDashboard />
        </div>
      </div>
    </>
  )
}
