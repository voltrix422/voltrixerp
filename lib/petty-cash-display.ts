import type { PettyCashReceipt } from "@/lib/petty-cash"

/** Approved receipts reduce the allocation balance. */
export function sumApprovedReceipts(receipts: PettyCashReceipt[], allocationId?: string) {
  return receipts
    .filter(
      (r) =>
        (!allocationId || r.allocationId === allocationId) && r.status === "approved",
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
