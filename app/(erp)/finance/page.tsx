"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { FinanceHub } from "@/components/finance/finance-hub"
import { ClientOrdersFinance, type ClientOrdersCreditFilter } from "@/components/finance/client-orders-finance"
import { FinanceManager } from "@/components/finance/finance-manager"
import { Search, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "overview" | "manage" | "client"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "client", label: "Client Orders" },
  { id: "manage", label: "Records" },
]

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

  return (
    <ModuleGuard module="finance">
      <Topbar title="Finance" />
      <div className="flex-1 overflow-auto bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="inline-flex items-center rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px]">
              {TABS.map((tab) => {
                const selected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-all duration-200 cursor-pointer",
                      selected
                        ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                        : "text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] hover:text-[#1d1d1f] dark:hover:text-[hsl(var(--foreground))]",
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div key={activeTab} className="dashboard-content-in space-y-4">
            {activeTab !== "overview" && (
              <div className="rounded-[16px] border border-black/[0.04] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] p-3 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:items-center">
                <div className="relative w-full sm:flex-1 sm:min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full h-9 sm:h-8 rounded-[10px] border border-black/[0.08] dark:border-[hsl(var(--border))] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] pl-8 pr-3 text-sm sm:text-xs focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Calendar className="h-3.5 w-3.5 text-[#86868b] shrink-0" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 sm:h-8 rounded-[10px] border border-black/[0.08] dark:border-[hsl(var(--border))] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2 text-xs flex-1 min-w-0 sm:w-32 cursor-pointer"
                  />
                  <span className="text-[10px] text-[#86868b]">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 sm:h-8 rounded-[10px] border border-black/[0.08] dark:border-[hsl(var(--border))] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2 text-xs flex-1 min-w-0 sm:w-32 cursor-pointer"
                  />
                </div>
                {activeTab === "client" && (
                  <select
                    value={clientCreditFilter}
                    onChange={(e) => setClientCreditFilter(e.target.value as ClientOrdersCreditFilter)}
                    className="h-9 sm:h-8 w-full sm:w-auto rounded-[10px] border border-black/[0.08] dark:border-[hsl(var(--border))] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2 text-xs sm:min-w-[10rem] cursor-pointer"
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
                    className="h-9 sm:h-8 w-full sm:w-auto px-3 text-xs rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] cursor-pointer"
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
      </div>
    </ModuleGuard>
  )
}
