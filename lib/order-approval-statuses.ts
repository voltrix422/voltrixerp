export const PENDING_APPROVAL_STATUS = "pending_approval" as const

export const APPROVED_ORDER_STATUSES = [
  "approved",
  "finalized",
  "payment_added",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
] as const

export type ApprovedOrderStatus = (typeof APPROVED_ORDER_STATUSES)[number]

export function isApprovedPipelineStatus(status: string) {
  return (APPROVED_ORDER_STATUSES as readonly string[]).includes(status)
}
