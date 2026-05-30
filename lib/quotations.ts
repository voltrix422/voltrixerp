// Quotations library for CRM module

export type QuotationStatus = "draft" | "pending_approval" | "sent" | "accepted" | "rejected" | "expired" | "converted"

export interface QuotationItem {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  isCustom: boolean // true if custom item, false if from inventory
  inventoryItemId?: string // reference to inventory item if not custom
  model?: string // warehouse / manual model when from inventory
  availableQty?: number // available quantity in stock (for validation, not saved to DB)
  costPrice?: number // cost price from inventory (for reference, not saved to DB)
}

export interface Quotation {
  id: string
  quotationNumber: string
  clientId: string
  clientName: string
  items: QuotationItem[]
  subtotal: number
  taxPercent: number // Tax as percentage (e.g., 18 for 18%)
  tax: number // Calculated tax amount
  transportCost: number
  transportLabel: string // Label for transport cost
  transportIsPercentage?: boolean
  transportCostValue?: number // Calculated transport amount
  otherCost: number
  otherCostLabel: string // Label for other cost
  otherCostIsPercentage?: boolean
  otherCostValue?: number // Calculated other cost amount
  discount: number
  discountIsPercentage?: boolean
  discountValue?: number // Calculated discount amount
  total: number
  status: QuotationStatus
  notes: string
  deliveryAddress: string
  validUntil: string // Expiry date for quotation
  createdAt: string
  createdBy: string
  ownerUserId?: string
  convertedToOrderId?: string // If converted to order, store order ID
}

function rowToQuotation(r: Record<string, unknown>): Quotation {
  return {
    id: r.id as string,
    quotationNumber: r.quotationNumber as string,
    clientId: r.clientId as string,
    clientName: r.clientName as string,
    items: (r.items as QuotationItem[]) ?? [],
    subtotal: (r.subtotal as number) ?? 0,
    taxPercent: (r.taxPercent as number) ?? 0,
    tax: (r.tax as number) ?? 0,
    transportCost: (r.transportCost as number) ?? 0,
    transportLabel: (r.transportLabel as string) ?? "Transport",
    transportIsPercentage: (r.transportIsPercentage as boolean) ?? false,
    transportCostValue: (r.transportCostValue as number) ?? 0,
    otherCost: (r.otherCost as number) ?? 0,
    otherCostLabel: (r.otherCostLabel as string) ?? "Other",
    otherCostIsPercentage: (r.otherCostIsPercentage as boolean) ?? false,
    otherCostValue: (r.otherCostValue as number) ?? 0,
    discount: (r.discount as number) ?? 0,
    discountIsPercentage: (r.discountIsPercentage as boolean) ?? true,
    discountValue: (r.discountValue as number) ?? 0,
    total: (r.total as number) ?? 0,
    status: r.status as QuotationStatus,
    notes: r.notes as string,
    deliveryAddress: (r.deliveryAddress as string) ?? "",
    validUntil: (r.validUntil as string) ?? "",
    createdAt: r.createdAt as string,
    createdBy: r.createdBy as string,
    ownerUserId: (r.ownerUserId as string) ?? undefined,
    convertedToOrderId: (r.convertedToOrderId as string) ?? undefined,
  }
}

export async function getQuotations(): Promise<Quotation[]> {
  try {
    const res = await fetch("/api/crm/quotations")
    if (!res.ok) return []
    const data = await res.json()
    return (data ?? []).map(rowToQuotation)
  } catch { return [] }
}

export async function saveQuotation(quotation: Quotation): Promise<void> {
  const res = await fetch("/api/crm/quotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quotation),
  })
  if (!res.ok) console.error("saveQuotation error:", res.statusText)
}

export async function deleteQuotation(id: string): Promise<void> {
  await fetch("/api/crm/quotations", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function generateQuotationNumber(): Promise<string> {
  try {
    const res = await fetch("/api/crm/quotations/count")
    const { count } = await res.json()
    const n = (count ?? 0) + 1
    return `QUO-${String(n).padStart(5, "0")}`
  } catch { return `QUO-${Date.now()}` }
}

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Converted to Order",
}

export const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending_approval: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  expired: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  converted: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
}
