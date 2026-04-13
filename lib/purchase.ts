import { supabase } from "@/lib/supabase"

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
}

export interface POItem {
  id: string
  description: string
  qty: number
  unit: string
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
  const { data, error } = await supabase.from("erp_suppliers").select("*").order("name")
  if (error) { console.error(error); return [] }
  return (data ?? []).map(r => ({
    id: r.id, name: r.name, type: r.type,
    contact: r.contact, email: r.email, address: r.address, company: r.company,
    bankAccountName: r.bank_account_name, bankIban: r.bank_iban,
  }))
}

export async function saveSupplier(s: Supplier): Promise<void> {
  await supabase.from("erp_suppliers").upsert({
    id: s.id, name: s.name, type: s.type,
    contact: s.contact, email: s.email, address: s.address, company: s.company,
    bank_account_name: s.bankAccountName, bank_iban: s.bankIban,
  })
}

export async function deleteSupplier(id: string): Promise<void> {
  await supabase.from("erp_suppliers").delete().eq("id", id)
}

// ── Purchase Orders ──────────────────────────────────────────────
function rowToPO(r: Record<string, unknown>): PurchaseOrder {
  return {
    id: r.id as string,
    poNumber: r.po_number as string,
    type: r.type as SupplierType,
    supplierIds: (r.supplier_ids as string[]) ?? [],
    supplierNames: (r.supplier_names as string[]) ?? [],
    items: (r.items as POItem[]) ?? [],
    notes: r.notes as string,
    status: r.status as POStatus,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    adminNote: r.admin_note as string,
    sentToSupplier: r.sent_to_supplier as boolean,
    deliveryDate: (r.delivery_date as string) ?? "",
    receivingLocation: (r.receiving_location as string) ?? "",
    suppliersSent: (r.suppliers_sent as SupplierSentRecord[]) ?? [],
    quotes: (r.quotes as SupplierQuote[]) ?? [],
    finalizedSupplierId: (r.finalized_supplier_id as string) ?? undefined,
    payments: (r.payments as PaymentRecord[]) ?? [],
    paymentAmount: (r.payment_amount as number) ?? undefined,
    paymentMethod: (r.payment_method as string) ?? undefined,
    paymentDate: (r.payment_date as string) ?? undefined,
    paymentProof: (r.payment_proof as string) ?? undefined,
    paymentNotes: (r.payment_notes as string) ?? undefined,
    adminDocuments: (r.admin_documents as PODocument[]) ?? [],
    financeDocuments1: (r.finance_documents_1 as PODocument[]) ?? [],
    purchaseDocuments: (r.purchase_documents as PODocument[]) ?? [],
    financeDocuments2: (r.finance_documents_2 as PODocument[]) ?? [],
    pssid: (r.pssid as string) ?? undefined,
    importedSupplierName: (r.imported_supplier_name as string) ?? undefined,
    importedItems: (r.imported_items as ImportedPOItem[]) ?? [],
    flowHistory: (r.flow_history as ImportedPOStep[]) ?? [],
  }
}

export async function getPOs(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from("erp_purchase_orders")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error(error); return [] }
  return (data ?? []).map(rowToPO)
}

export async function savePO(po: PurchaseOrder): Promise<void> {
  const { error } = await supabase.from("erp_purchase_orders").upsert({
    id: po.id,
    po_number: po.poNumber,
    type: po.type,
    supplier_ids: po.supplierIds,
    supplier_names: po.supplierNames,
    items: po.items,
    notes: po.notes,
    status: po.status,
    created_by: po.createdBy,
    created_at: po.createdAt,
    admin_note: po.adminNote,
    sent_to_supplier: po.sentToSupplier,
    delivery_date: po.deliveryDate,
    receiving_location: po.receivingLocation,
    suppliers_sent: po.suppliersSent,
    quotes: po.quotes,
    finalized_supplier_id: po.finalizedSupplierId,
    payments: po.payments,
    payment_amount: po.paymentAmount,
    payment_method: po.paymentMethod,
    payment_date: po.paymentDate,
    payment_proof: po.paymentProof,
    payment_notes: po.paymentNotes,
    admin_documents: po.adminDocuments,
    finance_documents_1: po.financeDocuments1,
    purchase_documents: po.purchaseDocuments,
    finance_documents_2: po.financeDocuments2,
    pssid: po.pssid,
    imported_supplier_name: po.importedSupplierName,
    imported_items: po.importedItems,
    flow_history: po.flowHistory,
  })
  if (error) console.error("savePO error:", error.message, error.details)
}

export async function deletePO(id: string): Promise<void> {
  await supabase.from("erp_purchase_orders").delete().eq("id", id)
}

export async function generatePONumber(): Promise<string> {
  const { count } = await supabase
    .from("erp_purchase_orders")
    .select("*", { count: "exact", head: true })
  const n = (count ?? 0) + 1
  return `PO-${String(n).padStart(4, "0")}`
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
  return itemsTotal + quote.taxPct + quote.transportCost + quote.otherCost
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
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("erp_purchase_orders")
    .select("*")
    .in("status", ["imp_inventory", "in_inventory"])
  
  if (error) {
    console.error("Error fetching inventory:", error)
    return []
  }

  console.log("Inventory POs found:", data?.length, data)

  const items: InventoryItem[] = []
  
  data?.forEach((po: any) => {
    console.log("Processing PO:", po.po_number, "Type:", po.type, "Items:", po.items, "Imported Items:", po.imported_items)
    
    if (po.type === "imported" && po.imported_items) {
      po.imported_items.forEach((item: any) => {
        items.push({
          id: `${po.id}-${item.id}`,
          description: item.description,
          qty: item.qty,
          unit: item.unit,
          unitPrice: item.unitPrice,
          poNumber: po.po_number,
          supplier: po.imported_supplier_name || "—",
          poId: po.id,
        })
      })
    } else if (po.items && Array.isArray(po.items) && po.items.length > 0) {
      // Handle local/finalized/direct POs - all use the same items structure
      const quote = po.quotes?.find((q: any) => q.supplierId === po.finalized_supplier_id)
      
      if (quote && quote.items) {
        // Calculate landed cost for POs with quotes
        const itemsTotal = po.items.reduce((sum: number, item: any) => {
          const qi = quote.items.find((q: any) => q.itemId === item.id)
          return sum + (qi ? qi.unitPrice * item.qty : 0)
        }, 0)
        
        const totalCost = itemsTotal + (quote.taxPct || 0) + (quote.transportCost || 0) + (quote.otherCost || 0)
        const totalQty = po.items.reduce((sum: number, item: any) => sum + item.qty, 0)
        const costPerUnit = totalQty > 0 ? totalCost / totalQty : 0
        
        po.items.forEach((item: any) => {
          items.push({
            id: `${po.id}-${item.id}`,
            description: item.description,
            qty: item.qty,
            unit: item.unit,
            unitPrice: costPerUnit,
            poNumber: po.po_number,
            supplier: po.supplier_names?.[0] || "—",
            poId: po.id,
          })
        })
      } else {
        // For local POs without quotes, use a default price of 0
        po.items.forEach((item: any) => {
          items.push({
            id: `${po.id}-${item.id}`,
            description: item.description,
            qty: item.qty,
            unit: item.unit,
            unitPrice: 0, // No price info available
            poNumber: po.po_number,
            supplier: po.supplier_names?.[0] || "Local",
            poId: po.id,
          })
        })
      }
    }
  })
  
  console.log("Total inventory items:", items.length, items)
  return items
}
