"use client"
import { useState } from "react"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Topbar } from "@/components/layout/topbar"
import { PurchaseLedgerManager } from "@/components/purchase/purchase-ledger-manager"
import { SuppliersTab } from "@/components/purchase/suppliers-tab"

export default function PurchasePage() {
  const [tab, setTab] = useState<"ledger" | "suppliers">("ledger")

  return (
    <ModuleGuard module="purchase">
      <Topbar title="Purchase" description="Purchase ledger, suppliers, and payment tracking" />
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px]">
          <div className="px-6 pt-4">
            <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-2">
              {([
                { key: "ledger", label: "Purchase Ledger" },
                { key: "suppliers", label: "Suppliers" },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                    tab === t.key
                      ? "text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  {t.label}
                  {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
                </button>
              ))}
            </div>
          </div>

          {tab === "ledger" ? (
            <div className="p-6 pt-2">
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
