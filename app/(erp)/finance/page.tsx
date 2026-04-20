"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { ClientOrdersFinance } from "@/components/finance/client-orders-finance"
import { PurchaseOrdersFinance } from "@/components/finance/purchase-orders-finance"
import { FinanceManager } from "@/components/finance/finance-manager"

type Tab = "manage" | "client" | "purchase"

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("manage")

  const tabs: { id: Tab; label: string }[] = [
    { id: "manage", label: "Manage" },
    { id: "client", label: "Client Orders" },
    { id: "purchase", label: "Purchase Orders" },
  ]

  return (
    <ModuleGuard module="finance">
      <Topbar title="Finance" description="Manage payments and finalized orders" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                  activeTab === tab.id
                    ? "text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "manage" && <FinanceManager />}
          {activeTab === "client" && <ClientOrdersFinance />}
          {activeTab === "purchase" && <PurchaseOrdersFinance />}
        </div>
      </div>
    </ModuleGuard>
  )
}
