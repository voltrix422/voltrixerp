"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { useAuth } from "@/components/auth-provider"
import { getPOs, savePO, getSuppliers, STATUS_LABELS, STATUS_VARIANT, type PurchaseOrder, type Supplier } from "@/lib/purchase"
import { PODetail } from "@/components/purchase/po-detail"
import { Badge } from "@/components/ui/badge"
import { ComingSoon } from "@/components/layout/coming-soon"
import { useToast } from "@/components/ui/toast"
import { ClientOrdersApproval } from "@/components/dashboard/client-orders-approval"
import { DashboardBranchTransferApprovals } from "@/components/dashboard/branch-transfer-approvals-panel"
import { DashboardPettyCashApprovals } from "@/components/dashboard/petty-cash-approvals"
import { DashboardOverviewPanel } from "@/components/dashboard/dashboard-overview-panel"
import { FinanceReportPanel } from "@/components/dashboard/finance-report-panel"
import { useDashboardApprovalCounts } from "@/components/dashboard/use-dashboard-data"
import { isErpAdmin } from "@/lib/auth"
import {
  ApprovalTabs,
  ApprovalsSummaryChips,
  DashboardMainTabs,
  DashboardShell,
  type DashboardMainTab,
} from "@/components/dashboard/dashboard-ui"

