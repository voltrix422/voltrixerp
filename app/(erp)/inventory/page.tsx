"use client"
import { useEffect, useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { InventoryList } from "@/components/inventory/inventory-list"
import { ManualInventoryTab } from "@/components/inventory/manual-inventory-tab"
import { ClientOrdersInventory } from "@/components/inventory/client-orders-inventory"
import { OrderReturnsInventory } from "@/components/inventory/order-returns-inventory"
import { ReplacementApprovalsTab } from "@/components/inventory/replacement-approvals-tab"
import { BranchesTab } from "@/components/branches/branches-tab"
import { InventoryMovementOverview } from "@/components/inventory/inventory-movement-overview"
import { FaultyInventoryTab } from "@/components/inventory/faulty-inventory-tab"

const HISTORY_TAB_ENABLED = true

type InventoryTab =
  | "orders"
  | "inventory"
  | "manual"
  | "faulty"
  | "approvals"
  | "returns"
  | "branches"
  | "history"

const VALID_TABS = new Set<InventoryTab>([
  "orders",
  "inventory",
  "manual",
  "faulty",
  "approvals",
  "returns",
  "branches",
  "history",
])

function tabFromSearch(): InventoryTab {
  if (typeof window === "undefined") return "orders"
  const raw = new URLSearchParams(window.location.search).get("tab") || ""
  return VALID_TABS.has(raw as InventoryTab) ? (raw as InventoryTab) : "orders"
}

export default function InventoryPage() {
  const [tab, setTab] = useState<InventoryTab>("orders")

  useEffect(() => {
    setTab(tabFromSearch())
  }, [])

  function selectTab(next: InventoryTab) {
    setTab(next)
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (next === "orders") url.searchParams.delete("tab")
    else url.searchParams.set("tab", next)
    window.history.replaceState({}, "", url.toString())
  }

  const tabs: { id: InventoryTab; label: string; shortLabel: string }[] = [
    { id: "orders", label: "Client Orders", shortLabel: "Orders" },
    { id: "inventory", label: "Inventory", shortLabel: "Inventory" },
    { id: "manual", label: "Manual added inventory", shortLabel: "Manual" },
    { id: "faulty", label: "Faulty / Damaged", shortLabel: "Faulty" },
    { id: "approvals", label: "Approvals", shortLabel: "Approvals" },
    { id: "returns", label: "Order returns", shortLabel: "Returns" },
    { id: "branches", label: "Branches", shortLabel: "Branches" },
    ...(HISTORY_TAB_ENABLED
      ? [{ id: "history" as const, label: "Report", shortLabel: "Report" }]
      : []),
  ]

  return (
    <ModuleGuard module="inventory">
      <Topbar title="Inventory" />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-6 max-w-7xl">
          <div className="flex items-center gap-0 border-b border-[hsl(var(--border))] mb-4 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
            {tabs.map(({ id, label, shortLabel }) => (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                className={`shrink-0 whitespace-nowrap px-3 py-2 text-xs font-medium border-b-2 -mb-px cursor-pointer ${
                  tab === id
                    ? "border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]"
                    : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {tab === "orders" && <ClientOrdersInventory />}
          {tab === "inventory" && <InventoryList />}
          {tab === "manual" && <ManualInventoryTab />}
          {tab === "faulty" && <FaultyInventoryTab />}
          {tab === "approvals" && <ReplacementApprovalsTab />}
          {tab === "returns" && <OrderReturnsInventory />}
          {tab === "branches" && <BranchesTab />}
          {HISTORY_TAB_ENABLED && tab === "history" && <InventoryMovementOverview />}
        </div>
      </div>
    </ModuleGuard>
  )
}
