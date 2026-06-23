"use client"
import { useState, useEffect } from "react"
import {
  PettyCashAllocation,
  PettyCashReceipt,
  getPettyCashReceipts,
  createPettyCashReceipt,
  updatePettyCashAllocationStatus,
  updatePettyCashReceiptStatus,
  deletePettyCashReceipt,
} from "@/lib/petty-cash"
import {
  allocationBelongsToUser,
  formatPettyCashBalance,
  formatPettyCashExpense,
  getAllocationRemaining,
  sumApprovedReceipts,
  sumPendingReceipts,
} from "@/lib/petty-cash-display"
import { isPersonalLedgerAllocation } from "@/lib/petty-cash-personal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { useAuthWithRole } from "@/components/auth-provider"
import { isErpAdmin } from "@/lib/auth"
import { PettyCashActivityTimeline } from "./petty-cash-history-panel"
import { PettyCashTopUp } from "./petty-cash-top-up"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Receipt, CheckCircle, XCircle, FileText, DollarSign, Calendar, Target, Trash2 } from "lucide-react"

interface PettyCashAllocationDetailProps {
  allocation: PettyCashAllocation
  currentUser: string
  currentUserId?: string
  userRole: string
  onClose: () => void
  onUpdate: () => void
}

export function PettyCashAllocationDetail({ allocation, currentUser, currentUserId, userRole, onClose, onUpdate }: PettyCashAllocationDetailProps) {
  const { user } = useAuthWithRole()
  const { toast } = useToast()
  const [receipts, setReceipts] = useState<PettyCashReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [showReceiptForm, setShowReceiptForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Receipt form state
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("")
  const [deleteReceiptConfirm, setDeleteReceiptConfirm] = useState<PettyCashReceipt | null>(null)
  const [deletingReceipt, setDeletingReceipt] = useState(false)
  const [showTopUp, setShowTopUp] = useState(false)

  useEffect(() => {
    loadReceipts()
  }, [allocation.id])

  async function loadReceipts() {
    try {
      const allReceipts = await getPettyCashReceipts()
      const allocationReceipts = allReceipts.filter(r => r.allocationId === allocation.id)
      setReceipts(allocationReceipts)
    } catch (error) {
      console.error('Error loading receipts:', error)
      toast({
        title: "Error",
        message: "Failed to load receipts",
        type: "error"
      })
    } finally {
      setLoading(false)
    }
  }

  const isPersonal = isPersonalLedgerAllocation(allocation)
  const totalSpent = sumApprovedReceipts(receipts, allocation.id)
  const pendingTotal = sumPendingReceipts(receipts, allocation.id)
  const remainingAmount = getAllocationRemaining(allocation, receipts)
  const progressPercentage = allocation.amount > 0 ? (totalSpent / allocation.amount) * 100 : 0

  async function handleFileUpload(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('files', file)
    formData.append('folder', 'petty-cash')
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error('Failed to upload file')
    }
    
    const data = await response.json()
    return data.urls[0]
  }

  async function submitReceipt() {
    if (!description || !amount || !receiptFile) {
      toast({
        title: "Missing Information",
        message: "Please fill all required fields and attach settlement proof",
        type: "error"
      })
      return
    }

    if (
      !isPersonalLedgerAllocation(allocation) &&
      parseFloat(amount) > remainingAmount
    ) {
      toast({
        title: "Amount Exceeds Remaining Balance",
        message: `Maximum amount available: PKR ${remainingAmount.toLocaleString()}`,
        type: "error"
      })
      return
    }

    setLoading(true)
    setUploading(true)
    
    try {
      let receiptProofUrl = ""
      let receiptProofFileName = ""
      
      if (receiptFile) {
        receiptProofUrl = await handleFileUpload(receiptFile)
        receiptProofFileName = receiptFile.name
      }

      const newReceipt = await createPettyCashReceipt({
        allocationId: allocation.id,
        employeeName: allocation.employeeName,
        description,
        amount: parseFloat(amount),
        receiptProof: receiptProofUrl || undefined,
        receiptProofName: receiptProofFileName || undefined,
        notes: notes.trim(),
        submittedBy: currentUser || allocation.employeeName,
      })

      setReceipts(prev => [newReceipt, ...prev])

      toast({
        title: isPersonal ? "Sent for approval" : "Success",
        message: isPersonal
          ? "Receipt sent to admin. Balance updates after approval."
          : isOwnAllocation
            ? `Receipt recorded. ${formatPettyCashExpense(parseFloat(amount))} released from petty cash.`
            : "Receipt submitted for approval.",
        type: "success"
      })

      // Reset form
      setDescription("")
      setAmount("")
      setNotes("")
      setReceiptFile(null)
      setReceiptPreviewUrl("")
      setShowReceiptForm(false)
      onUpdate()
    } catch (error) {
      console.error("Error submitting settlement:", error)
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to submit settlement",
        type: "error"
      })
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  async function handleDeleteReceipt(receipt: PettyCashReceipt) {
    setDeletingReceipt(true)
    try {
      const result = await deletePettyCashReceipt(receipt.id)
      setReceipts(prev => prev.filter(r => r.id !== receipt.id))
      setDeleteReceiptConfirm(null)
      toast({
        title: "Settlement deleted",
        message: result.restoredAmount > 0
          ? `PKR ${result.restoredAmount.toLocaleString()} restored to allocation balance.`
          : "Settlement removed from history.",
        type: "success",
      })
      onUpdate()
    } catch (error) {
      console.error("Error deleting settlement:", error)
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to delete settlement",
        type: "error",
      })
    } finally {
      setDeletingReceipt(false)
    }
  }

  async function handleReviewReceipt(receipt: PettyCashReceipt, status: 'approved' | 'rejected') {
    try {
      await updatePettyCashReceiptStatus(receipt.id, status, currentUser, currentUserId || "")
      const updatedReceipts = receipts.map(r => 
        r.id === receipt.id 
          ? { ...r, status, reviewedBy: currentUser, reviewedAt: new Date().toISOString() }
          : r
      )
      setReceipts(updatedReceipts)
      
      if (status === "approved") {
        toast({
          title: "Receipt approved",
          message: isPersonal
            ? `Expense ${formatPettyCashExpense(receipt.amount)} released to ${allocation.employeeName}'s ledger.`
            : `Receipt approved.`,
          type: "success",
        })
      } else {
        toast({ title: "Receipt rejected", message: "Expense was not applied to the ledger.", type: "success" })
      }
      
      onUpdate()
    } catch (error) {
      console.error('Error reviewing receipt:', error)
      toast({
        title: "Error",
        message: "Failed to review receipt",
        type: "error"
      })
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'settled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  const canManagePettyCash = isErpAdmin(userRole)
  const isOwnAllocation = allocationBelongsToUser(allocation, currentUserId, currentUser)
  const canSettle = canManagePettyCash && allocation.status === "active" && receipts.some(r => r.status === "approved")
  const canReopen = canManagePettyCash && allocation.status === "settled"
  const isImage = (value?: string) => !!value && (value.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(value))
  const isPdf = (value?: string) => !!value && (value.startsWith("data:application/pdf") || /\.pdf$/i.test(value))

  async function handleSettleStatus(nextStatus: "settled" | "active") {
    try {
      await updatePettyCashAllocationStatus(
        allocation.id,
        nextStatus,
        nextStatus === "settled" ? new Date().toISOString() : undefined
      )
      toast({
        title: nextStatus === "settled" ? "Allocation settled" : "Allocation reopened",
        message:
          nextStatus === "settled"
            ? "This allocation is now closed by admin."
            : "This allocation is active again.",
        type: "success",
      })
      onUpdate()
    } catch (error) {
      console.error("Error updating allocation status:", error)
      toast({
        title: "Error",
        message: "Failed to update allocation status",
        type: "error",
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border bg-[hsl(var(--card))] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-blue-600" />
            <div>
              <p className="text-lg font-bold">Petty Cash Allocation Details</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {allocation.employeeName} • {allocation.employeeRole}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canSettle && (
              <Button
                size="sm"
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                onClick={() => handleSettleStatus("settled")}
              >
                Settle
              </Button>
            )}
            {canReopen && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => handleSettleStatus("active")}
              >
                Reopen
              </Button>
            )}
            {canManagePettyCash && isPersonal && allocation.status === "active" && (
              <Button
                size="sm"
                className="h-8 text-xs bg-green-600 hover:bg-green-700"
                onClick={() => setShowTopUp(true)}
              >
                <DollarSign className="h-3.5 w-3.5 mr-1" />
                Add Cash
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            {canManagePettyCash && isPersonal && pendingTotal > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                <p className="font-semibold">Pending receipt approval</p>
                <p className="text-xs mt-1">
                  {formatPettyCashExpense(pendingTotal)} waiting — approve below to release the expense to{" "}
                  {allocation.employeeName}&apos;s ledger.
                </p>
              </div>
            )}

            {/* Allocation Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {isPersonal ? "Cash allocated" : "Total Amount"}
                  </p>
                </div>
                <p className="text-xl font-bold text-blue-600">PKR {allocation.amount.toLocaleString()}</p>
              </div>

              <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="h-4 w-4 text-red-600" />
                  <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {isPersonal ? "Approved expenses" : "Total Spent"}
                  </p>
                </div>
                <p className="text-xl font-bold text-red-600">
                  {totalSpent > 0 ? formatPettyCashExpense(totalSpent) : "PKR 0"}
                </p>
              </div>

              <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-orange-600" />
                  <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {isPersonal ? (pendingTotal > 0 ? "Pending" : "Balance") : "Remaining"}
                  </p>
                </div>
                {isPersonal && pendingTotal > 0 ? (
                  <p className="text-xl font-bold text-amber-600">{formatPettyCashExpense(pendingTotal)}</p>
                ) : (
                  <p className={`text-xl font-bold ${remainingAmount < 0 ? "text-red-600" : "text-orange-600"}`}>
                    {isPersonal
                      ? formatPettyCashBalance(remainingAmount)
                      : `PKR ${remainingAmount.toLocaleString()}`}
                  </p>
                )}
              </div>

              <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Status</p>
                </div>
                <Badge className={getStatusColor(allocation.status)}>
                  {allocation.status}
                </Badge>
              </div>
            </div>

            {isPersonal ? (
              <div className="rounded-lg border bg-[hsl(var(--card))] p-4 text-sm">
                <p className="font-medium">Personal expense ledger</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Employee submits receipts → admin approves → approved amount is released as{" "}
                  {formatPettyCashBalance(remainingAmount)} (negative = owed to employee).
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Settlement Progress</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{progressPercentage.toFixed(1)}%</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  {formatPettyCashExpense(totalSpent)} of PKR {allocation.amount.toLocaleString()} released
                </p>
              </div>
            )}

            {/* Allocation Info */}
            <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Allocation Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[hsl(var(--muted-foreground))]">Employee</p>
                  <p className="font-medium">{allocation.employeeName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{allocation.employeeRole}</p>
                </div>
                <div>
                  <p className="text-[hsl(var(--muted-foreground))]">Purpose</p>
                  <p className="font-medium">{allocation.purpose}</p>
                </div>
                <div>
                  <p className="text-[hsl(var(--muted-foreground))]">Allocated By</p>
                  <p className="font-medium">{allocation.allocatedBy}</p>
                </div>
                <div>
                  <p className="text-[hsl(var(--muted-foreground))]">Allocated Date</p>
                  <p className="font-medium">{new Date(allocation.allocatedAt).toLocaleDateString()}</p>
                </div>
                {allocation.notes && (
                  <div className="md:col-span-2">
                    <p className="text-[hsl(var(--muted-foreground))]">Notes</p>
                    <p className="font-medium">{allocation.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {allocation.payoutMethod === "cash" ? (
              <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Payout method
                </h3>
                <p className="text-sm font-medium">Cash</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Cash was released without a bank transfer proof.
                </p>
              </div>
            ) : allocation.paymentProof ? (
              <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Payment proof
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                  {allocation.status === "active" || allocation.status === "settled"
                    ? "Cash was released with this proof."
                    : "Payment proof attached by approver."}
                </p>
                {isImage(allocation.paymentProof) ? (
                  <img src={allocation.paymentProof} alt={allocation.paymentProofName || "Payment proof"} className="max-h-64 rounded-md border object-contain" />
                ) : (
                  <a href={allocation.paymentProof} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#1faca6] hover:underline">
                    {allocation.paymentProofName || "View payment proof"}
                  </a>
                )}
              </div>
            ) : null}

            <PettyCashActivityTimeline allocation={allocation} receipts={receipts} />

            {/* Actions */}
            {(isOwnAllocation || canManagePettyCash) && allocation.status === 'active' && (isPersonal || remainingAmount > 0) && (
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Receipts</h3>
                <Button
                  onClick={() => setShowReceiptForm(!showReceiptForm)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Receipt
                </Button>
              </div>
            )}

            {/* Settlement Form */}
            {showReceiptForm && (
              <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
                <h3 className="text-sm font-semibold mb-4">Add expense receipt</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
                  {isPersonal
                    ? "Receipt is sent to admin for approval before it affects your balance."
                    : "Amount is recorded as a negative expense and reduces your remaining petty cash balance."}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description *</label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40"
                      placeholder="e.g. Office supplies, transport, lunch"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (PKR) *</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40"
                      placeholder="0.00"
                      max={remainingAmount}
                    />
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Remaining: PKR {remainingAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Proof Attachment *</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={e => {
                        const file = e.target.files?.[0] || null
                        setReceiptFile(file)
                        setReceiptPreviewUrl(file && file.type.startsWith("image/") ? URL.createObjectURL(file) : "")
                      }}
                      className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {receiptPreviewUrl && (
                      <img
                        src={receiptPreviewUrl}
                        alt="Settlement proof preview"
                        className="max-h-28 rounded border object-contain"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full h-20 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 resize-none"
                      placeholder="Additional notes (optional)"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    onClick={submitReceipt}
                    disabled={loading || uploading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {uploading ? "Uploading..." : "Add Receipt"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowReceiptForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Settlement History */}
            <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Receipt history ({receipts.length})
              </h3>
              {loading && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">Loading settlement history...</p>
              )}
              {receipts.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-[hsl(var(--muted-foreground))] mx-auto mb-3" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No receipts yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receipts.map(receipt => (
                    <div key={receipt.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{receipt.description}</p>
                            <Badge className={getStatusColor(receipt.status)} variant="secondary">
                              {receipt.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-red-600 mb-1">
                            {formatPettyCashExpense(receipt.amount)}
                          </p>
                          {receipt.notes && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">{receipt.notes}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                            <span>Submitted: {new Date(receipt.submittedAt).toLocaleDateString()}</span>
                            {receipt.reviewedAt && (
                              <span>Reviewed: {new Date(receipt.reviewedAt).toLocaleDateString()}</span>
                            )}
                            {receipt.reviewedBy && (
                              <span>By: {receipt.reviewedBy}</span>
                            )}
                          </div>
                          {receipt.receiptProof && (
                            <div className="mt-2">
                              {isImage(receipt.receiptProof) ? (
                                <a href={receipt.receiptProof} target="_blank" rel="noopener noreferrer" className="inline-block">
                                  <img
                                    src={receipt.receiptProof}
                                    alt="Settlement proof"
                                    className="max-h-28 rounded border object-contain"
                                  />
                                </a>
                              ) : isPdf(receipt.receiptProof) ? (
                                <a
                                  href={receipt.receiptProof}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <FileText className="h-3 w-3" />
                                  Open PDF Proof
                                </a>
                              ) : (
                                <a
                                  href={receipt.receiptProof}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <FileText className="h-3 w-3" />
                                  View Proof
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-4 shrink-0">
                          {canManagePettyCash && receipt.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleReviewReceipt(receipt, 'approved')}
                                className="bg-green-600 hover:bg-green-700 h-7 px-2 cursor-pointer"
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReviewReceipt(receipt, 'rejected')}
                                className="h-7 px-2 cursor-pointer"
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {canManagePettyCash && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteReceiptConfirm(receipt)}
                              className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
                              title="Delete settlement"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteReceiptConfirm !== null}
        title="Delete settlement?"
        message={
          deleteReceiptConfirm
            ? `Remove "${deleteReceiptConfirm.description}" (PKR ${deleteReceiptConfirm.amount.toLocaleString()})?${
                deleteReceiptConfirm.status === "approved"
                  ? " The amount will be restored to the allocation balance."
                  : ""
              }`
            : ""
        }
        confirmText={deletingReceipt ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deleteReceiptConfirm && handleDeleteReceipt(deleteReceiptConfirm)}
        onCancel={() => !deletingReceipt && setDeleteReceiptConfirm(null)}
      />

      {showTopUp && (
        <PettyCashTopUp
          allocation={allocation}
          allocatedBy={currentUser || "Admin"}
          onClose={() => setShowTopUp(false)}
          onSave={() => {
            setShowTopUp(false)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}
