"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  getPettyCashAllocations,
  getPettyCashReceipts,
  rejectPettyCashAllocation,
  updatePettyCashReceiptStatus,
  type PettyCashAllocation,
  type PettyCashReceipt,
} from "@/lib/petty-cash"
import { isPersonalLedgerAllocation } from "@/lib/petty-cash-personal"
import { PettyCashApprovalForm } from "@/components/finance/petty-cash-approval"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/ui/toast"
import { CheckCircle, Loader2, XCircle } from "lucide-react"

export function DashboardPettyCashApprovals() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [allocations, setAllocations] = useState<PettyCashAllocation[]>([])
  const [receipts, setReceipts] = useState<PettyCashReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [approvalAllocation, setApprovalAllocation] = useState<PettyCashAllocation | null>(null)
  const [busyReceiptId, setBusyReceiptId] = useState<string | null>(null)

  const currentUser = user?.name || "Super admin"
  const currentUserId = user?.id || ""

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [a, r] = await Promise.all([getPettyCashAllocations(), getPettyCashReceipts()])
      setAllocations(a)
      setReceipts(r)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  const pendingRequests = allocations.filter(
    (a) => a.status === "pending" && !isPersonalLedgerAllocation(a),
  )
  const pendingReceipts = receipts.filter((r) => r.status === "pending")

  async function handleReviewReceipt(receipt: PettyCashReceipt, status: "approved" | "rejected") {
    setBusyReceiptId(receipt.id)
    try {
      await updatePettyCashReceiptStatus(receipt.id, status, currentUser, currentUserId)
      await refresh()
      toast({
        type: "success",
        title: status === "approved" ? "Receipt approved" : "Receipt rejected",
      })
    } catch (error) {
      toast({
        type: "error",
        title: "Could not update receipt",
        message: error instanceof Error ? error.message : "Approval failed. Please try again.",
      })
    } finally {
      setBusyReceiptId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading petty cash approvals…
      </div>
    )
  }

  if (pendingRequests.length === 0 && pendingReceipts.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
        No petty cash items pending approval.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Cash requests ({pendingRequests.length})
          </p>
          <div className="space-y-2">
            {pendingRequests.map((allocation) => (
              <div
                key={allocation.id}
                className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{allocation.employeeName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{allocation.purpose}</p>
                  <p className="text-xs font-semibold mt-1">
                    PKR {allocation.amount.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => setApprovalAllocation(allocation)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={async () => {
                      try {
                        await rejectPettyCashAllocation(allocation.id, currentUser, "Rejected by approver")
                        await refresh()
                        toast({ type: "success", title: "Request rejected" })
                      } catch {
                        toast({ type: "error", title: "Failed to reject request" })
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

      {pendingReceipts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Expense receipts ({pendingReceipts.length})
          </p>
          <div className="rounded-lg border border-[hsl(var(--border))] overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b bg-[hsl(var(--muted))]/30">
                  <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                    Employee
                  </th>
                  <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                    Category
                  </th>
                  <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                    Description
                  </th>
                  <th className="h-9 px-3 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                    Amount
                  </th>
                  <th className="h-9 px-3 text-center text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]/60">
                {pendingReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-[hsl(var(--muted))]/20 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-medium">{receipt.employeeName}</td>
                    <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{receipt.category || "—"}</td>
                    <td className="px-3 py-2 text-xs">{receipt.description}</td>
                    <td className="px-3 py-2 text-xs font-semibold text-red-600">
                      PKR {receipt.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={busyReceiptId === receipt.id}
                          onClick={() => handleReviewReceipt(receipt, "approved")}
                          className="text-green-600 hover:text-green-800 cursor-pointer disabled:opacity-50"
                          title="Approve"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busyReceiptId === receipt.id}
                          onClick={() => handleReviewReceipt(receipt, "rejected")}
                          className="text-red-600 hover:text-red-800 cursor-pointer disabled:opacity-50"
                          title="Reject"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {approvalAllocation && (
        <PettyCashApprovalForm
          allocation={approvalAllocation}
          reviewedBy={currentUser}
          onClose={() => setApprovalAllocation(null)}
          onSave={async () => {
            setApprovalAllocation(null)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

export function usePettyCashPendingCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const [a, r] = await Promise.all([getPettyCashAllocations(), getPettyCashReceipts()])
        const pendingA = a.filter((x) => x.status === "pending" && !isPersonalLedgerAllocation(x)).length
        const pendingR = r.filter((x) => x.status === "pending").length
        setCount(pendingA + pendingR)
      } catch {
        setCount(0)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  return count
}
