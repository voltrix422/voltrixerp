export type PurchaseLinkMode = "project" | "order" | "general"
export type PurchaseCategory = "expense" | "service_charge" | "inventory" | "transport" | "other"
export type PurchaseTransactionType = "purchase" | "expense" | "service" | "payment" | "other"

export interface PurchaseLedgerItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface PurchaseLedgerPayment {
  id: string
  amount: number
  date: string
  proofUrl: string
  proofName: string
  notes: string
  createdAt: string
  createdBy: string
}

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
  amountPaid: number
  amountDue: number
  items: PurchaseLedgerItem[]
  payments: PurchaseLedgerPayment[]
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

export function newLedgerItem(partial?: Partial<PurchaseLedgerItem>): PurchaseLedgerItem {
  return {
    id: partial?.id ?? Date.now().toString() + Math.random().toString(36).slice(2, 6),
    productName: partial?.productName ?? "",
    quantity: partial?.quantity ?? 1,
    unitPrice: partial?.unitPrice ?? 0,
    lineTotal: partial?.lineTotal ?? 0,
  }
}

export function calcLineTotal(item: Pick<PurchaseLedgerItem, "quantity" | "unitPrice">) {
  return (item.quantity || 0) * (item.unitPrice || 0)
}

export function calcUnitPrice(item: Pick<PurchaseLedgerItem, "quantity" | "lineTotal">) {
  const q = item.quantity || 0
  if (q <= 0) return 0
  return (item.lineTotal || 0) / q
}

export function sumItemTotals(items: PurchaseLedgerItem[]) {
  return items.reduce((sum, item) => sum + (item.lineTotal || 0), 0)
}

export function sumPayments(payments: PurchaseLedgerPayment[]) {
  return payments.reduce((sum, p) => sum + (p.amount || 0), 0)
}

function parseJsonArray<T>(value: unknown): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value as T[]
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function mapRow(row: Record<string, unknown>): PurchaseLedgerEntry {
  let items = parseJsonArray<PurchaseLedgerItem>(row.items)
  const payments = parseJsonArray<PurchaseLedgerPayment>(row.payments)
  const totalAmount = Number(row.totalAmount) || 0
  const amountPaid = Number(row.amountPaid) || sumPayments(payments)
  const amountDue = Number(row.amountDue) || Math.max(0, totalAmount - amountPaid)

  if (items.length === 0 && row.productName) {
    items = [{
      id: "legacy",
      productName: row.productName as string,
      quantity: Number(row.quantity) || 0,
      unitPrice: Number(row.unitPrice) || 0,
      lineTotal: totalAmount,
    }]
  }

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
    productName: (row.productName as string) ?? (items[0]?.productName ?? ""),
    transactionType: row.transactionType as PurchaseTransactionType,
    category: row.category as PurchaseCategory,
    quantity: Number(row.quantity) || items.reduce((s, i) => s + i.quantity, 0),
    unitPrice: Number(row.unitPrice) || 0,
    totalAmount,
    amountPaid,
    amountDue,
    items,
    payments,
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

export async function addPurchaseLedgerPayment(
  id: string,
  payment: Omit<PurchaseLedgerPayment, "id" | "createdAt"> & { id?: string },
): Promise<PurchaseLedgerEntry | null> {
  const res = await fetch("/api/db/purchase-ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addPayment", id, payment }),
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

export function formatLedgerItemsSummary(entry: PurchaseLedgerEntry): string {
  if (entry.items.length === 0) return entry.productName || "—"
  if (entry.items.length === 1) return entry.items[0].productName
  return `${entry.items[0].productName} +${entry.items.length - 1} more`
}
