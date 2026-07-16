/** Shared helpers for sales-agent portal lists (mobile layout, date filter). */

export function inSalesDateRange(createdAt: string | undefined, from: string, to: string) {
  if (!from && !to) return true
  if (!createdAt) return false
  const d = new Date(createdAt)
  if (from) {
    const f = new Date(from)
    f.setHours(0, 0, 0, 0)
    if (d < f) return false
  }
  if (to) {
    const t = new Date(to)
    t.setHours(23, 59, 59, 999)
    if (d > t) return false
  }
  return true
}

export const QUOTATION_STATUS_SHORT: Record<string, string> = {
  all: "All",
  draft: "Draft",
  pending_approval: "Pending",
  sent: "Sent",
  accepted: "OK",
  rejected: "No",
  expired: "Exp",
  converted: "Conv",
}

export const ORDER_PORTAL_TABS = [
  { key: "all", short: "All" },
  { key: "pending_approval", short: "Pending" },
  { key: "approved", short: "OK" },
  { key: "rejected", short: "No" },
  { key: "payment_added", short: "Pay" },
  { key: "finalized", short: "Final" },
  { key: "delivered", short: "Done" },
  { key: "returned", short: "Return" },
] as const

export const ORDER_STATUS_SHORT: Record<string, string> = {
  all: "All",
  pending_approval: "Pending",
  approved: "OK",
  rejected: "No",
  payment_added: "Payment",
  finalized: "Final",
  delivered: "Done",
  returned: "Return",
  draft: "Draft",
  confirmed: "Conf",
  processing: "Proc",
  shipped: "Ship",
  cancelled: "X",
}
