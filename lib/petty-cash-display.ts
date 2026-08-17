import type { PettyCashAllocation, PettyCashReceipt } from "@/lib/petty-cash"
import { getLedgerBalance, isPersonalLedgerAllocation } from "@/lib/petty-cash-personal"

function norm(value: string) {
  return value.trim().toLowerCase()
}

/** Match by staff id or display name (case-insensitive). */
export function allocationBelongsToUser(
  allocation: PettyCashAllocation,
  userId?: string,
  userName?: string,
) {
  if (!userId && !userName) return true
  if (userId && allocation.employeeId === userId) return true
  if (userName && norm(allocation.employeeName) === norm(userName)) return true
  return false
}

export function getAllocationRemaining(
  allocation: PettyCashAllocation,
  receipts: PettyCashReceipt[],
) {
  if (isPersonalLedgerAllocation(allocation)) {
    return getLedgerBalance(allocation, receipts)
  }
  return allocation.amount - sumCommittedReceipts(receipts, allocation.id)
}

export function canAddReceiptToAllocation(
  allocation: PettyCashAllocation,
  receipts: PettyCashReceipt[],
) {
  if (allocation.status === "cancelled" || allocation.status === "rejected") {
    return false
  }
  if (isPersonalLedgerAllocation(allocation)) {
    return allocation.status === "active" || allocation.status === "settled"
  }
  // Standard allocation: allow while active, even when balance is zero or negative
  return allocation.status === "active"
}

export function formatPettyCashBalance(amount: number) {
  if (amount < -0.004) return formatPettyCashExpense(amount)
  if (amount > 0.004) return formatPettyCashCredit(amount)
  return "PKR 0"
}

/** Approved receipts reduce the allocation balance. */
export function sumApprovedReceipts(receipts: PettyCashReceipt[], allocationId?: string) {
  return receipts
    .filter(
      (r) =>
        (!allocationId || r.allocationId === allocationId) && r.status === "approved",
    )
    .reduce((sum, r) => sum + r.amount, 0)
}

/** Approved petty cash spent in a date range (uses reviewedAt, then submittedAt). */
export function sumApprovedReceiptsInPeriod(
  receipts: Array<{
    status: string
    amount: number
    allocationId?: string
    reviewedAt?: Date | string | null
    submittedAt: Date | string
  }>,
  start: Date,
  end: Date,
  allocationId?: string,
) {
  return receipts
    .filter((r) => {
      if (r.status !== "approved") return false
      if (allocationId && r.allocationId !== allocationId) return false
      const raw = r.reviewedAt ?? r.submittedAt
      if (!raw) return false
      const date = new Date(raw)
      return date >= start && date <= end
    })
    .reduce((sum, r) => sum + r.amount, 0)
}

export function sumPendingReceipts(receipts: PettyCashReceipt[], allocationId?: string) {
  return receipts
    .filter(
      (r) =>
        (!allocationId || r.allocationId === allocationId) && r.status === "pending",
    )
    .reduce((sum, r) => sum + r.amount, 0)
}

/** Pending + approved — used to cap new receipt amounts. */
export function sumCommittedReceipts(receipts: PettyCashReceipt[], allocationId?: string) {
  return receipts
    .filter(
      (r) =>
        (!allocationId || r.allocationId === allocationId) &&
        (r.status === "approved" || r.status === "pending"),
    )
    .reduce((sum, r) => sum + r.amount, 0)
}

export function formatPettyCashCredit(amount: number) {
  return `+PKR ${amount.toLocaleString()}`
}

export function formatPettyCashExpense(amount: number) {
  return `-PKR ${Math.abs(amount).toLocaleString()}`
}

export function isPettyCashExpenseEvent(type: string) {
  return type === "settlement" || type === "settlement_review"
}

export type AllocationReceiptSummary = {
  allocationId: string
  isPersonalLedger: boolean
  allocated: number
  approvedSpent: number
  pendingSpent: number
  submittedTotal: number
  receiptCount: number
  pendingCount: number
  approvedCount: number
  /** Cash left after approved expenses only (allocated − approved). */
  balanceAfterApproved: number
  /** Cash left if all pending receipts are also approved (allocated − approved − pending). */
  balanceAfterPending: number
  /** Amount over allocation from approved expenses only (0 if not over). */
  approvedOverage: number
  /** Amount over allocation if pending receipts are approved too. */
  projectedOverage: number
}

export function summarizeAllocationReceipts(
  allocation: PettyCashAllocation,
  receipts: PettyCashReceipt[],
): AllocationReceiptSummary {
  const allocationReceipts = receipts.filter((r) => r.allocationId === allocation.id)
  const approvedReceipts = allocationReceipts.filter((r) => r.status === "approved")
  const pendingReceipts = allocationReceipts.filter((r) => r.status === "pending")

  const approvedSpent = approvedReceipts.reduce((sum, r) => sum + r.amount, 0)
  const pendingSpent = pendingReceipts.reduce((sum, r) => sum + r.amount, 0)
  const submittedTotal = approvedSpent + pendingSpent
  const balanceAfterApproved = allocation.amount - approvedSpent
  const balanceAfterPending = allocation.amount - submittedTotal

  return {
    allocationId: allocation.id,
    isPersonalLedger: isPersonalLedgerAllocation(allocation),
    allocated: allocation.amount,
    approvedSpent,
    pendingSpent,
    submittedTotal,
    receiptCount: allocationReceipts.length,
    pendingCount: pendingReceipts.length,
    approvedCount: approvedReceipts.length,
    balanceAfterApproved,
    balanceAfterPending,
    approvedOverage: Math.max(0, approvedSpent - allocation.amount),
    projectedOverage: Math.max(0, submittedTotal - allocation.amount),
  }
}

export function formatAllocationBalanceCell(amount: number) {
  if (amount < -0.004) {
    return { text: formatPettyCashExpense(amount), className: "text-red-600" }
  }
  if (amount > 0.004) {
    return { text: `PKR ${amount.toLocaleString()}`, className: "text-green-600" }
  }
  return { text: "PKR 0", className: "text-[hsl(var(--muted-foreground))]" }
}

/** Owed to employee once all receipts are approved (null if still pending or not owed). */
export function getAmountOwedToEmployee(summary: AllocationReceiptSummary): number | null {
  if (summary.pendingCount > 0) return null
  if (summary.balanceAfterApproved >= -0.004) return null
  return Math.round(Math.abs(summary.balanceAfterApproved) * 100) / 100
}

/** Projected owed if all pending receipts are approved. */
export function getProjectedAmountOwed(summary: AllocationReceiptSummary): number | null {
  if (summary.balanceAfterPending >= -0.004) return null
  return Math.round(Math.abs(summary.balanceAfterPending) * 100) / 100
}
