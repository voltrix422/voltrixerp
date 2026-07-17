import type { PettyCashAllocation, PettyCashReceipt } from "@/lib/petty-cash"
import { isPersonalLedgerAllocation } from "@/lib/petty-cash-personal"
import { parsePettyCashTopUps } from "@/lib/petty-cash-topup"

export type PettyCashHistoryEventType =
  | "request"
  | "approval"
  | "rejection"
  | "topup"
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
  /** Receipt id when this event is a receipt submission awaiting review. */
  receiptId?: string
}

export function buildPettyCashHistory(
  allocation: PettyCashAllocation,
  receipts: PettyCashReceipt[]
): PettyCashHistoryEvent[] {
  const isPersonal = isPersonalLedgerAllocation(allocation)
  const events: PettyCashHistoryEvent[] = [
    isPersonal
      ? {
          id: `${allocation.id}-ledger-opened`,
          type: "request",
          title: "Personal expense ledger opened",
          description: "Employee can submit receipts for reimbursement. Admin approves receipts, then pays what is owed.",
          occurredAt: allocation.allocatedAt,
          actor: allocation.employeeName,
        }
      : {
          id: `${allocation.id}-request`,
          type: "request",
          title: "Petty cash requested",
          description: allocation.purpose,
          amount: allocation.amount,
          occurredAt: allocation.allocatedAt,
          actor: allocation.employeeName,
          status: allocation.status === "pending" ? "pending" : undefined,
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

  parsePettyCashTopUps(allocation.notes).forEach((topUp, index) => {
    events.push({
      id: `${allocation.id}-topup-${index}`,
      type: "topup",
      title: "Cash added to ledger",
      description: topUp.note || undefined,
      amount: topUp.amount,
      occurredAt: topUp.at,
      actor: topUp.by,
      proofUrl: topUp.proofUrl,
      proofName: topUp.proofName,
      status: "active",
    })
  })

  receipts.forEach((receipt) => {
    const expenseAmount = -Math.abs(receipt.amount)
    const submitTitle =
      receipt.status === "approved"
        ? "Receipt approved — expense released"
        : receipt.status === "rejected"
          ? "Receipt rejected"
          : "Receipt submitted — awaiting admin approval"

    events.push({
      id: `${receipt.id}-submitted`,
      type: "settlement",
      title: submitTitle,
      description: receipt.description,
      amount: receipt.status === "pending" ? expenseAmount : receipt.status === "approved" ? expenseAmount : undefined,
      occurredAt: receipt.submittedAt,
      actor: receipt.employeeName,
      proofUrl: receipt.receiptProof,
      proofName: receipt.receiptProofName,
      status: receipt.status,
      receiptId: receipt.status === "pending" ? receipt.id : undefined,
    })

    if (receipt.reviewedAt) {
      const reviewedLater =
        new Date(receipt.reviewedAt).getTime() - new Date(receipt.submittedAt).getTime() > 2000
      if (reviewedLater && receipt.status === "approved") {
        events.push({
          id: `${receipt.id}-review`,
          type: "settlement_review",
          title: "Admin approved — expense released to employee",
          description: receipt.reviewNotes || receipt.notes || undefined,
          amount: expenseAmount,
          occurredAt: receipt.reviewedAt,
          actor: receipt.reviewedBy,
          status: receipt.status,
        })
      } else if (reviewedLater && receipt.status === "rejected") {
        events.push({
          id: `${receipt.id}-review`,
          type: "settlement_review",
          title: "Receipt rejected",
          description: receipt.reviewNotes || receipt.notes || undefined,
          occurredAt: receipt.reviewedAt,
          actor: receipt.reviewedBy,
          status: receipt.status,
        })
      }
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
