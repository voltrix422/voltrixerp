"use client"
import { useState, useEffect } from "react"
import { getPettyCashAllocations, getPettyCashReceipts, updatePettyCashAllocationStatus, updatePettyCashReceiptStatus, deletePettyCashAllocation, type PettyCashAllocation, type PettyCashReceipt } from "@/lib/petty-cash"
import { PettyCashAllocation as PettyCashAllocationForm } from "./petty-cash-allocation"
import { PettyCashReceipt as PettyCashReceiptForm } from "./petty-cash-receipt"
import { PettyCashAllocationDetail } from "./petty-cash-allocation-detail"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { Plus, DollarSign, Receipt, Eye, CheckCircle, XCircle, Clock, AlertCircle, Trash2 } from "lucide-react"

interface PettyCashDashboardProps {
  currentUser: string
  userRole: string
}

export function PettyCashDashboard({ currentUser, userRole }: PettyCashDashboardProps) {
  const { toast } = useToast()
  const [allocations, setAllocations] = useState<PettyCashAllocation[]>([])
  const [receipts, setReceipts] = useState<PettyCashReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [showAllocationForm, setShowAllocationForm] = useState(false)
  const [showReceiptForm, setShowReceiptForm] = useState(false)
  const [selectedAllocation, setSelectedAllocation] = useState<PettyCashAllocation | null>(null)
  const [activeTab, setActiveTab] = useState<"allocations" | "receipts">("allocations")
  const [settleConfirm, setSettleConfirm] = useState<PettyCashAllocation | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<PettyCashAllocation | null>(null)

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
      case "approved":  return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      case "rejected":  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      default:          return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
    }
  }

  function calculateSpentAmount(allocationId: string) {
    return receipts
      .filter(r => r.allocationId === allocationId && r.status === "approved")
      .reduce((sum, r) => sum + r.amount, 0)
  }

  function calculateRemainingAmount(allocation: PettyCashAllocation) {
    return allocation.amount - calculateSpentAmount(allocation.id)
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

  async function handleReviewReceipt(receipt: PettyCashReceipt, status: "approved" | "rejected") {
    try {
      await updatePettyCashReceiptStatus(receipt.id, status, currentUser)
      const updatedReceipts = receipts.map(r =>
        r.id === receipt.id ? { ...r, status, reviewedBy: currentUser, reviewedAt: new Date().toISOString() } : r
      )
      setReceipts(updatedReceipts)

      if (status === "approved") {
        // Check auto-settle using updated receipts
        const allocation = allocations.find(a => a.id === receipt.allocationId)
        if (allocation) {
          const totalSpent = updatedReceipts
            .filter(r => r.allocationId === receipt.allocationId && r.status === "approved")
            .reduce((sum, r) => sum + r.amount, 0)
          if (totalSpent >= allocation.amount) {
            await updatePettyCashAllocationStatus(allocation.id, "settled", new Date().toISOString())
            setAllocations(prev =>
              prev.map(a => a.id === allocation.id ? { ...a, status: "settled", settledAt: new Date().toISOString() } : a)
            )
            toast({
              title: "Auto-Settled",
              message: `Allocation for ${allocation.employeeName} has been automatically settled`,
              type: "success"
            })
          }
        }
      }

      toast({ title: "Success", message: `Receipt ${status}`, type: "success" })
    } catch (error) {
      console.error("Error reviewing receipt:", error)
      toast({ title: "Error", message: "Failed to review receipt", type: "error" })
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

  const canManagePettyCash = userRole === "admin" || userRole === "superadmin" || userRole === "finance"
  const displayAllocations = canManagePettyCash ? allocations : allocations.filter(a => a.employeeName === currentUser)
  const displayReceipts = canManagePettyCash ? receipts : receipts.filter(r => r.employeeName === currentUser)

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
              Track allocations and submit multiple settlements until fully closed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManagePettyCash && (
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => setShowAllocationForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Allocate Cash
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowReceiptForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Settlement
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Allocated</p>
              <p className="text-lg font-bold">PKR {allocations.reduce((sum, a) => sum + a.amount, 0).toLocaleString()}</p>
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
              <p className="text-lg font-bold">PKR {receipts.filter(r => r.status === "approved").reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</p>
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
              <p className="text-lg font-bold">{allocations.filter(a => a.status === "active").length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Pending Settlements</p>
              <p className="text-lg font-bold">{receipts.filter(r => r.status === "pending").length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {(["allocations", "receipts"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative capitalize ${
              activeTab === tab
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {tab}
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
              {canManagePettyCash && (
                <Button size="sm" className="mt-3 h-8 text-xs" onClick={() => setShowAllocationForm(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Allocate Cash
                </Button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 text-center">
                💡 Click on any row to view details and submit settlement receipts
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
                          <td className="px-4 py-2.5 text-xs font-semibold text-blue-600">PKR {spent.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-green-600">PKR {remaining.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-xs">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${getStatusColor(allocation.status)}`}>
                              {allocation.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                            {new Date(allocation.allocatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-center" onClick={e => e.stopPropagation()}>
                            {canManagePettyCash && (
                              <div className="flex items-center justify-center gap-2">
                                {allocation.status === "active" && (
                                  <button
                                    onClick={() => setSettleConfirm(allocation)}
                                    className="text-blue-500 hover:text-blue-700 text-[10px] font-medium transition-colors cursor-pointer"
                                    title="Settle allocation"
                                  >
                                    Settle
                                  </button>
                                )}
                                <button
                                  onClick={() => setDeleteConfirm(allocation)}
                                  className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                                  title="Delete allocation"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
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
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No settlements found</p>
              <Button size="sm" className="mt-3 h-8 text-xs" onClick={() => setShowReceiptForm(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Settlement
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
                      <td className="px-4 py-2.5 text-xs font-semibold">PKR {receipt.amount.toLocaleString()}</td>
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
                                onClick={() => handleReviewReceipt(receipt, "approved")}
                                className="text-green-500 hover:text-green-700 cursor-pointer transition-colors"
                                title="Approve"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleReviewReceipt(receipt, "rejected")}
                                className="text-red-500 hover:text-red-700 cursor-pointer transition-colors"
                                title="Reject"
                              >
                                <XCircle className="h-3.5 w-3.5" />
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
          )}
        </div>
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
          }}
          employeeName={currentUser}
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
          userRole={userRole}
          onClose={() => setSelectedAllocation(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  )
}
