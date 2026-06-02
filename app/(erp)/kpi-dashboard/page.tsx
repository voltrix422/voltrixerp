"use client"

import { Topbar } from "@/components/layout/topbar"
import { MyKpiPortal } from "@/components/hrm/my-kpi-portal"

export default function KpiDashboardPage() {
  return (
    <>
      <Topbar title="My KPI Dashboard" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          <MyKpiPortal />
        </div>
      </div>
    </>
  )
}

