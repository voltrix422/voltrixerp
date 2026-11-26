"use client"
import { useState, useEffect } from "react"
import { getPettyCashAllocations, getPettyCashReceipts, getPettyCashReceiptById, updatePettyCashAllocationStatus, updatePettyCashReceiptStatus, rejectPettyCashAllocation, deletePettyCashAllocation, type PettyCashAllocation, type PettyCashReceipt } from "@/lib/petty-cash"
import { PettyCashAllocation as PettyCashAllocationForm } from "./petty-cash-allocation"
import { PettyCashReceipt as PettyCashReceiptForm } from "./petty-cash-receipt"
import { PettyCashAllocationDetail } from "./petty-cash-allocation-detail"
import { PettyCashRequestForm } from "./petty-cash-request"
import { PettyCashApprovalForm } from "./petty-cash-approval"
import { PettyCashHistoryPanel } from "./petty-cash-history-panel"
import { PettyCashTopUp } from "./petty-cash-top-up"
import { PettyCashPayOwed } from "./petty-cash-pay-owed"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { useAuthWithRole } from "@/components/auth-provider"
import { MODULE_LABELS, isErpAdmin } from "@/lib/auth"
import { Plus, CheckCircle, XCircle, Archive, FileText, FileDown, Search, Trash2 } from "lucide-react"
import { downloadMoneyApprovalPdf } from "@/lib/generate-petty-cash-pending-pdf"
import { isPettyCashHistoryAllocation } from "@/lib/petty-cash-history"
import {
  allocationBelongsToUser,
  formatPettyCashBalance,
  formatPettyCashExpense,
  formatAllocationBalanceCell,
  getAmountOwedToEmployee,
  getProjectedAmountOwed,
  summarizeAllocationReceipts,
  sumApprovedReceipts,
  sumPendingReceipts,
} from "@/lib/petty-cash-display"
import {
  findPersonalLedger,
  getLedgerBalance,
  isPersonalLedgerAllocation,
} from "@/lib/petty-cash-personal"

type AllocationStatusFilter = "active" | "pending" | "settled" | "rejected" | "cancelled" | "all"

const ALLOCATION_FILTERS: { id: AllocationStatusFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "settled", label: "Archived" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
]

function allocationStatusLabel(status: string) {
  if (status === "settled") return "archived"
  return status
}

