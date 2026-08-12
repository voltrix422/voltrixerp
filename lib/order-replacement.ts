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
