"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { FinanceHub } from "@/components/finance/finance-hub"

export default function FinanceOverviewPage() {
  return (
    <ModuleGuard module="finance">
      <Topbar
        title="Finance overview"
        description="Your real ERP numbers — client orders, purchases, records, petty cash"
      />
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 max-w-6xl">
          <FinanceHub />
        </div>
      </div>
    </ModuleGuard>
  )
}
