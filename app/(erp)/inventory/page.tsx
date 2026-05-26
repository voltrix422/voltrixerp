"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { InventoryList } from "@/components/inventory/inventory-list"
import { ManualInventoryTab } from "@/components/inventory/manual-inventory-tab"
import { ClientOrdersInventory } from "@/components/inventory/client-orders-inventory"
import { BranchesTab } from "@/components/branches/branches-tab"
import { History } from "lucide-react"

export default function InventoryPage() {
  const [tab, setTab] = useState<"orders" | "inventory" | "manual" | "branches" | "history">("orders")

  const tabs = [
    { id: "orders" as const, label: "Client Orders" },
    { id: "inventory" as const, label: "Inventory" },
    { id: "manual" as const, label: "Manual added inventory" },
    { id: "branches" as const, label: "Branches" },
    { id: "history" as const, label: "History" },
  ]

  return (
    <ModuleGuard module="inventory">
      <Topbar title="Inventory" description="Manage stock and dispatch client orders" />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl">
          <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-5">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative cursor-pointer ${
                  tab === id
                    ? "text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {label}
                {tab === id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6] rounded-full" />
                )}
              </button>
            ))}
          </div>

          {tab === "orders" && <ClientOrdersInventory />}
          {tab === "inventory" && <InventoryList />}
          {tab === "manual" && <ManualInventoryTab />}
          {tab === "branches" && <BranchesTab />}
          {tab === "history" && (
            <div className="flex flex-col items-center justify-center py-24 text-center text-[hsl(var(--muted-foreground))]">
              <History className="h-10 w-10 opacity-30 mb-3" />
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">History</p>
              <p className="text-xs mt-1 max-w-sm">Inventory and fulfillment history will appear here soon.</p>
            </div>
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
