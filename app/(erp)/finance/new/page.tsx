"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { AccountingApp } from "@/components/accounting/accounting-app"

export default function NewFinancePage() {
  return (
    <ModuleGuard module="finance">
      <Topbar
        title="New Finance"
        description="Complete Odoo-style accounting — chart of accounts, invoicing, payments, bank, reports"
      />
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 max-w-[1600px]">
          <AccountingApp />
        </div>
      </div>
    </ModuleGuard>
  )
}
