"use client"

import { useMemo } from "react"
import type { PettyCashAllocation, PettyCashReceipt } from "@/lib/petty-cash"
import { buildPettyCashHistory, isPettyCashHistoryAllocation } from "@/lib/petty-cash-history"
import {
  formatPettyCashCredit,
  formatPettyCashExpense,
  isPettyCashExpenseEvent,
} from "@/lib/petty-cash-display"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, Eye, CheckCircle, XCircle, Archive } from "lucide-react"

type Props = {
  allocations: PettyCashAllocation[]
  receipts: PettyCashReceipt[]
  onViewHistory: (allocation: PettyCashAllocation) => void
}

export function PettyCashHistoryPanel({ allocations, receipts, onViewHistory }: Props) {
  const historyAllocations = useMemo(
    () =>
      allocations
        .filter(isPettyCashHistoryAllocation)
        .sort((a, b) => {
          const aDate = a.settledAt || a.reviewedAt || a.allocatedAt
          const bDate = b.settledAt || b.reviewedAt || b.allocatedAt
          return new Date(bDate).getTime() - new Date(aDate).getTime()
        }),
    [allocations]
  )

  function getSettlementCount(allocationId: string) {
    return receipts.filter((receipt) => receipt.allocationId === allocationId).length
  }

  function getApprovedSpent(allocationId: string) {
    return receipts
      .filter((receipt) => receipt.allocationId === allocationId && receipt.status === "approved")
      .reduce((sum, receipt) => sum + receipt.amount, 0)
  }

  if (historyAllocations.length === 0) {
    return (
      <div className="rounded-[18px] border border-black/[0.06] bg-white py-16 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <p className="text-[14px] font-medium text-[#1d1d1f]">No archived records yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="bg-[#fafafa] border-b border-black/[0.05]">
              {["Ref", "Employee", "Purpose", "Amount", "Closed", "Status", "History"].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#86868b] ${
                    h === "History" ? "text-center" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.045]">
            {historyAllocations.map((allocation) => {
              const spent = getApprovedSpent(allocation.id)
              const settlementCount = getSettlementCount(allocation.id)
              const closedAt = allocation.settledAt || allocation.reviewedAt || allocation.allocatedAt
              return (
                <tr key={allocation.id} className="hover:bg-[#f5f8ff] transition-colors">
                  <td className="px-4 py-3.5 text-[12px] font-semibold text-[#007aff] tabular-nums whitespace-nowrap">
                    {allocation.referenceNumber || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-[12px]">
                    <p className="font-semibold text-[#1d1d1f]">{allocation.employeeName}</p>
                    <p className="text-[10px] text-[#86868b] mt-0.5">{allocation.employeeRole}</p>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-[#1d1d1f]">{allocation.purpose}</td>
                  <td className="px-4 py-3.5 text-[12px]">
                    <p className="font-semibold tabular-nums text-[#1d1d1f]">PKR {allocation.amount.toLocaleString()}</p>
                    {allocation.status === "settled" && (
                      <p className="text-[10px] text-[#aeaeb2] mt-0.5">Spent PKR {spent.toLocaleString()}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-[#86868b]">
                    {new Date(closedAt).toLocaleDateString()}
                    {settlementCount > 0 && (
                      <p className="text-[10px] text-[#aeaeb2] mt-0.5">
                        {settlementCount} settlement{settlementCount === 1 ? "" : "s"}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[12px]">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f2f2f7] text-[#6e6e73] capitalize">
                      {allocation.status === "settled" ? "archived" : allocation.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-center">
                    <button
                      type="button"
                      className="h-7 inline-flex items-center gap-1 px-2.5 rounded-full border border-black/[0.08] bg-white text-[11px] font-semibold text-[#007aff] hover:bg-black/[0.03] cursor-pointer"
                      onClick={() => onViewHistory(allocation)}
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PettyCashActivityTimeline({
  allocation,
  receipts,
  canReviewReceipts = false,
  reviewingReceiptId = null,
  onApproveReceipt,
  onRejectReceipt,
}: {
  allocation: PettyCashAllocation
  receipts: PettyCashReceipt[]
  canReviewReceipts?: boolean
  reviewingReceiptId?: string | null
  onApproveReceipt?: (receiptId: string) => void
  onRejectReceipt?: (receiptId: string) => void
}) {
  const events = useMemo(() => buildPettyCashHistory(allocation, receipts), [allocation, receipts])

  return (
    <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <History className="h-4 w-4" />
        Activity History
      </h3>
      <div className="space-y-3">
        {events.map((event, index) => (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-2.5 w-2.5 rounded-full bg-[#1faca6] mt-1.5" />
              {index < events.length - 1 && <div className="w-px flex-1 bg-[hsl(var(--border))] mt-1" />}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{event.title}</p>
                {event.status && (
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {event.status}
                  </Badge>
                )}
              </div>
              {event.description && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{event.description}</p>
              )}
              <div className="flex flex-wrap gap-3 text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                <span>{new Date(event.occurredAt).toLocaleString()}</span>
                {event.actor && <span>By {event.actor}</span>}
                {event.amount !== undefined && (
                  <span
                    className={
                      event.amount < 0 || isPettyCashExpenseEvent(event.type)
                        ? "text-red-600 font-medium"
                        : "text-green-600 font-medium"
                    }
                  >
                    {event.amount < 0 || isPettyCashExpenseEvent(event.type)
                      ? formatPettyCashExpense(event.amount)
                      : formatPettyCashCredit(event.amount)}
                  </span>
                )}
              </div>
              {event.proofUrl && (
                <a
                  href={event.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-[11px] font-medium text-[#1faca6] hover:underline mt-1"
                >
                  {event.proofName || "View proof"}
                </a>
              )}
              {canReviewReceipts &&
                event.receiptId &&
                event.status === "pending" &&
                onApproveReceipt &&
                onRejectReceipt && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700"
                      disabled={reviewingReceiptId === event.receiptId}
                      onClick={() => onApproveReceipt(event.receiptId!)}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Approve receipt
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      disabled={reviewingReceiptId === event.receiptId}
                      onClick={() => onRejectReceipt(event.receiptId!)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
