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
import { History, Eye } from "lucide-react"

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
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <History className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No settled or closed petty cash records yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Review completed petty cash requests, approvals, settlements, and closure notes.
      </p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-[hsl(var(--muted))]/40">
              <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Employee</th>
              <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Purpose</th>
              <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Amount</th>
              <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Closed</th>
              <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
              <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-28">History</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {historyAllocations.map((allocation) => {
              const spent = getApprovedSpent(allocation.id)
              const settlementCount = getSettlementCount(allocation.id)
              const closedAt = allocation.settledAt || allocation.reviewedAt || allocation.allocatedAt
              return (
                <tr key={allocation.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs">
                    <p className="font-medium">{allocation.employeeName}</p>
                    <p className="text-[hsl(var(--muted-foreground))]">{allocation.employeeRole}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{allocation.purpose}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <p className="font-semibold">PKR {allocation.amount.toLocaleString()}</p>
                    {allocation.status === "settled" && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Spent PKR {spent.toLocaleString()}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {new Date(closedAt).toLocaleString()}
                    {settlementCount > 0 && (
                      <p className="text-[10px]">{settlementCount} settlement{settlementCount === 1 ? "" : "s"}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {allocation.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => onViewHistory(allocation)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
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
}: {
  allocation: PettyCashAllocation
  receipts: PettyCashReceipt[]
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
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
