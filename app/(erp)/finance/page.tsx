"use client"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { FinanceHub } from "@/components/finance/finance-hub"
import { FinanceReports } from "@/components/finance/finance-reports"
import { ClientOrdersFinance, type ClientOrdersCreditFilter } from "@/components/finance/client-orders-finance"
import { PurchaseOrdersFinance } from "@/components/finance/purchase-orders-finance"
import { FinanceManager } from "@/components/finance/finance-manager"
import { PettyCashDashboard } from "@/components/finance/petty-cash-dashboard"
import { FinancePayroll } from "@/components/finance/finance-payroll"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, Search, Calendar } from "lucide-react"

type Tab = "overview" | "manage" | "client" | "purchase" | "payroll" | "reports"
type PayrollSection = "staff" | "sales"
type ManageSection = "finance" | "petty-cash"
export default function FinancePage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [manageSection, setManageSection] = useState<ManageSection>("finance")
  const [reportPeriod, setReportPeriod] = useState("month")
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [clientCreditFilter, setClientCreditFilter] = useState<ClientOrdersCreditFilter>("all")
  const [payrollSection, setPayrollSection] = useState<PayrollSection>("staff")

  useEffect(() => {
    if (!searchParams) return
    const tab = searchParams.get("tab")
    const section = searchParams.get("section")
    const payroll = searchParams.get("payroll")
    const add = searchParams.get("add")
    if (
      tab === "overview" ||
      tab === "client" ||
      tab === "purchase" ||
      tab === "manage" ||
      tab === "payroll" ||
      tab === "sales-salaries" ||
      tab === "reports"
    ) {
      setActiveTab(tab === "sales-salaries" ? "payroll" : (tab as Tab))
    } else if (add === "loan") {
      setActiveTab("manage")
    }
    if (section === "petty-cash" || section === "finance") setManageSection(section)
    else if (add === "loan") setManageSection("finance")
    if (payroll === "sales" || payroll === "staff") setPayrollSection(payroll)
    else if (tab === "sales-salaries") setPayrollSection("sales")
  }, [searchParams])

  const hasFilters = search || dateFrom || dateTo || clientCreditFilter !== "all"

  function clearFilters() {
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setClientCreditFilter("all")
  }

  const tabs: { id: Tab; label: string; shortLabel: string }[] = [
    { id: "overview", label: "Overview", shortLabel: "Overview" },
    { id: "client", label: "Client Orders", shortLabel: "Orders" },
    { id: "purchase", label: "Purchase Orders", shortLabel: "PO" },
    { id: "payroll", label: "Salaries & Payroll", shortLabel: "Payroll" },
    { id: "manage", label: "Records & Petty Cash", shortLabel: "Records" },
    { id: "reports", label: "Reports", shortLabel: "Reports" },
  ]

  return (
    <ModuleGuard module="finance">
      <Topbar title="Finance" description="Overview, payments, expenses, and reports for Voltrix ERP" />
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 md:p-6 max-w-6xl">
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] mb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
              {tabs.map(tab => (
                <button
                  key={tab.id}
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
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
                  )}
                </button>
              ))}
            </div>
            {activeTab !== "overview" && activeTab !== "reports" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 shrink-0 cursor-pointer"
                onClick={() => setShowFilters(v => !v)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {showFilters && activeTab !== "overview" && activeTab !== "reports" && (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-3 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:items-center mb-4">
              <div className="relative w-full sm:flex-1 sm:min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-9 sm:h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-sm sm:text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]"
                />
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Calendar className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="h-9 sm:h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs flex-1 min-w-0 sm:w-32"
                />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="h-9 sm:h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs flex-1 min-w-0 sm:w-32"
                />
              </div>
              {activeTab === "client" && (
                <select
                  value={clientCreditFilter}
                  onChange={e => setClientCreditFilter(e.target.value as ClientOrdersCreditFilter)}
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
                  onClick={clearFilters}
                  className="h-9 sm:h-8 w-full sm:w-auto px-3 text-xs border rounded-md cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {activeTab === "overview" && <FinanceHub embedded />}

          {activeTab === "reports" && (
            <div className="space-y-4">
              <div className="flex w-full sm:w-fit rounded-lg border p-0.5 bg-[hsl(var(--muted))]/20">
                {[
                  { id: "month", label: "This month" },
                  { id: "last_month", label: "Last month" },
                  { id: "year", label: "This year" },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReportPeriod(p.id)}
                    className={`flex-1 sm:flex-none px-2 sm:px-3 py-2 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-md cursor-pointer text-center ${
                      reportPeriod === p.id ? "bg-[#1faca6] text-white" : ""
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <FinanceReports period={reportPeriod} />
            </div>
          )}

          {activeTab === "manage" && (
            <div>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                {[
                  { id: "finance" as const, label: "Finance Records" },
                  { id: "petty-cash" as const, label: "Petty Cash" },
                ].map(section => (
                  <button
                    key={section.id}
                    onClick={() => setManageSection(section.id)}
                    className={`h-9 sm:h-8 w-full sm:w-auto px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      manageSection === section.id
                        ? "bg-[#1faca6] text-white border-[#1faca6]"
                        : "bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]"
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              {manageSection === "finance" && (
                <FinanceManager
                  search={search}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  openAddLoan={searchParams?.get("add") === "loan"}
                />
              )}
              {manageSection === "petty-cash" && <PettyCashDashboard />}
            </div>
          )}

          {activeTab === "client" && (
            <ClientOrdersFinance
              search={search}
              dateFrom={dateFrom}
              dateTo={dateTo}
              creditFilter={clientCreditFilter}
            />
          )}
          {activeTab === "purchase" && (
            <PurchaseOrdersFinance search={search} dateFrom={dateFrom} dateTo={dateTo} />
          )}
          {activeTab === "payroll" && (
            <FinancePayroll initialSection={payrollSection} />
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
