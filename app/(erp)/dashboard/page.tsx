"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { ComingSoon } from "@/components/layout/coming-soon"
import { DashboardBranchTransferApprovals } from "@/components/dashboard/branch-transfer-approvals-panel"
import { DashboardPettyCashApprovals } from "@/components/dashboard/petty-cash-approvals"
import { DashboardOverviewPanel } from "@/components/dashboard/dashboard-overview-panel"
import { FullBackupCard } from "@/components/dashboard/full-backup-card"
import { useDashboardApprovalCounts } from "@/components/dashboard/use-dashboard-data"
import { isErpAdmin } from "@/lib/auth"
import {
  ApprovalTabs,
  DashboardMainTabs,
  DashboardShell,
  type DashboardMainTab,
} from "@/components/dashboard/dashboard-ui"

function dashboardGreeting(name: string) {
  const first = (name || "").trim().split(/\s+/)[0] || "there"
  // Capitalize first letter for a cleaner Apple-style title
  const pretty = first.charAt(0).toUpperCase() + first.slice(1)
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${pretty}`
  if (hour < 17) return `Good afternoon, ${pretty}`
  return `Good evening, ${pretty}`
}

function dashboardDateLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mainTab, setMainTab] = useState<DashboardMainTab>("overview")
  const [approvalTab, setApprovalTab] = useState<"transfers" | "petty">("transfers")
  const approvalCounts = useDashboardApprovalCounts(!!user && isErpAdmin(user.role))
  const approvalsBadge = approvalCounts.transfers + approvalCounts.pettyCash

  useEffect(() => {
    if (searchParams?.get("manageUsers") === "1") {
      router.replace("/manage-users")
    }
  }, [searchParams, router])

  if (!user) return null

  const greeting = dashboardGreeting(user.name)
  const dateLabel = dashboardDateLabel()

  if (!isErpAdmin(user.role)) {
    return (
      <>
        <Topbar title={greeting} description={dateLabel} />
        <ComingSoon title="Dashboard" />
      </>
    )
  }

  return (
    <>
      <Topbar
        title={greeting}
        description={dateLabel}
      />
      <DashboardShell>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <DashboardMainTabs
            active={mainTab}
            onChange={setMainTab}
            approvalsPending={approvalsBadge}
          />
        </div>

        <div key={mainTab} className="dashboard-content-in">
          {mainTab === "overview" ? (
            <DashboardOverviewPanel />
          ) : mainTab === "backup" ? (
            <FullBackupCard />
          ) : (
            <section className="space-y-3">
              <h2 className="text-[15px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                Approvals
              </h2>

              <ApprovalTabs
                active={approvalTab}
                onChange={(id) => setApprovalTab(id as typeof approvalTab)}
                tabs={[
                  { id: "transfers", label: "Branch Transfers", count: approvalCounts.transfers },
                  { id: "petty", label: "Petty Cash", count: approvalCounts.pettyCash },
                ]}
              />

              <div
                key={approvalTab}
                className="dashboard-content-in min-h-[260px] rounded-[18px] bg-[#f5f5f7] dark:bg-[hsl(var(--card))] border border-black/[0.04] dark:border-[hsl(var(--border))] p-4"
              >
                {approvalTab === "transfers" ? (
                  <DashboardBranchTransferApprovals />
                ) : (
                  <DashboardPettyCashApprovals />
                )}
              </div>
            </section>
          )}
        </div>
      </DashboardShell>
    </>
  )
}
