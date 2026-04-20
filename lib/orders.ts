// DB access via /api/db routes (Prisma)

export type OrderStatus = "draft" | "pending_approval" | "approved" | "rejected" | "finalized" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"

export interface OrderItem {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  isCustom: boolean // true if custom item, false if from inventory
  inventoryItemId?: string // reference to inventory item if not custom
  availableQty?: number // available quantity in stock (for validation, not saved to DB)
  costPrice?: number // cost price from inventory (for reference, not saved to DB)
}

export interface Order {
  id: string
  orderNumber: string
  clientId: string
  clientName: string
  items: OrderItem[]
  subtotal: number
  taxPercent: number // Tax as percentage (e.g., 18 for 18%)
  tax: number // Calculated tax amount
  transportCost: number
  transportLabel: string // Label for transport cost
  otherCost: number
  otherCostLabel: string // Label for other cost
  shipping: number
  discount: number
  total: number
  status: OrderStatus
  notes: string
  createdAt: string
  createdBy: string
  deliveryAddress: string
  deliveryDate: string
  dispatcher?: string // Assigned dispatcher
  pdfUrl?: string // URL to generated PDF
  payments?: OrderPayment[] // Payment records
}

export interface OrderPayment {
  id: string
  amount: number
  method: string
  date: string
  notes: string
  proofUrl?: string
  createdAt: string
  createdBy: string
}

function rowToOrder(r: Record<string, unknown>): Order {
  return {
    id: r.id as string,
    orderNumber: r.orderNumber as string,
    clientId: r.clientId as string,
    clientName: r.clientName as string,
    items: (r.items as OrderItem[]) ?? [],
    subtotal: (r.subtotal as number) ?? 0,
    taxPercent: (r.taxPercent as number) ?? 0,
    tax: (r.tax as number) ?? 0,
    transportCost: (r.transportCost as number) ?? 0,
    transportLabel: (r.transportLabel as string) ?? "Transport",
    otherCost: (r.otherCost as number) ?? 0,
    otherCostLabel: (r.otherCostLabel as string) ?? "Other",
    shipping: (r.shipping as number) ?? 0,
    discount: (r.discount as number) ?? 0,
    total: (r.total as number) ?? 0,
    status: r.status as OrderStatus,
    notes: r.notes as string,
    createdAt: r.createdAt as string,
    createdBy: r.createdBy as string,
    deliveryAddress: (r.deliveryAddress as string) ?? "",
    deliveryDate: (r.deliveryDate as string) ?? "",
    dispatcher: (r.dispatcher as string) ?? undefined,
    pdfUrl: (r.pdfUrl as string) ?? undefined,
    payments: (r.payments as OrderPayment[]) ?? [],
  }
}

export async function getOrders(): Promise<Order[]> {
  try {
    const res = await fetch("/api/db/orders")
    if (!res.ok) return []
    const data = await res.json()
    return (data ?? []).map(rowToOrder)
  } catch { return [] }
}

export async function saveOrder(order: Order): Promise<void> {
  const res = await fetch("/api/db/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  })
  if (!res.ok) console.error("saveOrder error:", res.statusText)
}

export async function deleteOrder(id: string): Promise<void> {
  await fetch("/api/db/orders", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function generateOrderNumber(): Promise<string> {
  try {
    const res = await fetch("/api/db/orders/count")
    const { count } = await res.json()
    const n = (count ?? 0) + 1
    return `ORD-${String(n).padStart(5, "0")}`
  } catch { return `ORD-${Date.now()}` }
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  finalized: "Finalized",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending_approval: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  finalized: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
}
