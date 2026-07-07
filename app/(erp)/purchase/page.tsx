"use client"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Topbar } from "@/components/layout/topbar"
import { PurchaseLedgerManager } from "@/components/purchase/purchase-ledger-manager"

export default function PurchasePage() {
  return (
    <ModuleGuard module="purchase">
      <Topbar title="Purchase" description="Purchase ledger — project, order, and expense entries" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1400px]">
          <PurchaseLedgerManager />
        </div>
      </div>
    </ModuleGuard>
  )
}
