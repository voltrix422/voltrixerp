"use client"

import { useCallback, useEffect, useState } from "react"
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
import { Check, Loader2, X } from "lucide-react"

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
      <div className="flex items-center justify-center py-12 gap-2 text-[13px] text-[#86868b]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (pendingRequests.length === 0 && pendingReceipts.length === 0) {
    return (
      <p className="text-[13px] text-[#86868b] py-10 text-center">
        Nothing pending.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {pendingRequests.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <p className="text-[13px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              Requests
            </p>
            <p className="text-[11px] font-medium text-[#86868b] tabular-nums">{pendingRequests.length}</p>
          </div>
          <div className="space-y-2">
            {pendingRequests.map((allocation) => (
              <div
                key={allocation.id}
                className="rounded-[14px] bg-white dark:bg-[hsl(var(--background))] border border-black/[0.04] dark:border-[hsl(var(--border))] px-3.5 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
                      {allocation.employeeName}
                    </p>
                    <p className="text-[12px] text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                      {allocation.purpose}
                    </p>
                    <p className="text-[15px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] mt-1.5 tabular-nums">
                      PKR {allocation.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setApprovalAllocation(allocation)}
                      className="inline-flex h-8 items-center rounded-full bg-[#34c759] px-3.5 text-[12px] font-semibold text-white hover:bg-[#2db84e] transition-colors cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await rejectPettyCashAllocation(allocation.id, currentUser, "Rejected by approver")
                          await refresh()
                          toast({ type: "success", title: "Request rejected" })
                        } catch {
                          toast({ type: "error", title: "Failed to reject request" })
                        }
                      }}
                      className="inline-flex h-8 items-center rounded-full bg-black/[0.06] dark:bg-white/10 px-3.5 text-[12px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.1] transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingReceipts.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <p className="text-[13px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              Expense receipts
            </p>
            <p className="text-[11px] font-medium text-[#86868b] tabular-nums">{pendingReceipts.length}</p>
          </div>
          <div className="rounded-[14px] bg-white dark:bg-[hsl(var(--background))] border border-black/[0.04] dark:border-[hsl(var(--border))] overflow-hidden">
            <div className="divide-y divide-black/[0.06] dark:divide-[hsl(var(--border))]">
              {pendingReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex items-start gap-3 px-3.5 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                        {receipt.employeeName}
                      </p>
                      <span className="text-[11px] text-[#86868b]">{receipt.category || "—"}</span>
                    </div>
                    <p className="text-[12px] text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                      {receipt.description}
                    </p>
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))] mt-1 tabular-nums">
                      PKR {receipt.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <button
                      type="button"
                      disabled={busyReceiptId === receipt.id}
                      onClick={() => handleReviewReceipt(receipt, "approved")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#34c759]/15 text-[#248a3d] hover:bg-[#34c759]/25 disabled:opacity-50 cursor-pointer"
                      title="Approve"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      disabled={busyReceiptId === receipt.id}
                      onClick={() => handleReviewReceipt(receipt, "rejected")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ff3b30]/12 text-[#d70015] hover:bg-[#ff3b30]/20 disabled:opacity-50 cursor-pointer"
                      title="Reject"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
