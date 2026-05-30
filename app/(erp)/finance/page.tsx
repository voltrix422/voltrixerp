"use client"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { FinanceHub } from "@/components/finance/finance-hub"
import { FinanceReports } from "@/components/finance/finance-reports"
import { ClientOrdersFinance } from "@/components/finance/client-orders-finance"
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
  const [payrollSection, setPayrollSection] = useState<PayrollSection>("staff")

  useEffect(() => {
    if (!searchParams) return
    const tab = searchParams.get("tab")
    const section = searchParams.get("section")
    const payroll = searchParams.get("payroll")
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
    }
    if (section === "petty-cash" || section === "finance") setManageSection(section)
    if (payroll === "sales" || payroll === "staff") setPayrollSection(payroll)
    else if (tab === "sales-salaries") setPayrollSection("sales")
  }, [searchParams])

  const hasFilters = search || dateFrom || dateTo

  function clearFilters() {
    setSearch("")
    setDateFrom("")
    setDateTo("")
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "client", label: "Client Orders" },
    { id: "purchase", label: "Purchase Orders" },
    { id: "payroll", label: "Salaries & Payroll" },
    { id: "manage", label: "Records & Petty Cash" },
    { id: "reports", label: "Reports" },
  ]

  return (
    <ModuleGuard module="finance">
      <Topbar title="Finance" description="Overview, payments, expenses, and reports for Voltrix ERP" />
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 max-w-6xl">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] mb-4 gap-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer whitespace-nowrap ${
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
            <div className="rounded-lg border bg-[hsl(var(--card))] p-3 flex flex-wrap gap-2 items-center mb-4">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs w-32"
                />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs w-32"
                />
              </div>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="h-8 px-3 text-xs border rounded-md cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {activeTab === "overview" && <FinanceHub embedded />}

          {activeTab === "reports" && (
            <div className="space-y-4">
              <div className="flex rounded-lg border p-0.5 bg-[hsl(var(--muted))]/20 w-fit">
                {[
                  { id: "month", label: "This month" },
                  { id: "last_month", label: "Last month" },
                  { id: "year", label: "This year" },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReportPeriod(p.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
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
              <div className="flex items-center gap-2 mb-4">
                {[
                  { id: "finance" as const, label: "Finance Records" },
                  { id: "petty-cash" as const, label: "Petty Cash" },
                ].map(section => (
                  <button
                    key={section.id}
                    onClick={() => setManageSection(section.id)}
                    className={`h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
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
                <FinanceManager search={search} dateFrom={dateFrom} dateTo={dateTo} />
              )}
              {manageSection === "petty-cash" && <PettyCashDashboard />}
            </div>
          )}

          {activeTab === "client" && (
            <ClientOrdersFinance search={search} dateFrom={dateFrom} dateTo={dateTo} />
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
