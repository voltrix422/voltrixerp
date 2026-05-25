"use client"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"

export default function NewFinancePage() {
  return (
    <ModuleGuard module="finance">
      <Topbar title="New Finance" description="Accounting module (coming soon)" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          <div className="rounded-lg border border-dashed bg-[hsl(var(--muted))]/20 p-12 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              New Finance is not set up yet. Use Old Finance for current workflows.
            </p>
          </div>
        </div>
      </div>
    </ModuleGuard>
  )
}
