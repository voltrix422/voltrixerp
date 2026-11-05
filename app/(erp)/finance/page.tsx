"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
import { FinanceHub } from "@/components/finance/finance-hub"
import { ClientOrdersFinance } from "@/components/finance/client-orders-finance"
import { FinanceManager } from "@/components/finance/finance-manager"
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
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

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

  function selectPeriod(id: string) {
    setDateFrom("")
    setDateTo("")
    setReportPeriod(id)
  }

  return (
    <ModuleGuard module="finance">
      <Topbar title="Finance" />
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
        <div className="mx-auto flex w-full max-w-[1180px] flex-1 min-h-0 flex-col px-4 pt-5 sm:px-6 sm:pt-6">
          <div className="shrink-0 pb-3">
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

          <div
            key={activeTab}
            className={cn(
              "dashboard-content-in flex min-h-0 flex-1 flex-col pb-5 sm:pb-6",
              activeTab === "client" ? "overflow-hidden" : "overflow-auto space-y-3",
            )}
          >
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
              <FinanceManager openAddLoan={searchParams?.get("add") === "loan"} />
            )}

            {activeTab === "client" && <ClientOrdersFinance />}
          </div>
        </div>
      </div>
    </ModuleGuard>
  )
}
