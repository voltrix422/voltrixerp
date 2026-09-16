"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { HrmManager } from "@/components/hrm/hrm-manager"
import { HrmKpiAdmin } from "@/components/hrm/hrm-kpi-admin"
import { HrmKpiApprovals } from "@/components/hrm/hrm-kpi-approvals"
import { HrmDailyReportsAdmin } from "@/components/hrm/hrm-daily-reports-admin"
import { useAuth } from "@/components/auth-provider"

type HrmTab = "staff" | "performance" | "approvals" | "daily-reports"

const HRM_TABS: { id: HrmTab; label: string }[] = [
  { id: "staff", label: "Staff" },
  { id: "daily-reports", label: "Daily Reports" },
  { id: "performance", label: "Templates" },
  { id: "approvals", label: "KPI Approvals" },
]

export default function HrmPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<HrmTab>("staff")

  return (
    <ModuleGuard module="hrm">
      <Topbar title="Human Resource Management" />

      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
          <nav className="flex items-center gap-0 border-b border-[hsl(var(--border))] overflow-x-auto">
            {HRM_TABS.map(({ id, label }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`shrink-0 px-3 py-2 text-xs font-medium border-b-2 -mb-px cursor-pointer ${
                    active
                      ? "border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]"
                      : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </nav>

          {tab === "staff" && <HrmManager />}
          {tab === "performance" && (
            <HrmKpiAdmin createdBy={user?.name ?? "Admin"} />
          )}
          {tab === "approvals" && (
            <HrmKpiApprovals reviewedBy={user?.name ?? "Admin"} />
          )}
          {tab === "daily-reports" && (
            <HrmDailyReportsAdmin reviewedBy={user?.name ?? "Admin"} />
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
