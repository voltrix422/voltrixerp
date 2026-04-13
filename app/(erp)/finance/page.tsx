"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { ClientOrdersFinance } from "@/components/finance/client-orders-finance"
import { PurchaseOrdersFinance } from "@/components/finance/purchase-orders-finance"

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<"client" | "purchase">("client")

  return (
    <ModuleGuard module="finance">
      <Topbar title="Finance" description="Manage payments and finalized orders" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-4">
            <button
              onClick={() => setActiveTab("client")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
                activeTab === "client"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Client Orders
              {activeTab === "client" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("purchase")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
                activeTab === "purchase"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Purchase Orders
              {activeTab === "purchase" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "client" && <ClientOrdersFinance />}
          {activeTab === "purchase" && <PurchaseOrdersFinance />}
        </div>
      </div>
    </ModuleGuard>
  )
}
