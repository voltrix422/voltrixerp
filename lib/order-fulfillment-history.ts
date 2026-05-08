export interface OrderFulfillmentHistoryEntry {
  id: string
  orderId: string
  orderNumber: string
  clientName: string
  dispatcherName: string
  receiverName: string
  receiverCnic: string
  vehicleNumber: string
  receiverImageUrl?: string
  receiverCnicImageUrl?: string
  vehicleImageUrl?: string
  productImageUrls: string[]
  fulfilledAt: string
  fulfilledBy: string
  notes?: string
  createdAt: string
}

type Row = Record<string, unknown>

function mapRow(row: Row): OrderFulfillmentHistoryEntry {
  return {
    id: String(row.id || ""),
    orderId: String(row.orderId || ""),
    orderNumber: String(row.orderNumber || ""),
    clientName: String(row.clientName || ""),
    dispatcherName: String(row.dispatcherName || ""),
    receiverName: String(row.receiverName || ""),
    receiverCnic: String(row.receiverCnic || ""),
    vehicleNumber: String(row.vehicleNumber || ""),
    receiverImageUrl: row.receiverImageUrl ? String(row.receiverImageUrl) : undefined,
    receiverCnicImageUrl: row.receiverCnicImageUrl ? String(row.receiverCnicImageUrl) : undefined,
    vehicleImageUrl: row.vehicleImageUrl ? String(row.vehicleImageUrl) : undefined,
    productImageUrls: Array.isArray(row.productImageUrls) ? row.productImageUrls.map(String) : [],
    fulfilledAt: String(row.fulfilledAt || row.createdAt || new Date().toISOString()),
    fulfilledBy: String(row.fulfilledBy || "System"),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.createdAt || new Date().toISOString()),
  }
}

export async function getOrderFulfillmentHistory(): Promise<OrderFulfillmentHistoryEntry[]> {
  try {
    const res = await fetch("/api/db/order-fulfillment-history")
    if (!res.ok) return []
    const rows = await res.json()
    if (!Array.isArray(rows)) return []
    return rows.map(mapRow)
  } catch {
    return []
  }
}

export async function logOrderFulfillmentHistory(
  input: Omit<OrderFulfillmentHistoryEntry, "id" | "createdAt">
): Promise<void> {
  try {
    await fetch("/api/db/order-fulfillment-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch {
    return
  }
}
