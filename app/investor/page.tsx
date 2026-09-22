"use client"

import { Topbar } from "@/components/layout/topbar"
import { DashboardOverviewPanel } from "@/components/dashboard/dashboard-overview-panel"

export default function InvestorDashboardPage() {
  return (
    <>
      <Topbar
        title="Company progress"
        description="Investor dashboard — live company activity"
      />
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <DashboardOverviewPanel variant="investor" />
      </div>
    </>
  )
}
