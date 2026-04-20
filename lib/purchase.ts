// DB access via /api/db routes (Prisma)

export type SupplierType = "local" | "imported"

export interface Supplier {
  id: string
  name: string
  type: SupplierType
  contact: string
  email: string
  address: string
  company: string
  bankAccountName?: string
  bankIban?: string
  image?: string
}

export interface POItem {
  id: string
  description: string
  qty: number
  unit: string
  specs?: string
}

export type POStatus =
  | "draft"
  | "sent_to_admin"
  | "approved"
  | "rejected"
  | "sharing"
  | "quoted"
  | "finalized"
  | "direct"
  | "in_inventory"             // direct/finalized POs moved to inventory
  // ── Imported PO flow ──
  | "imp_admin_draft"          // admin creating, uploading docs
  | "imp_purchase"             // sent to purchase — add items/supplier/prices
  | "imp_finance_1"            // purchase sent to finance — finance uploads docs
  | "imp_purchase_2"           // finance sent back to purchase — add PSSID + docs
  | "imp_pending_approval"     // purchase sent to admin for approval
  | "imp_approved"             // admin approved
  | "imp_rejected"             // admin rejected
  | "imp_finance_2"            // approved, finance does payments
  | "imp_purchase_final"       // finance sent to purchase — view full flow
  | "imp_inventory"            // imported POs moved to inventory

export interface ItemDuty {
  id: string
  name: string
  amount: number
}

export interface ImportedPOItem {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  duties?: ItemDuty[] // Array of named duties per item
}

export interface PODocument {
  id: string
  name: string
  url: string
  uploadedBy: string
  uploadedAt: string
}

export interface ImportedPOStep {
  step: string
  actor: string
  note: string
  doneAt: string
}

export interface SupplierSentRecord {
  supplierId: string
  supplierName: string
  sentAt: string
}

export interface QuoteItem {
  itemId: string
  unitPrice: number  // price per unit in PKR
}

export interface SupplierQuote {
  supplierId: string
  supplierName: string
  items: QuoteItem[]
  taxPct: number        // tax %
  transportCost: number // flat transport cost
  otherCost: number     // any other flat cost
  otherCostLabel: string
  notes: string
  submittedAt: string
}

export interface PaymentRecord {
  id: string
  amount: number
  method: string
  date: string
  notes: string
  proofUrl?: string       // uploaded image URL
  createdAt: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  type: SupplierType
  supplierIds: string[]
  supplierNames: string[]
  items: POItem[]
  notes: string
  status: POStatus
  createdBy: string
  createdAt: string
  adminNote: string
  sentToSupplier: boolean
  deliveryDate: string
  receivingLocation: string
  suppliersSent: SupplierSentRecord[]
  quotes: SupplierQuote[]
  finalizedSupplierId?: string
  payments: PaymentRecord[]
  // legacy single-payment fields (kept for backward compat)
  paymentAmount?: number
  paymentMethod?: string
  paymentDate?: string
  paymentProof?: string
  paymentNotes?: string
  // ── Imported PO fields ──
  adminDocuments: PODocument[]         // docs uploaded by admin
  financeDocuments1: PODocument[]      // docs uploaded by finance (round 1)
  purchaseDocuments: PODocument[]      // docs uploaded by purchase (round 2)
  financeDocuments2: PODocument[]      // docs uploaded by finance (round 2, payment)
  pssid?: string                       // PSSID number added by purchase
  importedSupplierName?: string        // free-text supplier name for imported POs
  importedItems: ImportedPOItem[]      // items with prices for imported POs
  flowHistory: ImportedPOStep[]        // audit trail of each step
}

// ── Suppliers ────────────────────────────────────────────────────
export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const res = await fetch("/api/db/suppliers")
    if (!res.ok) return []
    const data = await res.json()
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, name: r.name as string, type: r.type as SupplierType,
      contact: r.contact as string, email: r.email as string, address: r.address as string, company: r.company as string,
      bankAccountName: r.bank_account_name as string | undefined, bankIban: r.bank_iban as string | undefined,
      image: (r.image as string) || undefined,
    }))
  } catch { return [] }
}

