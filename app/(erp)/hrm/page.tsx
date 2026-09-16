"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { HrmManager } from "@/components/hrm/hrm-manager"

export default function HrmPage() {
  return (
    <ModuleGuard module="hrm">
      <Topbar title="Human Resource Management" />
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <HrmManager />
        </div>
      </div>
    </ModuleGuard>
  )
}