export function PettyCashDashboard() {
  const { user, userRole } = useAuthWithRole()
  const currentUser = user?.name || ""
  const currentUserId = user?.id || ""
  const { toast } = useToast()
  const [allocations, setAllocations] = useState<PettyCashAllocation[]>([])
  const [receipts, setReceipts] = useState<PettyCashReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [receiptsLoading, setReceiptsLoading] = useState(true)
  const [showAllocationForm, setShowAllocationForm] = useState(false)
  const [showReceiptForm, setShowReceiptForm] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [approvalAllocation, setApprovalAllocation] = useState<PettyCashAllocation | null>(null)
  const [selectedAllocation, setSelectedAllocation] = useState<PettyCashAllocation | null>(null)
  const [activeTab, setActiveTab] = useState<"allocations" | "receipts" | "history">("allocations")
  const [allocationFilter, setAllocationFilter] = useState<AllocationStatusFilter>("active")
  const [settleConfirm, setSettleConfirm] = useState<PettyCashAllocation | null>(null)
  const [topUpAllocation, setTopUpAllocation] = useState<PettyCashAllocation | null>(null)
  const [payOwedAllocation, setPayOwedAllocation] = useState<{
    allocation: PettyCashAllocation
    owedAmount: number
  } | null>(null)
  const [migrationPreview, setMigrationPreview] = useState<{
    eligibleCount: number
    eligibleTotal: number
    expectedCount: number
    expectedTotal: number
  } | null>(null)
  const [migratingFinance, setMigratingFinance] = useState(false)
  const [reviewingReceiptId, setReviewingReceiptId] = useState<string | null>(null)
  const [pendingPdfBusy, setPendingPdfBusy] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<PettyCashAllocation | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setReceiptsLoading(true)
    try {
      const allocationsData = await getPettyCashAllocations()
      setAllocations(allocationsData)
      setSelectedAllocation(prev => {
        if (!prev) return prev
        return allocationsData.find(a => a.id === prev.id) ?? prev
      })
    } catch (error) {
      console.error("Error loading petty cash allocations:", error)
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to load petty cash allocations",
        type: "error",
      })
    } finally {
      setLoading(false)
    }

    try {
      const receiptsData = await getPettyCashReceipts()
      setReceipts(receiptsData)
    } catch (error) {
      console.error("Error loading petty cash receipts:", error)
      toast({
        title: "Warning",
        message: error instanceof Error ? error.message : "Receipts could not be loaded — try Refresh",
        type: "error",
      })
    } finally {
      setReceiptsLoading(false)
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "active":    return "bg-[#34c759]/14 text-[#248a3d]"
      case "settled":   return "bg-[#f2f2f7] text-[#6e6e73]"
      case "cancelled": return "bg-[#ff3b30]/12 text-[#d70015]"
      case "pending":   return "bg-[#ff9f0a]/16 text-[#9a6700]"
      case "rejected":  return "bg-[#ff3b30]/12 text-[#d70015]"
      case "approved":  return "bg-[#34c759]/14 text-[#248a3d]"
      default:          return "bg-[#f2f2f7] text-[#6e6e73]"
    }
  }

  function getAllocationSummary(allocation: PettyCashAllocation) {
    return summarizeAllocationReceipts(allocation, receipts)
  }

  async function handleSettleAllocation(allocation: PettyCashAllocation) {
    try {
      await updatePettyCashAllocationStatus(allocation.id, "settled", new Date().toISOString())
      setAllocations(prev =>
        prev.map(a => a.id === allocation.id ? { ...a, status: "settled", settledAt: new Date().toISOString() } : a)
      )
      toast({ title: "Success", message: "Petty cash moved to Archived", type: "success" })
      setAllocationFilter("active")
    } catch (error) {
      console.error("Error settling allocation:", error)
      toast({ title: "Error", message: "Failed to settle allocation", type: "error" })
    }
  }

  async function handleDeleteAllocation(allocation: PettyCashAllocation) {
    setDeleting(true)
    try {
      await deletePettyCashAllocation(allocation.id)
      setAllocations((prev) => prev.filter((a) => a.id !== allocation.id))
      setReceipts((prev) => prev.filter((r) => r.allocationId !== allocation.id))
      if (selectedAllocation?.id === allocation.id) setSelectedAllocation(null)
      setDeleteConfirm(null)
      toast({ title: "Deleted", message: `${allocation.referenceNumber || "Allocation"} removed.`, type: "success" })
    } catch (error) {
      console.error("Error deleting allocation:", error)
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to delete allocation",
        type: "error",
      })
    } finally {
      setDeleting(false)
    }
  }

  async function handleReviewReceipt(receipt: PettyCashReceipt, status: "pending" | "approved" | "rejected") {
    setReviewingReceiptId(receipt.id)
    try {
      const updated = await updatePettyCashReceiptStatus(receipt.id, status, currentUser, currentUserId)
      setReceipts((prev) => prev.map((r) => (r.id === receipt.id ? updated : r)))

      const allocation = allocations.find((a) => a.id === receipt.allocationId)
      if (status === "approved") {
        toast({
          title: "Receipt approved",
          message: allocation && isPersonalLedgerAllocation(allocation)
            ? `Expense ${formatPettyCashExpense(receipt.amount)} released to ${allocation.employeeName}.`
            : "Receipt approved.",
          type: "success",
        })
      } else if (status === "rejected") {
        toast({ title: "Receipt rejected", message: "Expense was not applied.", type: "success" })
      } else {
        toast({ title: "Moved to pending", message: "Receipt is pending admin review again.", type: "success" })
      }
      await loadData()
    } catch (error) {
      console.error("Error reviewing receipt:", error)
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to review receipt",
        type: "error",
      })
      await loadData()
    } finally {
      setReviewingReceiptId(null)
    }
  }

  const canManagePettyCash = isErpAdmin(userRole)

  useEffect(() => {
    if (!canManagePettyCash) return
    const timer = setTimeout(() => {
      fetch("/api/finance/migrate-to-petty-cash")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.eligibleCount > 0) setMigrationPreview(data)
          else setMigrationPreview(null)
        })
        .catch(() => setMigrationPreview(null))
    }, 800)
    return () => clearTimeout(timer)
  }, [canManagePettyCash])

  async function handleMigrateFinanceRecords() {
    if (
      !window.confirm(
        `Move ${migrationPreview?.eligibleCount ?? 0} finance records (PKR ${(migrationPreview?.eligibleTotal ?? 0).toLocaleString()}) to petty cash as a negative balance? This is a one-time action and cannot be undone.`,
      )
    ) {
      return
    }

    setMigratingFinance(true)
    try {
      const res = await fetch("/api/finance/migrate-to-petty-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          allocatedBy: currentUser || "Finance",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Migration failed")
      toast({ title: "Migration complete", message: data.message, type: "success" })
      setMigrationPreview(null)
      loadData()
    } catch (error) {
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Migration failed",
        type: "error",
      })
    } finally {
      setMigratingFinance(false)
    }
  }

  const belongsToCurrentUser = (allocation: PettyCashAllocation) =>
    allocationBelongsToUser(allocation, currentUserId, currentUser)
  const receiptBelongsToCurrentUser = (receipt: PettyCashReceipt) => {
    const allocation = allocations.find((item) => item.id === receipt.allocationId)
    if (allocation) return belongsToCurrentUser(allocation)
    return receipt.employeeName === currentUser
  }
  const displayAllocations = (canManagePettyCash ? allocations : allocations.filter(belongsToCurrentUser))
    .slice()
    .sort((a, b) => {
      const aPersonal = isPersonalLedgerAllocation(a) ? 0 : 1
      const bPersonal = isPersonalLedgerAllocation(b) ? 0 : 1
      if (aPersonal !== bPersonal) return aPersonal - bPersonal
      return new Date(b.allocatedAt).getTime() - new Date(a.allocatedAt).getTime()
    })
  const allocationFilterCounts: Record<AllocationStatusFilter, number> = {
    active: displayAllocations.filter((a) => a.status === "active").length,
    pending: displayAllocations.filter((a) => a.status === "pending").length,
    settled: displayAllocations.filter((a) => a.status === "settled").length,
    rejected: displayAllocations.filter((a) => a.status === "rejected").length,
    cancelled: displayAllocations.filter((a) => a.status === "cancelled").length,
    all: displayAllocations.length,
  }
  const filteredAllocations = displayAllocations.filter((allocation) => {
    if (allocationFilter !== "all" && allocation.status !== allocationFilter) return false
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      allocation.employeeName.toLowerCase().includes(q) ||
      allocation.purpose.toLowerCase().includes(q) ||
      (allocation.referenceNumber || "").toLowerCase().includes(q) ||
      allocation.employeeRole.toLowerCase().includes(q)
    )
  })
  const displayReceipts = canManagePettyCash ? receipts : receipts.filter(receiptBelongsToCurrentUser)
  const personalLedger = findPersonalLedger(allocations, currentUserId, currentUser)
  const personalBalance = personalLedger
    ? getLedgerBalance(personalLedger, receipts)
    : 0
  const personalPending = personalLedger
    ? sumPendingReceipts(receipts, personalLedger.id)
    : 0
  const pendingRequests = allocations.filter(
    (allocation) => allocation.status === "pending" && !isPersonalLedgerAllocation(allocation),
  )
  const employeeRole = isErpAdmin(userRole)
    ? "Super Admin"
    : user?.modules[0]
      ? MODULE_LABELS[user.modules[0]]
      : "Employee"

  async function openReceiptProof(receipt: PettyCashReceipt) {
    if (receipt.receiptProof) {
      window.open(receipt.receiptProof, "_blank", "noopener,noreferrer")
      return
    }
    try {
      const full = await getPettyCashReceiptById(receipt.id)
      if (full.receiptProof) {
        window.open(full.receiptProof, "_blank", "noopener,noreferrer")
      } else {
        toast({ title: "No proof", message: "This receipt has no attachment on file.", type: "error" })
      }
    } catch {
      toast({ title: "Error", message: "Could not load receipt proof.", type: "error" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[13px] text-[#86868b]">Loading…</p>
      </div>
    )
  }

  const totalAllocated = displayAllocations.reduce((sum, a) => sum + a.amount, 0)
  const totalSpent = sumApprovedReceipts(displayReceipts)
  const activeCount = displayAllocations.filter((a) => a.status === "active").length
  const pendingReceiptCount = displayReceipts.filter((r) => r.status === "pending").length

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">Petty Cash</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRequestForm(true)}
            className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Request
          </button>
          {canManagePettyCash && (
            <button
              type="button"
              onClick={() => setShowAllocationForm(true)}
              className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full bg-[#007aff] text-white text-[12px] font-semibold hover:bg-[#0066d6] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Allocate
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowReceiptForm(true)}
            className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Receipt
          </button>
        </div>
      </div>

      {canManagePettyCash && migrationPreview && migrationPreview.eligibleCount > 0 && (
        <div className="rounded-[16px] border border-[#ff9f0a]/30 bg-[#ff9f0a]/10 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-[#1d1d1f]">One-time finance records migration</h3>
            <p className="text-[12px] text-[#6e6e73] mt-1">
              Move {migrationPreview.eligibleCount} finance records (PKR {migrationPreview.eligibleTotal.toLocaleString()}) into petty cash as negative balance under finance.
            </p>
          </div>
          <button
            type="button"
            className="h-8 px-3.5 rounded-full bg-[#1d1d1f] text-white text-[12px] font-semibold shrink-0 disabled:opacity-50 cursor-pointer"
            disabled={migratingFinance}
            onClick={handleMigrateFinanceRecords}
          >
            {migratingFinance ? "Migrating..." : "Move to Petty Cash"}
          </button>
        </div>
      )}

      {canManagePettyCash && pendingRequests.length > 0 && (
        <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <div className="px-5 py-4 border-b border-black/[0.05] flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Pending requests</h3>
              <p className="text-[12px] text-[#86868b] mt-0.5">
                Approve with bank proof or record a cash payout.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={pendingPdfBusy}
                onClick={async () => {
                  setPendingPdfBusy(true)
                  try {
                    await downloadMoneyApprovalPdf({ pendingRequests, includeLedgerDues: false })
                  } catch (error) {
                    toast({
                      title: "PDF failed",
                      message: error instanceof Error ? error.message : "Could not download PDF.",
                      type: "error",
                    })
                  } finally {
                    setPendingPdfBusy(false)
                  }
                }}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] disabled:opacity-50 cursor-pointer"
              >
                <FileDown className="h-3.5 w-3.5" />
                {pendingPdfBusy ? "PDF…" : "PDF"}
              </button>
              <span className="text-[11px] font-semibold text-[#9a6700] bg-[#ff9f0a]/16 px-2.5 py-1 rounded-full">
                {pendingRequests.length} waiting
              </span>
            </div>
          </div>
          <div className="divide-y divide-black/[0.045]">
            {pendingRequests.map((allocation) => (
              <div
                key={allocation.id}
                className="px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  {allocation.referenceNumber ? (
                    <p className="text-[11px] font-semibold text-[#007aff] tabular-nums">
                      {allocation.referenceNumber}
                    </p>
                  ) : null}
                  <p className="text-[14px] font-semibold text-[#1d1d1f] mt-0.5">{allocation.employeeName}</p>
                  <p className="text-[12px] text-[#86868b] mt-0.5">{allocation.purpose}</p>
                  <p className="text-[12px] font-semibold text-[#1d1d1f] mt-1.5 tabular-nums">
                    PKR {allocation.amount.toLocaleString()}
                    <span className="font-normal text-[#aeaeb2]"> · {new Date(allocation.allocatedAt).toLocaleString()}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="h-8 px-3.5 rounded-full bg-[#34c759] text-white text-[12px] font-semibold hover:bg-[#2db350] cursor-pointer"
                    onClick={() => setApprovalAllocation(allocation)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="h-8 px-3.5 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] cursor-pointer"
                    onClick={async () => {
                      try {
                        const updated = await rejectPettyCashAllocation(allocation.id, currentUser, "Rejected by approver")
                        setAllocations((prev) => prev.map((item) => item.id === updated.id ? updated : item))
                        toast({ title: "Rejected", message: "Petty cash request rejected.", type: "success" })
                      } catch (error) {
                        console.error(error)
                        toast({ title: "Error", message: "Failed to reject request.", type: "error" })
                      }
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canManagePettyCash && (
        <div className="rounded-[18px] border border-black/[0.06] bg-white p-5 flex flex-wrap items-center justify-between gap-3 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <div>
            <p className="text-[12px] text-[#86868b]">Your balance</p>
            <p className={`text-[28px] font-semibold tracking-tight tabular-nums ${personalBalance < 0 ? "text-[#ff3b30]" : "text-[#34c759]"}`}>
              {formatPettyCashBalance(personalBalance)}
            </p>
            {personalPending > 0 && (
              <p className="text-[11px] text-[#9a6700] mt-1">
                Pending approval: {formatPettyCashExpense(personalPending)}
              </p>
            )}
          </div>
          <button
            type="button"
            className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full bg-[#007aff] text-white text-[12px] font-semibold hover:bg-[#0066d6] cursor-pointer"
            onClick={() => setShowReceiptForm(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Add Receipt
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Allocated", value: `PKR ${totalAllocated.toLocaleString()}`, tone: "text-[#1d1d1f]" },
          { label: "Spent", value: formatPettyCashExpense(totalSpent), tone: "text-[#ff3b30]" },
          { label: "Active", value: String(activeCount), tone: "text-[#1d1d1f]" },
          { label: "Pending receipts", value: String(pendingReceiptCount), tone: "text-[#9a6700]" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[16px] border border-black/[0.06] bg-white px-4 py-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
          >
            <p className="text-[11px] font-medium text-[#86868b]">{stat.label}</p>
            <p className={`text-[17px] font-semibold tracking-tight tabular-nums mt-1 ${stat.tone}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="inline-flex p-1 rounded-full bg-[#e8e8ed]">
        {([
          { id: "allocations" as const, label: "Allocations" },
          { id: "receipts" as const, label: "Receipts" },
          { id: "history" as const, label: "Archived" },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === "history") setAllocationFilter("settled")
              if (tab.id === "allocations" && allocationFilter === "settled") setAllocationFilter("active")
            }}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "allocations" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {ALLOCATION_FILTERS.map((filter) => {
                const count = allocationFilterCounts[filter.id]
                const selected = allocationFilter === filter.id
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setAllocationFilter(filter.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                      selected
                        ? "bg-[#1d1d1f] text-white"
                        : "bg-white border border-black/[0.08] text-[#6e6e73] hover:text-[#1d1d1f]"
                    }`}
                  >
                    {filter.id === "settled" && <Archive className="h-3 w-3" />}
                    {filter.label}
                    <span className={`tabular-nums ${selected ? "text-white/70" : "text-[#aeaeb2]"}`}>{count}</span>
                  </button>
                )
              })}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#aeaeb2]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, ref, purpose…"
                className="h-9 w-full rounded-full border-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] pl-9 pr-3 text-[12px] outline-none focus:ring-2 focus:ring-[#007aff]/25"
              />
            </div>
          </div>

          {filteredAllocations.length === 0 ? (
            <div className="rounded-[18px] border border-black/[0.06] bg-white py-16 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <p className="text-[14px] font-medium text-[#1d1d1f]">
                {searchQuery.trim()
                  ? `No matches for “${searchQuery.trim()}”`
                  : allocationFilter === "all"
                    ? "No allocations yet"
                    : allocationFilter === "settled"
                      ? "No archived allocations"
                      : `No ${allocationFilter} allocations`}
              </p>
              {allocationFilter === "active" && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    className="h-8 px-3.5 rounded-full bg-[#007aff] text-white text-[12px] font-semibold cursor-pointer"
                    onClick={() => setShowRequestForm(true)}
                  >
                    Request Cash
                  </button>
                  {canManagePettyCash && (
                    <button
                      type="button"
                      className="h-8 px-3.5 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold cursor-pointer"
                      onClick={() => setShowAllocationForm(true)}
                    >
                      Allocate Cash
                    </button>
                  )}
                </div>
              )}
              {allocationFilter !== "active" && allocationFilter !== "all" && (
                <button
                  type="button"
                  className="mt-4 h-8 px-3.5 rounded-full border border-black/[0.08] bg-white text-[12px] font-semibold cursor-pointer"
                  onClick={() => setAllocationFilter("active")}
                >
                  View active
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-black/[0.05]">
                      {[
                        "Ref",
                        "Employee",
                        "Given",
                        "Purpose",
                        "Approved",
                        "Pending",
                        "Balance",
                        ...(canManagePettyCash ? ["Owed"] : []),
                        "Status",
                        "Date",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#86868b] ${
                            h === "Actions" ? "text-center" : "text-left"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045]">
                    {filteredAllocations.map((allocation) => {
                      const summary = getAllocationSummary(allocation)
                      const balance = formatAllocationBalanceCell(summary.balanceAfterApproved)
                      const projected = formatAllocationBalanceCell(summary.balanceAfterPending)
                      const owedToEmployee = getAmountOwedToEmployee(summary)
                      const projectedOwed = getProjectedAmountOwed(summary)
                      return (
                        <tr
                          key={allocation.id}
                          className="hover:bg-[#f5f8ff] transition-colors cursor-pointer align-top"
                          onClick={() => setSelectedAllocation(allocation)}
                        >
                          <td className="px-4 py-3.5 text-[12px]">
                            <p className="font-semibold text-[#007aff] tabular-nums whitespace-nowrap">
                              {allocation.referenceNumber || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 text-[12px]">
                            <p className="font-semibold text-[#1d1d1f]">{allocation.employeeName}</p>
                            <p className="text-[10px] text-[#86868b] mt-0.5">{allocation.employeeRole}</p>
                            {summary.isPersonalLedger && (
                              <span className="inline-block mt-1 text-[9px] uppercase tracking-wide text-[#007aff] font-semibold">
                                Personal ledger
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-[12px] font-semibold tabular-nums text-[#1d1d1f]">
                            PKR {summary.allocated.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-[12px] text-[#1d1d1f] max-w-[160px]">
                            <p className="line-clamp-2" title={allocation.purpose}>{allocation.purpose}</p>
                          </td>
                          <td className="px-4 py-3.5 text-[12px]">
                            <p className="font-semibold text-[#ff3b30] tabular-nums">
                              {summary.approvedSpent > 0
                                ? formatPettyCashExpense(summary.approvedSpent)
                                : "—"}
                            </p>
                            <p className="text-[10px] text-[#aeaeb2] mt-0.5">
                              {summary.approvedCount} approved
                            </p>
                          </td>
                          <td className="px-4 py-3.5 text-[12px]">
                            {summary.pendingSpent > 0 ? (
                              <>
                                <p className="font-semibold text-[#9a6700] tabular-nums">
                                  {formatPettyCashExpense(summary.pendingSpent)}
                                </p>
                                <p className="text-[10px] text-[#9a6700]/80 mt-0.5">
                                  {summary.pendingCount} waiting
                                </p>
                              </>
                            ) : (
                              <p className="text-[#aeaeb2]">—</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-[12px]">
                            <p className={`font-semibold tabular-nums ${balance.className}`}>{balance.text}</p>
                            {summary.pendingSpent > 0 && (
                              <p className={`text-[10px] mt-1 tabular-nums ${projected.className}`}>
                                → {projected.text} if pending
                              </p>
                            )}
                          </td>
                          {canManagePettyCash && (
                            <td className="px-4 py-3.5 text-[12px]">
                              {owedToEmployee ? (
                                <p className="font-semibold text-[#ff3b30] tabular-nums">
                                  {formatPettyCashExpense(owedToEmployee)}
                                </p>
                              ) : projectedOwed ? (
                                <p className="text-[10px] text-[#9a6700] tabular-nums">
                                  → {formatPettyCashExpense(projectedOwed)} if pending
                                </p>
                              ) : summary.approvedOverage > 0 ? (
                                <p className="font-semibold text-[#ff3b30] tabular-nums">
                                  {formatPettyCashExpense(summary.approvedOverage)}
                                </p>
                              ) : (
                                <p className="text-[#aeaeb2]">—</p>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3.5 text-[12px]">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(allocation.status)}`}>
                              {allocationStatusLabel(allocation.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-[12px] text-[#86868b] whitespace-nowrap">
                            {new Date(allocation.allocatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3.5 text-[11px] text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              {isPettyCashHistoryAllocation(allocation) && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAllocation(allocation)}
                                  className="text-[#007aff] hover:underline font-semibold cursor-pointer"
                                >
                                  History
                                </button>
                              )}
                              {canManagePettyCash &&
                                allocation.status === "active" &&
                                isPersonalLedgerAllocation(allocation) && (
                                <button
                                  type="button"
                                  onClick={() => setTopUpAllocation(allocation)}
                                  className="text-[#34c759] hover:underline font-semibold cursor-pointer"
                                >
                                  Add Cash
                                </button>
                              )}
                              {canManagePettyCash && allocation.status === "active" && owedToEmployee && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPayOwedAllocation({ allocation, owedAmount: owedToEmployee })
                                  }
                                  className="text-[#ff3b30] hover:underline font-semibold cursor-pointer"
                                >
                                  Pay & settle
                                </button>
                              )}
                              {canManagePettyCash &&
                                allocation.status === "active" &&
                                !owedToEmployee && (
                                <button
                                  type="button"
                                  onClick={() => setSettleConfirm(allocation)}
                                  className="text-[#007aff] hover:underline font-semibold cursor-pointer"
                                >
                                  Settle
                                </button>
                              )}
                              {canManagePettyCash && !isPersonalLedgerAllocation(allocation) && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm(allocation)}
                                  className="text-[#ff3b30] hover:underline font-semibold cursor-pointer inline-flex items-center gap-0.5"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "receipts" && (
        <div className="space-y-4">
          {displayReceipts.length === 0 ? (
            <div className="rounded-[18px] border border-black/[0.06] bg-white py-16 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <p className="text-[14px] font-medium text-[#1d1d1f]">No receipts yet</p>
              <button
                type="button"
                className="mt-4 h-8 px-3.5 rounded-full bg-[#007aff] text-white text-[12px] font-semibold cursor-pointer"
                onClick={() => setShowReceiptForm(true)}
              >
                Add Receipt
              </button>
            </div>
          ) : (
            <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-black/[0.05]">
                      {["Employee", "Category", "Description", "Amount", "Status", "Submitted", "Proof", "Actions"].map((h) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#86868b] ${
                            h === "Proof" || h === "Actions" ? "text-center" : "text-left"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045]">
                    {displayReceipts.map((receipt) => (
                      <tr key={receipt.id} className="hover:bg-[#f5f8ff] transition-colors">
                        <td className="px-4 py-3.5 text-[12px] font-semibold text-[#1d1d1f]">{receipt.employeeName}</td>
                        <td className="px-4 py-3.5 text-[12px] text-[#86868b]">{receipt.category || "—"}</td>
                        <td className="px-4 py-3.5 text-[12px] text-[#1d1d1f] max-w-[220px]">
                          <p className="line-clamp-2">{receipt.description}</p>
                        </td>
                        <td className="px-4 py-3.5 text-[12px] font-semibold text-[#ff3b30] tabular-nums">
                          {formatPettyCashExpense(receipt.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-[12px]">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(receipt.status)}`}>
                            {receipt.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[12px] text-[#86868b] whitespace-nowrap">
                          {new Date(receipt.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 text-[12px] text-center">
                          {receipt.receiptProof || receipt.hasReceiptProof ? (
                            <button
                              type="button"
                              onClick={() => void openReceiptProof(receipt)}
                              className="inline-flex items-center justify-center text-[#007aff] hover:text-[#0066d6] cursor-pointer"
                              title={receipt.receiptProofName || "View receipt proof"}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="text-[#aeaeb2]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[12px] text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canManagePettyCash && receipt.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  disabled={reviewingReceiptId === receipt.id}
                                  onClick={() => handleReviewReceipt(receipt, "approved")}
                                  className="text-[#34c759] hover:text-[#248a3d] cursor-pointer disabled:opacity-50"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={reviewingReceiptId === receipt.id}
                                  onClick={() => handleReviewReceipt(receipt, "rejected")}
                                  className="text-[#ff3b30] hover:text-[#d70015] cursor-pointer disabled:opacity-50"
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <PettyCashHistoryPanel
          allocations={displayAllocations}
          receipts={displayReceipts}
          onViewHistory={setSelectedAllocation}
        />
      )}

      {/* Forms */}
      {showAllocationForm && (
        <PettyCashAllocationForm
          onClose={() => setShowAllocationForm(false)}
          onSave={(allocation) => {
            setAllocations(prev => [allocation, ...prev])
            setShowAllocationForm(false)
          }}
        />
      )}

      {showReceiptForm && (
        <PettyCashReceiptForm
          onClose={() => setShowReceiptForm(false)}
          onSave={(receipt) => {
            setReceipts(prev => [receipt, ...prev])
            setShowReceiptForm(false)
            loadData()
          }}
          employeeName={currentUser}
          employeeId={currentUserId}
          employeeRole={employeeRole}
        />
      )}

      {showRequestForm && currentUserId && (
        <PettyCashRequestForm
          employeeId={currentUserId}
          employeeName={currentUser}
          employeeRole={employeeRole}
          onClose={() => setShowRequestForm(false)}
          onSave={(allocation) => {
            setAllocations(prev => [allocation, ...prev])
            setShowRequestForm(false)
          }}
        />
      )}

      {approvalAllocation && (
        <PettyCashApprovalForm
          allocation={approvalAllocation}
          reviewedBy={currentUser}
          onClose={() => setApprovalAllocation(null)}
          onSave={(allocation) => {
            setAllocations(prev => prev.map(item => item.id === allocation.id ? allocation : item))
            setApprovalAllocation(null)
          }}
        />
      )}

      {/* Settle Confirmation */}
      <ConfirmDialog
        isOpen={!!settleConfirm}
        title="Settle Petty Cash Allocation"
        message={`Are you sure you want to settle the petty cash allocation for ${settleConfirm?.employeeName}? This will mark it as closed.`}
        confirmText="Settle"
        cancelText="Cancel"
        variant="info"
        onConfirm={() => {
          if (settleConfirm) handleSettleAllocation(settleConfirm)
          setSettleConfirm(null)
        }}
        onCancel={() => setSettleConfirm(null)}
      />

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete petty cash"
        message={`Delete ${deleteConfirm?.referenceNumber || "this allocation"} for ${deleteConfirm?.employeeName}? This cannot be undone.`}
        confirmText={deleting ? "Deleting…" : "Delete"}
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm && !deleting) void handleDeleteAllocation(deleteConfirm)
        }}
        onCancel={() => {
          if (!deleting) setDeleteConfirm(null)
        }}
      />

      {/* Allocation Detail Modal */}
      {selectedAllocation && (
        <PettyCashAllocationDetail
          allocation={selectedAllocation}
          currentUser={currentUser}
          currentUserId={currentUserId}
          userRole={userRole || "user"}
          onClose={() => setSelectedAllocation(null)}
          onUpdate={loadData}
        />
      )}

      {topUpAllocation && (
        <PettyCashTopUp
          allocation={topUpAllocation}
          allocatedBy={currentUser || "Admin"}
          onClose={() => setTopUpAllocation(null)}
          onSave={(updated) => {
            setAllocations((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item)),
            )
            setTopUpAllocation(null)
            loadData()
          }}
        />
      )}

      {payOwedAllocation && (
        <PettyCashPayOwed
          allocation={payOwedAllocation.allocation}
          owedAmount={payOwedAllocation.owedAmount}
          paidBy={currentUser || "Admin"}
          onClose={() => setPayOwedAllocation(null)}
          onComplete={loadData}
        />
      )}
    </div>
  )
}
