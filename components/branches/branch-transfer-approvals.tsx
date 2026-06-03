"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  fetchBranchTransferRequests,
  getBranchTransferHistory,
  reviewBranchTransferRequest,
  type Branch,
  type BranchTransferRequest,
} from "@/lib/branches"
import { downloadBranchTransferHistoryPDF } from "@/lib/generate-branch-transfer-history-pdf"
import { groupTransferHistoryForDisplay } from "@/lib/branch-transfer-history-display"
import { Check, Loader2, Shield, X } from "lucide-react"
import { useToast } from "@/components/ui/toast"

export function BranchTransferApprovals({
  branches,
  currentUser,
  branchId,
  variant = "panel",
  onReviewed,
}: {
  branches: Branch[]
  currentUser: string
  branchId?: string
  variant?: "panel" | "embedded"
  onReviewed?: () => void
}) {
  const { toast } = useToast()
  const [requests, setRequests] = useState<BranchTransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setRequests(
        await fetchBranchTransferRequests({
          status: "pending",
          branchId,
        }),
      )
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleApprove(req: BranchTransferRequest) {
    setBusyId(req.id)
    try {
      const { result } = await reviewBranchTransferRequest({
        id: req.id,
        action: "approve",
        reviewedBy: currentUser,
      })
      await refresh()
      onReviewed?.()

      const destBranch = branches.find((b) => b.id === req.toBranchId)
      if (destBranch && result?.transferBatchId) {
        try {
          const history = await getBranchTransferHistory(destBranch.id)
          const grouped = groupTransferHistoryForDisplay(history)
          const entry = grouped.find((g) => g.transferBatchId === result.transferBatchId) ?? grouped[0]
          if (entry) {
            await downloadBranchTransferHistoryPDF(destBranch, grouped, { singleEntry: entry })
          }
        } catch {
          /* PDF optional */
        }
      }

      if (result && result.failed > 0) {
        toast({
          type: "error",
          title: "Partially approved",
          message: `${result.succeeded} line(s) transferred, ${result.failed} failed.`,
        })
      } else {
        toast({
          type: "success",
          title: "Transfer approved",
          message: "Stock moved and transfer note recorded. PDF downloaded if available.",
        })
      }
    } catch (err) {
      toast({
        type: "error",
        title: "Approval failed",
        message: err instanceof Error ? err.message : "Could not approve transfer.",
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(req: BranchTransferRequest) {
    setBusyId(req.id)
    try {
      await reviewBranchTransferRequest({
        id: req.id,
        action: "reject",
        reviewedBy: currentUser,
      })
      await refresh()
      onReviewed?.()
      toast({ type: "success", title: "Request rejected" })
    } catch (err) {
      toast({
        type: "error",
        title: "Reject failed",
        message: err instanceof Error ? err.message : "Could not reject request.",
      })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    if (variant === "embedded") {
      return (
        <div className="flex items-center justify-center py-12 gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading branch transfer approvals…
        </div>
      )
    }
    return (
      <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Loading transfer approvals…
      </div>
    )
  }

  if (requests.length === 0) {
    if (variant === "embedded") {
      return (
        <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
          No branch transfers pending approval.
        </p>
      )
    }
    return null
  }

  const list = (
    <ul className={`divide-y ${variant === "panel" ? "divide-amber-200/50 max-h-[320px] overflow-y-auto" : "divide-[hsl(var(--border))]"}`}>
      {requests.map((req) => (
        <li key={req.id} className={`${variant === "panel" ? "px-4 py-3" : "px-0 py-3"} space-y-2`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold capitalize">
                {req.mode === "dispatch" ? "Dispatch" : "Transfer"} · {req.lineCount} line
                {req.lineCount === 1 ? "" : "s"}
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                {req.fromBranchName} ({req.fromBranchCode}) → {req.toBranchName} ({req.toBranchCode})
              </p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                By {req.requestedBy} · {new Date(req.requestedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[10px] text-red-600 border-red-200 hover:bg-red-50"
                disabled={busyId === req.id}
                onClick={() => handleReject(req)}
              >
                {busyId === req.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <X className="h-3 w-3 mr-0.5" />
                    Reject
                  </>
                )}
              </Button>
              <Button
                size="sm"
                className="h-8 text-[10px] bg-[#1faca6] hover:bg-[#17857f] text-white"
                disabled={busyId === req.id}
                onClick={() => handleApprove(req)}
              >
                {busyId === req.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-0.5" />
                    Approve
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-[hsl(var(--foreground))]/80">{req.summary}</p>
        </li>
      ))}
    </ul>
  )

  if (variant === "embedded") return list

  return (
    <div className="rounded-lg border border-amber-300/70 bg-amber-50/80 dark:bg-amber-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200/60">
        <Shield className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">
            Pending transfer approvals
          </p>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
            Approve to move stock and generate the transfer / dispatch note (PDF).
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold rounded-full bg-amber-200 dark:bg-amber-800 px-2.5 py-0.5 tabular-nums">
          {requests.length}
        </span>
      </div>
      {list}
    </div>
  )
}
