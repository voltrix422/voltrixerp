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