export async function saveSupplier(s: Supplier): Promise<void> {
  await fetch("/api/db/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  })
}

export async function deleteSupplier(id: string): Promise<void> {
  await fetch("/api/db/suppliers", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

// ── Purchase Orders ──────────────────────────────────────────────
function rowToPO(r: Record<string, unknown>): PurchaseOrder {
  // Helper to parse JSON fields
  const parseJSON = <T>(value: unknown, defaultValue: T): T => {
    if (!value) return defaultValue
    try {
      if (typeof value === 'string') {
        return JSON.parse(value) as T
      }
      return value as T
    } catch {
      return defaultValue
    }
  }

  return {
    id: r.id as string,
    poNumber: r.poNumber as string,
    type: r.type as SupplierType,
    supplierIds: parseJSON<string[]>(r.supplierIds, []),
    supplierNames: parseJSON<string[]>(r.supplierNames, []),
    items: parseJSON<POItem[]>(r.items, []),
    notes: r.notes as string,
    status: r.status as POStatus,
    createdBy: r.createdBy as string,
    createdAt: r.createdAt as string,
    adminNote: r.adminNote as string,
    sentToSupplier: r.sentToSupplier as boolean,
    deliveryDate: (r.deliveryDate as string) ?? "",
    receivingLocation: (r.receivingLocation as string) ?? "",
    suppliersSent: parseJSON<SupplierSentRecord[]>(r.suppliersSent, []),
    quotes: parseJSON<SupplierQuote[]>(r.quotes, []),
    finalizedSupplierId: (r.finalizedSupplierId as string) ?? undefined,
    payments: parseJSON<PaymentRecord[]>(r.payments, []),
    paymentAmount: (r.paymentAmount as number) ?? undefined,
    paymentMethod: (r.paymentMethod as string) ?? undefined,
    paymentDate: (r.paymentDate as string) ?? undefined,
    paymentProof: (r.paymentProof as string) ?? undefined,
    paymentNotes: (r.paymentNotes as string) ?? undefined,
    adminDocuments: parseJSON<PODocument[]>(r.adminDocuments, []),
    financeDocuments1: parseJSON<PODocument[]>(r.financeDocuments1, []),
    purchaseDocuments: parseJSON<PODocument[]>(r.purchaseDocuments, []),
    financeDocuments2: parseJSON<PODocument[]>(r.financeDocuments2, []),
    pssid: (r.pssid as string) ?? undefined,
    importedSupplierName: (r.importedSupplierName as string) ?? undefined,
    importedItems: parseJSON<ImportedPOItem[]>(r.importedItems, []),
    flowHistory: parseJSON<ImportedPOStep[]>(r.flowHistory, []),
  }
}

export async function getPOs(): Promise<PurchaseOrder[]> {
  try {
    const res = await fetch("/api/db/purchase-orders")
    if (!res.ok) return []
    const data = await res.json()
    return (data ?? []).map(rowToPO)
  } catch { return [] }
}

export async function savePO(po: PurchaseOrder): Promise<void> {
  const res = await fetch("/api/db/purchase-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(po),
  })
  if (!res.ok) console.error("savePO error:", res.statusText)
}

export async function deletePO(id: string): Promise<void> {
  await fetch("/api/db/purchase-orders", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function generatePONumber(): Promise<string> {
  try {
    const res = await fetch("/api/db/purchase-orders/count")
    const { count } = await res.json()
    const n = (count ?? 0) + 1
    return `PO-${String(n).padStart(4, "0")}`
  } catch { return `PO-${Date.now()}` }
}

export const STATUS_LABELS: Record<POStatus, string> = {
  draft: "Draft",
  sent_to_admin: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  sharing: "Sharing with Suppliers",
  quoted: "Quotes Received",
  finalized: "Finalized",
  direct: "Direct PO",
  in_inventory: "In Inventory",
  imp_admin_draft: "Admin Draft",
  imp_purchase: "With Purchase",
  imp_finance_1: "With Finance",
  imp_purchase_2: "With Purchase",
  imp_pending_approval: "Pending Approval",
  imp_approved: "Approved",
  imp_rejected: "Rejected",
  imp_finance_2: "Finance — Payment",
  imp_purchase_final: "With Purchase",
  imp_inventory: "Inventory",
}

export const STATUS_VARIANT: Record<POStatus, "secondary" | "warning" | "success" | "destructive" | "info" | "default"> = {
  draft: "secondary",
  sent_to_admin: "warning",
  approved: "success",
  rejected: "destructive",
  sharing: "info",
  quoted: "default",
  finalized: "success",
  direct: "info",
  in_inventory: "success",
  imp_admin_draft: "secondary",
  imp_purchase: "info",
  imp_finance_1: "warning",
  imp_purchase_2: "info",
  imp_pending_approval: "warning",
  imp_approved: "success",
  imp_rejected: "destructive",
  imp_finance_2: "warning",
  imp_purchase_final: "info",
  imp_inventory: "success",
}

// ── Quote helpers ────────────────────────────────────────────────
export function calcQuoteTotal(po: PurchaseOrder, quote: SupplierQuote): number {
  const itemsTotal = po.items.reduce((sum, item) => {
    const qi = quote.items.find(q => q.itemId === item.id)
    return sum + (qi ? qi.unitPrice * item.qty : 0)
  }, 0)
  const taxAmount = itemsTotal * (quote.taxPct / 100)
  return itemsTotal + taxAmount + quote.transportCost + quote.otherCost
}

// ── Inventory Items ──────────────────────────────────────────────
export interface InventoryItem {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  poNumber: string
  supplier: string
  poId: string
  specs?: string
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  try {
    // Fetch items directly from inventory-stock table (source of truth for available quantity)
    const stockRes = await fetch("/api/db/inventory-stock")
    if (!stockRes.ok) return []
    
    const stockItems: any[] = await stockRes.json()
    const dbItems: InventoryItem[] = stockItems
      .filter((stock: any) => (stock.availableQty || 0) > 0) // Only show items with available quantity > 0
      .map((stock: any) => ({
        id: stock.itemId || stock.id,
        description: stock.description,
        qty: stock.availableQty || stock.available_qty || 0, // Use availableQty as the quantity
        unit: stock.unit,
        unitPrice: stock.costPrice || stock.cost_price || 0,
        poNumber: stock.poNumber || stock.po_number || "",
        supplier: stock.supplierName || stock.supplier_name || "—",
        poId: stock.poId || stock.po_id || stock.id,
        specs: stock.specs || "",
      }))

    return dbItems
  } catch { return [] }
}
