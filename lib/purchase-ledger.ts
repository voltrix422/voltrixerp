export type PurchaseLinkMode = "project" | "order" | "general"
export type PurchaseCategory = "expense" | "service_charge" | "inventory" | "transport" | "other"
export type PurchaseTransactionType = "purchase" | "expense" | "service" | "payment" | "other"

export interface PurchaseLedgerEntry {
  id: string
  ledgerNumber: string
  transactionDate: string
  linkMode: PurchaseLinkMode
  projectName: string
  orderId?: string | null
  orderNumber: string
  supplierId?: string | null
  supplierName: string
  productName: string
  transactionType: PurchaseTransactionType
  category: PurchaseCategory
  quantity: number
  unitPrice: number
  totalAmount: number
  notes: string
  dueDate: string
  accountDetails: string
  paymentProofUrl: string
  paymentProofName: string
  createdBy: string
  createdAt: string
}

export const PURCHASE_CATEGORIES: { value: PurchaseCategory; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "service_charge", label: "Service Charge" },
  { value: "inventory", label: "Inventory / Purchase" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
]

export const PURCHASE_TRANSACTION_TYPES: { value: PurchaseTransactionType; label: string }[] = [
  { value: "purchase", label: "Purchase" },
  { value: "expense", label: "Expense" },
  { value: "service", label: "Service" },
  { value: "payment", label: "Payment" },
  { value: "other", label: "Other" },
]

function mapRow(row: Record<string, unknown>): PurchaseLedgerEntry {
  return {
    id: row.id as string,
    ledgerNumber: row.ledgerNumber as string,
    transactionDate: row.transactionDate as string,
    linkMode: row.linkMode as PurchaseLinkMode,
    projectName: (row.projectName as string) ?? "",
    orderId: (row.orderId as string | null) ?? null,
    orderNumber: (row.orderNumber as string) ?? "",
    supplierId: (row.supplierId as string | null) ?? null,
    supplierName: (row.supplierName as string) ?? "",
    productName: (row.productName as string) ?? "",
    transactionType: row.transactionType as PurchaseTransactionType,
    category: row.category as PurchaseCategory,
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(row.unitPrice) || 0,
    totalAmount: Number(row.totalAmount) || 0,
    notes: (row.notes as string) ?? "",
    dueDate: (row.dueDate as string) ?? "",
    accountDetails: (row.accountDetails as string) ?? "",
    paymentProofUrl: (row.paymentProofUrl as string) ?? "",
    paymentProofName: (row.paymentProofName as string) ?? "",
    createdBy: (row.createdBy as string) ?? "",
    createdAt: row.createdAt as string,
  }
}

export async function getPurchaseLedgerEntries(): Promise<PurchaseLedgerEntry[]> {
  const res = await fetch("/api/db/purchase-ledger")
  if (!res.ok) return []
  const data = await res.json()
  return (data ?? []).map(mapRow)
}

export async function getNextLedgerNumber(): Promise<string> {
  const res = await fetch("/api/db/purchase-ledger?nextNumber=1")
  if (!res.ok) return "PL-0001"
  const data = await res.json()
  return data.ledgerNumber ?? "PL-0001"
}

export async function savePurchaseLedgerEntry(
  entry: Omit<PurchaseLedgerEntry, "id" | "createdAt"> & { id?: string },
): Promise<PurchaseLedgerEntry | null> {
  const res = await fetch("/api/db/purchase-ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  })
  if (!res.ok) return null
  return mapRow(await res.json())
}

export async function deletePurchaseLedgerEntry(id: string): Promise<void> {
  await fetch("/api/db/purchase-ledger", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export function formatLedgerProject(entry: PurchaseLedgerEntry): string {
  if (entry.linkMode === "project") return entry.projectName || "—"
  if (entry.linkMode === "order") return entry.orderNumber || "—"
  return "—"
}
