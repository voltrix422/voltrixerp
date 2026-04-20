"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { HrmManager } from "@/components/hrm/hrm-manager"

export default function HrmPage() {
  return (
    <ModuleGuard module="hrm">
      <Topbar title="HRM" description="Manage staff profiles and information" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          <HrmManager />
        </div>
      </div>
    </ModuleGuard>
  )
}
