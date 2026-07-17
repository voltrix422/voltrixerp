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
import { Users, LayoutTemplate, CheckSquare, FileText, Target } from "lucide-react"

type HrmTab = "staff" | "performance" | "approvals" | "daily-reports" | "my-kpis"

const ADMIN_TABS: { id: HrmTab; label: string; icon: typeof Users }[] = [
  { id: "staff", label: "Staff", icon: Users },
  { id: "performance", label: "Templates", icon: LayoutTemplate },
  { id: "approvals", label: "KPI Approvals", icon: CheckSquare },
  { id: "daily-reports", label: "Daily Reports", icon: FileText },
]

export default function HrmPage() {
  const { user } = useAuth()
  const isAdmin = isErpAdmin(user?.role)
  const [tab, setTab] = useState<HrmTab>(isAdmin ? "staff" : "my-kpis")

  const tabs = isAdmin
    ? [...ADMIN_TABS, { id: "my-kpis" as const, label: "My KPIs", icon: Target }]
    : [{ id: "my-kpis" as const, label: "My KPIs", icon: Target }]

  return (
    <ModuleGuard module="hrm">
      <Topbar title="Human Resource Management" />

      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
          <nav className="flex items-center gap-1 p-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm border border-[hsl(var(--border))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              )
            })}
          </nav>

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
