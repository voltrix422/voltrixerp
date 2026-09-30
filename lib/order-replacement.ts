import type { OrderReplacementDisposition } from "@/lib/orders"

export async function replaceOrderItem(input: {
  orderId: string
  orderItemId: string
  oldSerialNumber?: string
  newSerialNumber?: string
  disposition: OrderReplacementDisposition
  reason: string
  photoUrls?: string[]
  replacedBy?: string
}) {
  const res = await fetch("/api/db/orders/replace-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Could not replace order item")
  return data.order
}

export type PendingReplacementApprovalRow = {
  orderId: string
  orderNumber: string
  clientName: string
  replacement: import("@/lib/orders").OrderReplacementLine
}

export async function getPendingReplacementApprovals(): Promise<PendingReplacementApprovalRow[]> {
  const res = await fetch("/api/db/orders/replace-approvals", { cache: "no-store" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Could not load approvals")
  return Array.isArray(data.pending) ? data.pending : []
}

export async function reviewReplacementReturn(input: {
  orderId: string
  replacementId: string
  decision: "approved" | "rejected"
  reviewedBy?: string
  note?: string
}) {
  const res = await fetch("/api/db/orders/replace-item/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Could not review return")
  return data.order
}
