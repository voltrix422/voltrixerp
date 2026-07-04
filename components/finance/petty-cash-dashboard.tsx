"use client"
import { useState, useEffect } from "react"
import { getPettyCashAllocations, getPettyCashReceipts, updatePettyCashAllocationStatus, updatePettyCashReceiptStatus, deletePettyCashAllocation, rejectPettyCashAllocation, type PettyCashAllocation, type PettyCashReceipt } from "@/lib/petty-cash"
import { PettyCashAllocation as PettyCashAllocationForm } from "./petty-cash-allocation"
import { PettyCashReceipt as PettyCashReceiptForm } from "./petty-cash-receipt"
import { PettyCashAllocationDetail } from "./petty-cash-allocation-detail"
import { PettyCashRequestForm } from "./petty-cash-request"
import { PettyCashApprovalForm } from "./petty-cash-approval"
import { PettyCashHistoryPanel } from "./petty-cash-history-panel"
import { PettyCashTopUp } from "./petty-cash-top-up"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { useAuthWithRole } from "@/components/auth-provider"
import { MODULE_LABELS, isErpAdmin } from "@/lib/auth"
import { Plus, DollarSign, Receipt, Eye, CheckCircle, XCircle, Clock, AlertCircle, Trash2 } from "lucide-react"
import { isPettyCashHistoryAllocation } from "@/lib/petty-cash-history"
import {
  allocationBelongsToUser,
  formatPettyCashBalance,
  formatPettyCashExpense,
  sumApprovedReceipts,
  sumCommittedReceipts,
  sumPendingReceipts,
} from "@/lib/petty-cash-display"
import {
  findPersonalLedger,
  getLedgerBalance,
  isPersonalLedgerAllocation,
} from "@/lib/petty-cash-personal"

