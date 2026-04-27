"use client"
import { useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { ClientOrdersFinance } from "@/components/finance/client-orders-finance"
import { PurchaseOrdersFinance } from "@/components/finance/purchase-orders-finance"
import { FinanceManager } from "@/components/finance/finance-manager"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, ChevronDown, ChevronUp, Search, Calendar } from "lucide-react"

type Tab = "manage" | "client" | "purchase"

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("manage")
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const hasFilters = search || dateFrom || dateTo

  function clearFilters() {
    setSearch("")
    setDateFrom("")
    setDateTo("")
  }

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
          {/* Tabs + Filter Button */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] mb-4">
            <div className="flex items-center gap-1">
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
            <Button
              size="sm" variant="outline"
              className="h-8 w-8 p-0 cursor-pointer"
              onClick={() => setShowFilters(v => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Global Filters - Collapsible */}
          {showFilters && (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-3 flex flex-wrap gap-2 items-center mb-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6] w-32" />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6] w-32" />
              </div>

              {hasFilters && (
                <button onClick={clearFilters}
                  className="h-8 px-3 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border rounded-md transition-colors cursor-pointer">
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Tab Content */}
          {activeTab === "manage" && <FinanceManager search={search} dateFrom={dateFrom} dateTo={dateTo} />}
          {activeTab === "client" && <ClientOrdersFinance search={search} dateFrom={dateFrom} dateTo={dateTo} />}
          {activeTab === "purchase" && <PurchaseOrdersFinance search={search} dateFrom={dateFrom} dateTo={dateTo} />}
        </div>
      </div>
    </ModuleGuard>
  )
}
