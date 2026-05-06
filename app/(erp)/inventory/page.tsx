"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { InventoryList } from "@/components/inventory/inventory-list"
import { ClientOrdersInventory } from "@/components/inventory/client-orders-inventory"
import { BranchesTab } from "@/components/branches/branches-tab"

export default function InventoryPage() {
  const [tab, setTab] = useState<"orders" | "stock" | "branches">("orders")

  return (
    <ModuleGuard module="inventory">
      <Topbar title="Inventory" description="Manage stock and dispatch client orders" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-4">
            <button
              onClick={() => setTab("orders")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                tab === "orders"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Client Orders
              {tab === "orders" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              onClick={() => setTab("stock")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                tab === "stock"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Stock Items
              {tab === "stock" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              onClick={() => setTab("branches")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                tab === "branches"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Branches
              {tab === "branches" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          {tab === "orders" ? <ClientOrdersInventory /> : tab === "stock" ? <InventoryList /> : <BranchesTab />}
        </div>
      </div>
    </ModuleGuard>
  )
}
