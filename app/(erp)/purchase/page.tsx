"use client"
import { useState } from "react"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Topbar } from "@/components/layout/topbar"
import { PurchaseLedgerManager } from "@/components/purchase/purchase-ledger-manager"
import { SuppliersTab } from "@/components/purchase/suppliers-tab"
import { BookOpen, Users } from "lucide-react"

export default function PurchasePage() {
  const [tab, setTab] = useState<"ledger" | "suppliers">("ledger")

  const tabs = [
    { key: "ledger" as const, label: "Purchase Ledger", icon: BookOpen },
    { key: "suppliers" as const, label: "Suppliers", icon: Users },
  ]

  return (
    <ModuleGuard module="purchase">
      <Topbar title="Purchase" description="Purchase ledger, suppliers, and payment tracking" />
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto w-full">
          <div className="px-6 pt-4">
            <div className="inline-flex items-center gap-1 rounded-lg border bg-[hsl(var(--muted))]/20 p-1">
              {tabs.map(t => {
                const Icon = t.icon
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      active
                        ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {tab === "ledger" ? (
            <div className="p-6 pt-4">
              <PurchaseLedgerManager />
            </div>
          ) : (
            <SuppliersTab />
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
