"use client"

import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { PosAdminDashboard } from "@/components/pos/pos-admin-dashboard"

export default function PosAdminPage() {
  return (
    <>
      <Topbar
        title="POS Admin"
        description="Branch POS sales and counters"
      />
      <ModuleGuard module="pos_admin">
        <PosAdminDashboard />
      </ModuleGuard>
    </>
  )
}