function POsWidget({ showFilters, setShowFilters, onPendingChange }: { showFilters: boolean, setShowFilters: (value: boolean) => void, onPendingChange?: (count: number, openFirst: () => void) => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [notified, setNotified] = useState(false)
  const [subTab, setSubTab] = useState<"pending" | "approved" | "draft" | "rejected" | "received">("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  useEffect(() => {
    let mounted = true
    async function load() {
      const [allPos, supplierList] = await Promise.all([
        getPOs(),
        getSuppliers(),
      ])
      if (!mounted) return
      setPOs(allPos)
      setSuppliers(supplierList)
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (notified) return
    const pending = pos.filter(p => p.status === "sent_to_admin")
    if (pending.length > 0) {
      toast({
        type: "warning",
        title: `${pending.length} purchase order${pending.length > 1 ? "s" : ""} waiting for your approval`,
        message: "Go to the purchase orders table below to review.",
        duration: 6000,
      })
      setNotified(true)
    }
  }, [pos, notified, toast])

  useEffect(() => {
    const pending = pos.filter(p => p.status === "sent_to_admin")
    onPendingChange?.(pending.length, () => {
      const first = pending[0]
      if (first) setSelected(first)
    })
  }, [pos])

  async function handleUpdate(updated: PurchaseOrder) {
    await savePO(updated)
    setPOs(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSelected(updated)
  }

  const pendingPOs = pos.filter(p => p.status === "sent_to_admin")
  const approvedPOs = pos.filter(p => p.status === "approved" || p.status === "finalized")
  const draftPOs = pos.filter(p => p.status === "draft")
  const rejectedPOs = pos.filter(p => p.status === "rejected")
  const receivedPOs = pos.filter(p => p.status === "in_inventory" || p.status === "imp_inventory")

  // Apply filters
  const filterPOs = (poList: PurchaseOrder[]) => {
    return poList.filter(po => {
      // Search filter
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = !searchQuery ||
        po.poNumber.toLowerCase().includes(searchLower) ||
        po.supplierNames.some(s => s.toLowerCase().includes(searchLower)) ||
        po.createdBy.toLowerCase().includes(searchLower)

      // Date range filter
      const poDate = new Date(po.createdAt)
      const matchesDateFrom = !dateFrom || poDate >= new Date(dateFrom)
      const matchesDateTo = !dateTo || poDate <= new Date(dateTo + "T23:59:59")

      return matchesSearch && matchesDateFrom && matchesDateTo
    })
  }

  const filteredPending = filterPOs(pendingPOs)
  const filteredApproved = filterPOs(approvedPOs)
  const filteredDraft = filterPOs(draftPOs)
  const filteredRejected = filterPOs(rejectedPOs)
  const filteredReceived = filterPOs(receivedPOs)

  const displayPOs = subTab === "pending" ? filteredPending : subTab === "approved" ? filteredApproved : subTab === "draft" ? filteredDraft : subTab === "rejected" ? filteredRejected : filteredReceived
  const recent = displayPOs.slice(0, 8)

  return (
    <>
      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-2.5 space-y-2 mb-3">
          <div className="flex flex-wrap gap-2">
            <div className="w-32 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="PO, supplier..."
                className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <div className="w-32 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer"
              />
            </div>
            <div className="w-32 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer"
              />
            </div>
            <button
              onClick={() => { setSearchQuery(""); setDateFrom(""); setDateTo("") }}
              className="self-end px-2 py-1 text-[10px] border rounded hover:bg-[hsl(var(--muted))]/10 cursor-pointer transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Sub-tabs */}
        <div className="flex gap-1 border-b border-[hsl(var(--border))]/50">
          {(["pending", "approved", "received", "draft", "rejected"] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                subTab === t
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {t === "pending" ? "Pending" : t === "approved" ? "Approved" : t === "received" ? "Received" : t === "draft" ? "Draft" : "Rejected"}
              {subTab === t && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          ))}
        </div>

        {displayPOs.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
            {subTab === "pending"
              ? "No purchase orders pending approval."
              : subTab === "approved"
                ? "No approved purchase orders yet."
                : "No purchase orders in this view."}
          </p>
        ) : (
          <div className="rounded-lg border border-[hsl(var(--border))]/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]/50 bg-[hsl(var(--muted))]/40">
                  {["PO #", "Supplier", "Type", "Items", "Created By", "Date", "Status"].map(h => (
                    <th key={h} className="h-8 px-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]/50">
                {recent.map(po => {
                  const poNumberDisplay = (po.poNumber && po.poNumber.trim()) ? po.poNumber : `PO-${po.id.slice(0, 8)}`
                  const supplierNamesDisplay = (po.supplierNames && po.supplierNames.length > 0)
                    ? po.supplierNames.join(", ")
                    : po.quotes?.[0]?.supplierName || "â€”"
                  const dateDisplay = po.createdAt && !isNaN(new Date(po.createdAt).getTime())
                    ? new Date(po.createdAt).toLocaleDateString()
                    : "â€”"
                  return (
                    <tr key={po.id} className="hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer" onClick={() => setSelected(po)}>
                      <td className="px-4 py-2.5 font-medium text-[hsl(var(--primary))]">{poNumberDisplay}</td>
                      <td className="px-4 py-2.5 text-xs">{supplierNamesDisplay}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={po.type === "local" ? "success" : "info"} className="text-[10px] px-1.5 py-0">{po.type}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.items.length}</td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.createdBy || "â€”"}</td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{dateDisplay}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={STATUS_VARIANT[po.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[po.status]}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <PODetail
          po={selected}
          allSuppliers={suppliers}
          isAdmin={isErpAdmin(user?.role)}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mainTab, setMainTab] = useState<DashboardMainTab>("overview")
  const [approvalTab, setApprovalTab] = useState<"orders" | "po" | "transfers" | "petty">("orders")
  const [showPOFilters, setShowPOFilters] = useState(false)
  const approvalCounts = useDashboardApprovalCounts(!!user && isErpAdmin(user.role))

  useEffect(() => {
    if (searchParams?.get("manageUsers") === "1") {
      router.replace("/manage-users")
    }
  }, [searchParams, router])

  if (!user) return null

  if (!isErpAdmin(user.role)) {
    return (
      <>
        <Topbar title="Dashboard" description={`Welcome, ${user.name}`} />
        <ComingSoon title="Dashboard" />
      </>
    )
  }

  return (
    <>
      <Topbar
        title="Dashboard"
        description={`Welcome, ${user.name}`}
      />
      <DashboardShell>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <DashboardMainTabs
            active={mainTab}
            onChange={setMainTab}
            approvalsPending={approvalCounts.total}
          />
          {mainTab === "approvals" && approvalCounts.total > 0 && (
            <ApprovalsSummaryChips
              items={[
                { label: "CRM orders", count: approvalCounts.crmOrders },
                { label: "purchase orders", count: approvalCounts.purchaseOrders },
                { label: "transfers", count: approvalCounts.transfers },
                { label: "petty cash", count: approvalCounts.pettyCash },
              ]}
            />
          )}
        </div>

        {mainTab === "overview" ? (
          <DashboardOverviewPanel />
        ) : mainTab === "finance" ? (
          <FinanceReportPanel />
        ) : (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Pending approvals</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Review client orders, purchase orders, branch transfers, and petty cash requests.
              </p>
            </div>

            <ApprovalTabs
              active={approvalTab}
              onChange={(id) => setApprovalTab(id as typeof approvalTab)}
              tabs={[
                { id: "orders", label: "CRM Orders", count: approvalCounts.crmOrders },
                { id: "po", label: "Purchase Orders", count: approvalCounts.purchaseOrders },
                { id: "transfers", label: "Branch Transfers", count: approvalCounts.transfers },
                { id: "petty", label: "Petty Cash", count: approvalCounts.pettyCash },
              ]}
            />

            <div className="min-h-[280px] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className={approvalTab === "orders" ? "" : "hidden"}>
                <ClientOrdersApproval />
              </div>
              <div className={approvalTab === "po" ? "" : "hidden"}>
                <POsWidget showFilters={showPOFilters} setShowFilters={setShowPOFilters} />
              </div>
              <div className={approvalTab === "transfers" ? "" : "hidden"}>
                <DashboardBranchTransferApprovals />
              </div>
              <div className={approvalTab === "petty" ? "" : "hidden"}>
                <DashboardPettyCashApprovals />
              </div>
            </div>
          </section>
        )}
      </DashboardShell>
    </>
  )
}
