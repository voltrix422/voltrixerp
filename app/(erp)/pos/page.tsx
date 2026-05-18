"use client"

import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { PosManager } from "@/components/pos/pos-manager"

export default function PosPage() {
  return (
    <ModuleGuard module="pos">
      <Topbar title="Point of Sale" description="Sell from inventory · track receipts" />
      <PosManager />
    </ModuleGuard>
  )
}
