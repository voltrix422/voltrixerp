import { supabase } from "@/lib/supabase"

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
    orderNumber: r.order_number as string,
    clientId: r.client_id as string,
    clientName: r.client_name as string,
    items: (r.items as OrderItem[]) ?? [],
    subtotal: (r.subtotal as number) ?? 0,
    taxPercent: (r.tax_percent as number) ?? 0,
    tax: (r.tax as number) ?? 0,
    transportCost: (r.transport_cost as number) ?? 0,
    transportLabel: (r.transport_label as string) ?? "Transport",
    otherCost: (r.other_cost as number) ?? 0,
    otherCostLabel: (r.other_cost_label as string) ?? "Other",
    shipping: (r.shipping as number) ?? 0,
    discount: (r.discount as number) ?? 0,
    total: (r.total as number) ?? 0,
    status: r.status as OrderStatus,
    notes: (r.notes as string) ?? "",
    createdAt: r.created_at as string,
    createdBy: r.created_by as string,
    deliveryAddress: (r.delivery_address as string) ?? "",
    deliveryDate: (r.delivery_date as string) ?? "",
    dispatcher: (r.dispatcher as string) ?? undefined,
    pdfUrl: (r.pdf_url as string) ?? undefined,
    payments: (r.payments as OrderPayment[]) ?? [],
  }
}

export async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("erp_orders")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error(error); return [] }
  return (data ?? []).map(rowToOrder)
}

export async function saveOrder(order: Order): Promise<void> {
  const { error } = await supabase.from("erp_orders").upsert({
    id: order.id,
    order_number: order.orderNumber,
    client_id: order.clientId,
    client_name: order.clientName,
    items: order.items,
    subtotal: order.subtotal,
    tax_percent: order.taxPercent,
    tax: order.tax,
    transport_cost: order.transportCost,
    transport_label: order.transportLabel,
    other_cost: order.otherCost,
    other_cost_label: order.otherCostLabel,
    shipping: order.shipping,
    discount: order.discount,
    total: order.total,
    status: order.status,
    notes: order.notes,
    created_at: order.createdAt,
    created_by: order.createdBy,
    delivery_address: order.deliveryAddress,
    delivery_date: order.deliveryDate,
    dispatcher: order.dispatcher,
    pdf_url: order.pdfUrl,
    payments: order.payments,
  })
  if (error) console.error("saveOrder error:", error.message)
}

export async function deleteOrder(id: string): Promise<void> {
  await supabase.from("erp_orders").delete().eq("id", id)
}

export async function generateOrderNumber(): Promise<string> {
  const { count } = await supabase
    .from("erp_orders")
    .select("*", { count: "exact", head: true })
  const n = (count ?? 0) + 1
  return `ORD-${String(n).padStart(5, "0")}`
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
