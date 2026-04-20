"use client"
import { useState, useEffect } from "react"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { POsTab } from "@/components/purchase/pos-tab"
import { SuppliersTab } from "@/components/purchase/suppliers-tab"
import { InventoryStockTab } from "@/components/purchase/inventory-stock-tab"

export default function PurchasePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<"pos" | "suppliers" | "inventory">("pos")

  const tabLabels = { pos: "Purchase Orders", suppliers: "Suppliers", inventory: "Inventory" }

  return (
    <ModuleGuard module="purchase">
      <Topbar title="Purchase" description="Manage purchase orders and suppliers" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-2">
            {(["pos", "suppliers", "inventory"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                  tab === t
                    ? "text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {tabLabels[t]}
                {tab === t && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab === "pos" && <POsTab user={user} />}
          {tab === "suppliers" && <SuppliersTab />}
          {tab === "inventory" && <InventoryStockTab />}
        </div>
      </div>
    </ModuleGuard>
  )
}
