"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { HrmManager } from "@/components/hrm/hrm-manager"
import { HrmKpiAdmin } from "@/components/hrm/hrm-kpi-admin"
import { HrmKpiApprovals } from "@/components/hrm/hrm-kpi-approvals"
import { HrmDailyReportsAdmin } from "@/components/hrm/hrm-daily-reports-admin"
import { MyKpiPortal } from "@/components/hrm/my-kpi-portal"
import { useAuth } from "@/components/auth-provider"
import { isErpAdmin } from "@/lib/auth"

type HrmTab = "staff" | "performance" | "approvals" | "daily-reports" | "my-kpis"

export default function HrmPage() {
  const { user } = useAuth()
  const isAdmin = isErpAdmin(user?.role)
  const [tab, setTab] = useState<HrmTab>(isAdmin ? "staff" : "my-kpis")

  function tabBtn(id: HrmTab, label: string) {
    const active = tab === id
    return (
      <button
        key={id}
        type="button"
        onClick={() => setTab(id)}
        className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
          active
            ? "text-[hsl(var(--foreground))]"
            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        }`}
      >
        {label}
        {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
      </button>
    )
  }

  return (
    <ModuleGuard module="hrm">
      <Topbar title="Human Resource Management" />

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          <div className="flex items-center gap-1 border-b mb-4 flex-wrap">
            {isAdmin && tabBtn("staff", "Staff")}
            {isAdmin && tabBtn("performance", "Templates")}
            {isAdmin && tabBtn("approvals", "KPI Approvals")}
            {isAdmin && tabBtn("daily-reports", "Daily Reports")}
            {tabBtn("my-kpis", "My KPIs")}
          </div>

          {tab === "staff" && isAdmin && <HrmManager />}
          {tab === "performance" && isAdmin && (
            <HrmKpiAdmin createdBy={user?.name ?? "Admin"} />
          )}
          {tab === "approvals" && isAdmin && (
            <HrmKpiApprovals reviewedBy={user?.name ?? "Admin"} />
          )}
          {tab === "daily-reports" && isAdmin && (
            <HrmDailyReportsAdmin reviewedBy={user?.name ?? "Admin"} />
          )}
          {tab === "my-kpis" && <MyKpiPortal />}
        </div>
      </div>
    </ModuleGuard>
  )
}
