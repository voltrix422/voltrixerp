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
import { cn } from "@/lib/utils"

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
  const [visited, setVisited] = useState<Set<InventoryTab>>(() => new Set(["orders"]))

  useEffect(() => {
    selectTab(tabFromSearch())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectTab(next: InventoryTab) {
    setTab(next)
    setVisited((prev) => {
      if (prev.has(next)) return prev
      const copy = new Set(prev)
      copy.add(next)
      return copy
    })
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (next === "orders") url.searchParams.delete("tab")
    else url.searchParams.set("tab", next)
    window.history.replaceState({}, "", url.toString())
  }

  const tabs: { id: InventoryTab; label: string; shortLabel: string }[] = [
    { id: "orders", label: "Client Orders", shortLabel: "Orders" },
    { id: "inventory", label: "Inventory", shortLabel: "Stock" },
    { id: "manual", label: "Manual", shortLabel: "Manual" },
    { id: "faulty", label: "Faulty", shortLabel: "Faulty" },
    { id: "approvals", label: "Approvals", shortLabel: "Approvals" },
    { id: "returns", label: "Returns", shortLabel: "Returns" },
    { id: "branches", label: "Branches", shortLabel: "Branches" },
    ...(HISTORY_TAB_ENABLED
      ? [{ id: "history" as const, label: "Report", shortLabel: "Report" }]
      : []),
  ]

  return (
    <ModuleGuard module="inventory">
      <Topbar title="Inventory" />
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
        <div className="mx-auto flex w-full max-w-[1180px] flex-1 min-h-0 flex-col px-4 pt-5 sm:px-6 sm:pt-6">
          <div className="shrink-0 pb-3">
            <div className="inline-flex max-w-full items-center rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px] overflow-x-auto scrollbar-none">
              {tabs.map(({ id, label, shortLabel }) => {
                const selected = tab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTab(id)}
                    className={cn(
                      "shrink-0 px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-all duration-200 cursor-pointer",
                      selected
                        ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                        : "text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] hover:text-[#1d1d1f] dark:hover:text-[hsl(var(--foreground))]",
                    )}
                  >
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="dashboard-content-in relative min-h-0 flex-1 overflow-auto scrollbar-none pb-5 sm:pb-6">
            {visited.has("orders") && (
              <div className={tab === "orders" ? "relative block" : "hidden"} aria-hidden={tab !== "orders"}>
                <ClientOrdersInventory />
              </div>
            )}
            {visited.has("inventory") && (
              <div className={tab === "inventory" ? "relative block" : "hidden"} aria-hidden={tab !== "inventory"}>
                <InventoryList />
              </div>
            )}
            {visited.has("manual") && (
              <div className={tab === "manual" ? "relative block" : "hidden"} aria-hidden={tab !== "manual"}>
                <ManualInventoryTab />
              </div>
            )}
            {visited.has("faulty") && (
              <div className={tab === "faulty" ? "relative block" : "hidden"} aria-hidden={tab !== "faulty"}>
                <FaultyInventoryTab />
              </div>
            )}
            {visited.has("approvals") && (
              <div className={tab === "approvals" ? "relative block" : "hidden"} aria-hidden={tab !== "approvals"}>
                <ReplacementApprovalsTab />
              </div>
            )}
            {visited.has("returns") && (
              <div className={tab === "returns" ? "relative block" : "hidden"} aria-hidden={tab !== "returns"}>
                <OrderReturnsInventory />
              </div>
            )}
            {visited.has("branches") && (
              <div className={tab === "branches" ? "relative block" : "hidden"} aria-hidden={tab !== "branches"}>
                <BranchesTab />
              </div>
            )}
            {HISTORY_TAB_ENABLED && visited.has("history") && (
              <div className={tab === "history" ? "relative block" : "hidden"} aria-hidden={tab !== "history"}>
                <InventoryMovementOverview />
              </div>
            )}
          </div>
        </div>
      </div>
    </ModuleGuard>
  )
}
