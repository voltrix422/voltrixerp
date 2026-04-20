"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { BranchesTab } from "@/components/branches/branches-tab"

export default function BranchesPage() {
  return (
    <ModuleGuard module="branches">
      <Topbar title="Branches" description="Manage your company branches, outlets, and stores" />
      
      <div className="flex-1 overflow-auto">
        <BranchesTab />
      </div>
    </ModuleGuard>
  )
}