export function PettyCashDashboard() {
  const { user, userRole } = useAuthWithRole()
  const currentUser = user?.name || ""
  const currentUserId = user?.id || ""
  const { toast } = useToast()
  const [allocations, setAllocations] = useState<PettyCashAllocation[]>([])
  const [receipts, setReceipts] = useState<PettyCashReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [showAllocationForm, setShowAllocationForm] = useState(false)
  const [showReceiptForm, setShowReceiptForm] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [approvalAllocation, setApprovalAllocation] = useState<PettyCashAllocation | null>(null)
  const [selectedAllocation, setSelectedAllocation] = useState<PettyCashAllocation | null>(null)
  const [activeTab, setActiveTab] = useState<"allocations" | "receipts" | "history">("allocations")
  const [settleConfirm, setSettleConfirm] = useState<PettyCashAllocation | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<PettyCashAllocation | null>(null)
  const [topUpAllocation, setTopUpAllocation] = useState<PettyCashAllocation | null>(null)
  const [migrationPreview, setMigrationPreview] = useState<{
    eligibleCount: number
    eligibleTotal: number
    expectedCount: number
    expectedTotal: number
  } | null>(null)
  const [migratingFinance, setMigratingFinance] = useState(false)
  const [reviewingReceiptId, setReviewingReceiptId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [allocationsData, receiptsData] = await Promise.all([
        getPettyCashAllocations(),
        getPettyCashReceipts()
      ])
      setAllocations(allocationsData)
      setReceipts(receiptsData)
      setSelectedAllocation(prev => {
        if (!prev) return prev
        return allocationsData.find(a => a.id === prev.id) ?? prev
      })
    } catch (error) {
      console.error("Error loading petty cash data:", error)
      toast({ title: "Error", message: "Failed to load petty cash data", type: "error" })
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "active":    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      case "settled":   return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      case "pending":   return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
      case "rejected":  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      case "approved":  return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      default:          return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
    }
  }

  function calculateSpentAmount(allocationId: string) {
    return sumApprovedReceipts(receipts, allocationId)
  }

  function calculateRemainingAmount(allocation: PettyCashAllocation) {
    return allocation.amount - sumCommittedReceipts(receipts, allocation.id)
  }

  async function handleSettleAllocation(allocation: PettyCashAllocation) {
    try {
      await updatePettyCashAllocationStatus(allocation.id, "settled", new Date().toISOString())
      setAllocations(prev =>
        prev.map(a => a.id === allocation.id ? { ...a, status: "settled", settledAt: new Date().toISOString() } : a)
      )
      toast({ title: "Success", message: "Petty cash allocation settled", type: "success" })
    } catch (error) {
      console.error("Error settling allocation:", error)
      toast({ title: "Error", message: "Failed to settle allocation", type: "error" })
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

  async function handleDeleteAllocation(allocation: PettyCashAllocation) {
    try {
      await deletePettyCashAllocation(allocation.id)
      setAllocations(prev => prev.filter(a => a.id !== allocation.id))
      setReceipts(prev => prev.filter(r => r.allocationId !== allocation.id))
      if (selectedAllocation?.id === allocation.id) {
        setSelectedAllocation(null)
      }
      toast({ title: "Deleted", message: "Petty cash allocation removed", type: "success" })
    } catch (error) {
      console.error("Error deleting allocation:", error)
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to delete allocation",
        type: "error"
      })
    }
  }

  const canManagePettyCash = isErpAdmin(userRole)

  useEffect(() => {
    if (!canManagePettyCash) return
    fetch("/api/finance/migrate-to-petty-cash")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.eligibleCount > 0) setMigrationPreview(data)
        else setMigrationPreview(null)
      })
      .catch(() => setMigrationPreview(null))
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
      return aPersonal - bPersonal
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading petty cash data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-green-600" />
          <div>
            <h2 className="text-xl font-bold">Petty Cash Management</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Request cash, add expense receipts, and track your petty cash balance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowRequestForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Request Cash
          </Button>
          {canManagePettyCash && (
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => setShowAllocationForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Allocate Cash
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowReceiptForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Receipt
          </Button>
        </div>
      </div>

      {canManagePettyCash && migrationPreview && migrationPreview.eligibleCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">One-time finance records migration</h3>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
              Move {migrationPreview.eligibleCount} finance records (PKR {migrationPreview.eligibleTotal.toLocaleString()}) into petty cash as negative balance under finance.
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs shrink-0"
            disabled={migratingFinance}
            onClick={handleMigrateFinanceRecords}
          >
            {migratingFinance ? "Migrating..." : "Move to Petty Cash"}
          </Button>
        </div>
      )}

      {canManagePettyCash && pendingRequests.length > 0 && (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Pending requests</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Approve requests with bank proof or record a cash payout before settlement starts.</p>
            </div>
            <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-full">{pendingRequests.length} waiting</span>
          </div>
          <div className="space-y-2">
            {pendingRequests.map((allocation) => (
              <div key={allocation.id} className="flex flex-col gap-3 rounded-lg border px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">{allocation.employeeName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{allocation.purpose}</p>
                  <p className="text-xs font-semibold mt-1">Requested: PKR {allocation.amount.toLocaleString()}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    Requested on: {new Date(allocation.allocatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => setApprovalAllocation(allocation)}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
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
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canManagePettyCash && (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Your petty cash balance</p>
            <p className={`text-2xl font-bold ${personalBalance < 0 ? "text-red-600" : "text-green-600"}`}>
              {formatPettyCashBalance(personalBalance)}
            </p>
            {personalPending > 0 && (
              <p className="text-[11px] text-amber-700 mt-1">
                Pending approval: {formatPettyCashExpense(personalPending)}
              </p>
            )}
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
              Negative balance = approved expenses; admin reimburses when paying you back.
            </p>
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={() => setShowReceiptForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Receipt
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Allocated</p>
              <p className="text-lg font-bold">PKR {displayAllocations.reduce((sum, a) => sum + a.amount, 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Spent</p>
              <p className="text-lg font-bold text-red-600">
                {formatPettyCashExpense(sumApprovedReceipts(displayReceipts))}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Active Allocations</p>
              <p className="text-lg font-bold">{displayAllocations.filter(a => a.status === "active").length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Pending Receipts</p>
              <p className="text-lg font-bold">{displayReceipts.filter(r => r.status === "pending").length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {(["allocations", "receipts", "history"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative capitalize ${
              activeTab === tab
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {tab === "history" ? "History" : tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
          </button>
        ))}
      </div>

      {/* Allocations Tab */}
      {activeTab === "allocations" && (
        <div className="space-y-4">
          {displayAllocations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <DollarSign className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No petty cash allocations found</p>
              <Button size="sm" className="mt-3 h-8 text-xs" onClick={() => setShowRequestForm(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Request Cash
              </Button>
              {canManagePettyCash && (
                <Button size="sm" variant="outline" className="mt-2 h-8 text-xs" onClick={() => setShowAllocationForm(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Allocate Cash
                </Button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 text-center">
                💡 Click on any row to view details and add expense receipts
              </p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-[hsl(var(--muted))]/40">
                      <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Employee</th>
                      <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Amount</th>
                      <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Purpose</th>
                      <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Spent</th>
                      <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Remaining</th>
                      <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
                      <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
                      <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayAllocations.map(allocation => {
                      const spent = calculateSpentAmount(allocation.id)
                      const remaining = calculateRemainingAmount(allocation)
                      return (
                        <tr
                          key={allocation.id}
                          className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedAllocation(allocation)}
                        >
                          <td className="px-4 py-2.5 text-xs">
                            <div className="flex items-center gap-2">
                              <Eye className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                              <div>
                                <p className="font-medium">{allocation.employeeName}</p>
                                <p className="text-[hsl(var(--muted-foreground))]">{allocation.employeeRole}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-semibold">PKR {allocation.amount.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-xs">{allocation.purpose}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-red-600">{formatPettyCashExpense(spent)}</td>
                          <td className={`px-4 py-2.5 text-xs font-semibold ${isPersonalLedgerAllocation(allocation) ? (remaining < 0 ? "text-red-600" : "text-green-600") : "text-green-600"}`}>
                            {isPersonalLedgerAllocation(allocation)
                              ? formatPettyCashBalance(remaining)
                              : `PKR ${remaining.toLocaleString()}`}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${getStatusColor(allocation.status)}`}>
                              {allocation.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                            {new Date(allocation.allocatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              {isPettyCashHistoryAllocation(allocation) && (
                                <button
                                  onClick={() => setSelectedAllocation(allocation)}
                                  className="text-[#1faca6] hover:text-[#17857f] text-[10px] font-medium transition-colors cursor-pointer"
                                  title="View history"
                                >
                                  History
                                </button>
                              )}
                              {canManagePettyCash &&
                                allocation.status === "active" &&
                                isPersonalLedgerAllocation(allocation) && (
                                <button
                                  onClick={() => setTopUpAllocation(allocation)}
                                  className="text-green-600 hover:text-green-800 text-[10px] font-medium transition-colors cursor-pointer"
                                  title="Add cash to this ledger"
                                >
                                  Add Cash
                                </button>
                              )}
                              {canManagePettyCash && allocation.status === "active" && (
                                <button
                                  onClick={() => setSettleConfirm(allocation)}
                                  className="text-blue-500 hover:text-blue-700 text-[10px] font-medium transition-colors cursor-pointer"
                                  title="Settle allocation"
                                >
                                  Settle
                                </button>
                              )}
                              {canManagePettyCash && (
                                <button
                                  onClick={() => setDeleteConfirm(allocation)}
                                  className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                                  title="Delete allocation"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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

      {/* Receipts Tab */}
      {activeTab === "receipts" && (
        <div className="space-y-4">
          {displayReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Receipt className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No receipts found</p>
              <Button size="sm" className="mt-3 h-8 text-xs" onClick={() => setShowReceiptForm(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Receipt
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-[hsl(var(--muted))]/40">
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Employee</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Description</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Amount</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Submitted</th>
                    <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayReceipts.map(receipt => (
                    <tr key={receipt.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors">
                      <td className="px-4 py-2.5 text-xs font-medium">{receipt.employeeName}</td>
                      <td className="px-4 py-2.5 text-xs">{receipt.description}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-red-600">
                        {formatPettyCashExpense(receipt.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${getStatusColor(receipt.status)}`}>
                          {receipt.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {new Date(receipt.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canManagePettyCash && receipt.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={reviewingReceiptId === receipt.id}
                                onClick={() => handleReviewReceipt(receipt, "approved")}
                                className="text-green-500 hover:text-green-700 cursor-pointer transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={reviewingReceiptId === receipt.id}
                                onClick={() => handleReviewReceipt(receipt, "rejected")}
                                className="text-red-500 hover:text-red-700 cursor-pointer transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {canManagePettyCash && receipt.status !== "pending" && (
                            <button
                              type="button"
                              disabled={reviewingReceiptId === receipt.id}
                              onClick={() => handleReviewReceipt(receipt, "pending")}
                              className="text-yellow-600 hover:text-yellow-800 text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                              title="Undo approval and move back to pending"
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        title="Delete Petty Cash Allocation"
        message={`Are you sure you want to delete the allocation for ${deleteConfirm?.employeeName}? This will also delete linked settlements.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm) handleDeleteAllocation(deleteConfirm)
          setDeleteConfirm(null)
        }}
        onCancel={() => setDeleteConfirm(null)}
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
    </div>
  )
}
