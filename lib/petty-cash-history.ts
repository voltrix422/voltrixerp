import type { PettyCashAllocation, PettyCashReceipt } from "@/lib/petty-cash"

export type PettyCashHistoryEventType =
  | "request"
  | "approval"
  | "rejection"
  | "settlement"
  | "settlement_review"
  | "closed"

export interface PettyCashHistoryEvent {
  id: string
  type: PettyCashHistoryEventType
  title: string
  description?: string
  amount?: number
  occurredAt: string
  actor?: string
  proofUrl?: string
  proofName?: string
  status?: string
}

export function buildPettyCashHistory(
  allocation: PettyCashAllocation,
  receipts: PettyCashReceipt[]
): PettyCashHistoryEvent[] {
  const events: PettyCashHistoryEvent[] = [
    {
      id: `${allocation.id}-request`,
      type: "request",
      title: "Petty cash requested",
      description: allocation.purpose,
      amount: allocation.amount,
      occurredAt: allocation.allocatedAt,
      actor: allocation.employeeName,
    },
  ]

  if (allocation.reviewedAt) {
    if (allocation.status === "rejected") {
      events.push({
        id: `${allocation.id}-rejection`,
        type: "rejection",
        title: "Request rejected",
        description: allocation.reviewNotes || allocation.notes || undefined,
        occurredAt: allocation.reviewedAt,
        actor: allocation.reviewedBy,
        status: "rejected",
      })
    } else {
      events.push({
        id: `${allocation.id}-approval`,
        type: "approval",
        title: allocation.payoutMethod === "cash" ? "Cash approved and released" : "Cash approved and released",
        description:
          allocation.payoutMethod === "cash"
            ? [allocation.notes, "Paid in cash."].filter(Boolean).join(" ")
            : allocation.notes || undefined,
        amount: allocation.amount,
        occurredAt: allocation.reviewedAt,
        actor: allocation.reviewedBy,
        proofUrl: allocation.payoutMethod === "cash" ? undefined : allocation.paymentProof,
        proofName: allocation.payoutMethod === "cash" ? undefined : allocation.paymentProofName,
        status: "active",
      })
    }
  }

  receipts.forEach((receipt) => {
    events.push({
      id: `${receipt.id}-submitted`,
      type: "settlement",
      title: "Settlement submitted",
      description: receipt.description,
      amount: receipt.amount,
      occurredAt: receipt.submittedAt,
      actor: receipt.employeeName,
      proofUrl: receipt.receiptProof,
      proofName: receipt.receiptProofName,
      status: receipt.status,
    })

    if (receipt.reviewedAt) {
      events.push({
        id: `${receipt.id}-review`,
        type: "settlement_review",
        title: receipt.status === "approved" ? "Settlement approved" : "Settlement rejected",
        description: receipt.reviewNotes || receipt.notes || undefined,
        amount: receipt.amount,
        occurredAt: receipt.reviewedAt,
        actor: receipt.reviewedBy,
        status: receipt.status,
      })
    }
  })

  if (allocation.settledAt) {
    events.push({
      id: `${allocation.id}-closed`,
      type: "closed",
      title: "Petty cash settled and closed",
      description: "Allocation fully settled.",
      amount: allocation.amount,
      occurredAt: allocation.settledAt,
      status: "settled",
    })
  }

  return events.sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  )
}

export function isPettyCashHistoryAllocation(allocation: PettyCashAllocation) {
  return ["settled", "rejected", "cancelled"].includes(allocation.status)
}
