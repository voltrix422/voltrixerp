"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { FinanceHub } from "@/components/finance/finance-hub"
import { ClientOrdersFinance, type ClientOrdersCreditFilter } from "@/components/finance/client-orders-finance"
import { FinanceManager } from "@/components/finance/finance-manager"
import { Search, Calendar } from "lucide-react"

type Tab = "overview" | "manage" | "client"

export default function FinancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [reportPeriod, setReportPeriod] = useState("month")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [clientCreditFilter, setClientCreditFilter] = useState<ClientOrdersCreditFilter>("all")

  useEffect(() => {
    if (!searchParams) return
    const tab = searchParams.get("tab")
    const section = searchParams.get("section")
    const add = searchParams.get("add")
    if (tab === "overview" || tab === "client" || tab === "manage") {
      setActiveTab(tab)
    } else if (tab === "purchase" || tab === "payroll" || tab === "sales-salaries") {
      setActiveTab("overview")
      router.replace("/finance?tab=overview")
      return
    } else if (add === "loan") {
      setActiveTab("manage")
    }
    if (section === "petty-cash") {
      router.replace("/petty-cash")
      return
    }
  }, [searchParams, router])

  const hasFilters = search || dateFrom || dateTo || clientCreditFilter !== "all"

  function clearFilters() {
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setClientCreditFilter("all")
  }

  function selectPeriod(id: string) {
    setDateFrom("")
    setDateTo("")
    setReportPeriod(id)
  }

  const tabs: { id: Tab; label: string; shortLabel: string }[] = [
    { id: "overview", label: "Overview", shortLabel: "Overview" },
    { id: "client", label: "Client Orders", shortLabel: "Orders" },
    { id: "manage", label: "Records", shortLabel: "Records" },
  ]

  return (
    <ModuleGuard module="finance">
      <Topbar title="Finance" description="Overview, client payments, and records for Voltrix ERP" />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 md:p-6 max-w-6xl">
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] mb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 px-2.5 sm:px-3 py-2.5 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-colors relative cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? "text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-[hsl(var(--foreground))]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {activeTab !== "overview" && (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-3 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:items-center mb-4">
              <div className="relative w-full sm:flex-1 sm:min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-9 sm:h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-sm sm:text-xs focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Calendar className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 sm:h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs flex-1 min-w-0 sm:w-32 cursor-pointer"
                />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 sm:h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs flex-1 min-w-0 sm:w-32 cursor-pointer"
                />
              </div>
              {activeTab === "client" && (
                <select
                  value={clientCreditFilter}
                  onChange={(e) => setClientCreditFilter(e.target.value as ClientOrdersCreditFilter)}
                  className="h-9 sm:h-8 w-full sm:w-auto rounded-md border bg-[hsl(var(--background))] px-2 text-xs sm:min-w-[10rem] cursor-pointer"
                  aria-label="Credit filter"
                >
                  <option value="all">All orders</option>
                  <option value="outstanding">Outstanding credit</option>
                  <option value="on_credit">On credit (any)</option>
                </select>
              )}
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-9 sm:h-8 w-full sm:w-auto px-3 text-xs border rounded-md cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {activeTab === "overview" && (
            <FinanceHub
              embedded
              period={reportPeriod}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onPeriodChange={selectPeriod}
            />
          )}

          {activeTab === "manage" && (
            <FinanceManager
              search={search}
              dateFrom={dateFrom}
              dateTo={dateTo}
              openAddLoan={searchParams?.get("add") === "loan"}
            />
          )}

          {activeTab === "client" && (
            <ClientOrdersFinance
              search={search}
              dateFrom={dateFrom}
              dateTo={dateTo}
              creditFilter={clientCreditFilter}
            />
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
