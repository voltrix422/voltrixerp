import type { PettyCashAllocation, PettyCashReceipt } from "@/lib/petty-cash"
import { sumApprovedReceipts } from "@/lib/petty-cash-display"

export const PERSONAL_LEDGER_MARKER = "__personal_ledger__"
export const PERSONAL_LEDGER_PURPOSE = "Personal expense ledger"

export function isPersonalLedgerAllocation(allocation: PettyCashAllocation) {
  return (
    allocation.notes?.includes(PERSONAL_LEDGER_MARKER) ||
    allocation.purpose === PERSONAL_LEDGER_PURPOSE
  )
}

/** Allocated minus spent; negative means employee is owed / out of pocket. */
export function getLedgerBalance(
  allocation: PettyCashAllocation,
  receipts: PettyCashReceipt[],
) {
  const spent = sumApprovedReceipts(receipts, allocation.id)
  return allocation.amount - spent
}

export function findPersonalLedger(
  allocations: PettyCashAllocation[],
  employeeId?: string,
  employeeName?: string,
) {
  return allocations.find(
    (a) =>
      isPersonalLedgerAllocation(a) &&
      (employeeId ? a.employeeId === employeeId : true) &&
      (employeeName
        ? a.employeeName.trim().toLowerCase() === employeeName.trim().toLowerCase()
        : true),
  )
}
