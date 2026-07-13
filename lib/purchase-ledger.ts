import { extractBillFromNotes } from "@/lib/purchase-ledger-bill"

export type PurchaseLinkMode = "project" | "supplier" | "general"
export type PurchaseCategory = "expense" | "service_charge" | "inventory" | "transport" | "other"
export type PurchaseTransactionType = "purchase" | "expense" | "service" | "payment" | "other"

export interface PurchaseLedgerItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface PurchaseLedgerSupplierGroup {
  id: string
  supplierId: string | null
  supplierName: string
  accountDetails: string
  items: PurchaseLedgerItem[]
  amountPaid?: number
  amountDue?: number
  billUrl?: string
  billName?: string
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
  supplierGroupId?: string
  supplierName?: string
}

export interface PurchaseLedgerEntry {
  id: string
  purchaseScopeId?: string
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
  supplierGroups: PurchaseLedgerSupplierGroup[]
  payments: PurchaseLedgerPayment[]
  notes: string
  dueDate: string
  accountDetails: string
  paymentProofUrl: string
  paymentProofName: string
  billUrl: string
  billName: string
  createdBy: string
  createdAt: string
}

export const PURCHASE_TRANSACTION_TYPES: { value: PurchaseTransactionType; label: string }[] = [
  { value: "purchase", label: "Purchase" },
  { value: "expense", label: "Expense" },
  { value: "service", label: "Service" },
  { value: "payment", label: "Payment" },
  { value: "other", label: "Other" },
]

export const PURCHASE_LINK_MODES: { value: PurchaseLinkMode; label: string }[] = [
  { value: "general", label: "General" },
  { value: "supplier", label: "Supplier based" },
  { value: "project", label: "Project based" },
]

export function normalizeLinkMode(mode: string): PurchaseLinkMode {
  if (mode === "order") return "supplier"
  if (mode === "project" || mode === "supplier" || mode === "general") return mode
  return "general"
}

export function newLedgerItem(partial?: Partial<PurchaseLedgerItem>): PurchaseLedgerItem {
  return {
    id: partial?.id ?? Date.now().toString() + Math.random().toString(36).slice(2, 6),
    productName: partial?.productName ?? "",
    quantity: partial?.quantity ?? 1,
    unitPrice: partial?.unitPrice ?? 0,
    lineTotal: partial?.lineTotal ?? 0,
  }
}

export function newSupplierGroup(partial?: Partial<PurchaseLedgerSupplierGroup>): PurchaseLedgerSupplierGroup {
  return {
    id: partial?.id ?? Date.now().toString() + Math.random().toString(36).slice(2, 6),
    supplierId: partial?.supplierId ?? null,
    supplierName: partial?.supplierName ?? "",
    accountDetails: partial?.accountDetails ?? "",
    items: partial?.items?.length ? partial.items.map(item => ({ ...item })) : [newLedgerItem()],
    amountPaid: partial?.amountPaid ?? 0,
    amountDue: partial?.amountDue,
    billUrl: partial?.billUrl ?? "",
    billName: partial?.billName ?? "",
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

export function sumSupplierGroups(groups: PurchaseLedgerSupplierGroup[]) {
  return groups.reduce((sum, group) => sum + sumItemTotals(group.items), 0)
}

export function getGroupSubtotal(group: PurchaseLedgerSupplierGroup) {
  return sumItemTotals(group.items)
}

export function resolveGroupAmountPaid(group: PurchaseLedgerSupplierGroup) {
  return Math.max(0, group.amountPaid ?? 0)
}

export function resolveGroupAmountDue(group: PurchaseLedgerSupplierGroup) {
  const subtotal = getGroupSubtotal(group)
  const paid = resolveGroupAmountPaid(group)
  // Always derive due from subtotal − paid (never trust a stale stored amountDue).
  return Math.max(0, subtotal - paid)
}

export function sumGroupAmountPaid(groups: PurchaseLedgerSupplierGroup[]) {
  return groups.reduce((sum, group) => sum + resolveGroupAmountPaid(group), 0)
}

export function sumGroupAmountDue(groups: PurchaseLedgerSupplierGroup[]) {
  return groups.reduce((sum, group) => sum + resolveGroupAmountDue(group), 0)
}

export function withGroupPaymentTotals(
  group: PurchaseLedgerSupplierGroup,
  amountPaid: number,
): PurchaseLedgerSupplierGroup {
  const subtotal = getGroupSubtotal(group)
  const paid = Math.max(0, Math.min(amountPaid, subtotal))
  return {
    ...group,
    amountPaid: paid,
    amountDue: Math.max(0, subtotal - paid),
  }
}

export function flattenSupplierGroupItems(groups: PurchaseLedgerSupplierGroup[]) {
  return groups.flatMap(group => group.items)
}

export function sumPayments(payments: PurchaseLedgerPayment[]) {
  return payments.reduce((sum, p) => sum + (p.amount || 0), 0)
}

/** Keep payment lines within bill total (trim from the end). Prevents Paid > Total permanently. */
export function clampPaymentsToTotal(
  payments: PurchaseLedgerPayment[],
  totalAmount: number,
): PurchaseLedgerPayment[] {
  const limit = Math.max(0, Number(totalAmount) || 0)
  let remaining = limit
  const result: PurchaseLedgerPayment[] = []
  for (const payment of payments) {
    if (remaining <= 0) break
    const amount = Math.max(0, Number(payment.amount) || 0)
    if (amount <= 0) continue
    const take = Math.min(amount, remaining)
    result.push(take === amount ? payment : { ...payment, amount: take })
    remaining -= take
  }
  return result
}

/** Realign supplier-group paid/due to payment lines (and bill subtotals). */
export function syncSupplierGroupsToPayments(
  groups: PurchaseLedgerSupplierGroup[],
  payments: PurchaseLedgerPayment[],
): PurchaseLedgerSupplierGroup[] {
  if (groups.length === 0) return groups

  const paidByGroup = new Map<string, number>()
  let unassigned = 0
  for (const payment of payments) {
    const amount = Math.max(0, Number(payment.amount) || 0)
    if (amount <= 0) continue
    const groupId = payment.supplierGroupId?.trim()
    if (groupId) {
      paidByGroup.set(groupId, (paidByGroup.get(groupId) || 0) + amount)
    } else {
      unassigned += amount
    }
  }

  let next = groups.map((group) => {
    const subtotal = getGroupSubtotal(group)
    const fromPayments = paidByGroup.get(group.id) || 0
    return withGroupPaymentTotals(group, Math.min(subtotal, fromPayments))
  })

  if (unassigned > 0) {
    next = next.map((group) => {
      if (unassigned <= 0) return group
      const subtotal = getGroupSubtotal(group)
      const room = Math.max(0, subtotal - resolveGroupAmountPaid(group))
      if (room <= 0) return group
      const take = Math.min(room, unassigned)
      unassigned -= take
      return withGroupPaymentTotals(group, resolveGroupAmountPaid(group) + take)
    })
  }

  return next
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

function parseSupplierGroups(raw: unknown, fallback: {
  supplierId?: string | null
  supplierName?: string
  accountDetails?: string
  items: PurchaseLedgerItem[]
}): PurchaseLedgerSupplierGroup[] {
  const groups = parseJsonArray<Record<string, unknown>>(raw).map((group, index) => {
    const items = parseJsonArray<PurchaseLedgerItem>(group.items).map((item, itemIndex) => ({
      id: String((item as PurchaseLedgerItem).id ?? `item-${index}-${itemIndex}`),
      productName: String((item as PurchaseLedgerItem).productName ?? ""),
      quantity: Number((item as PurchaseLedgerItem).quantity) || 0,
      unitPrice: Number((item as PurchaseLedgerItem).unitPrice) || 0,
      lineTotal: Number((item as PurchaseLedgerItem).lineTotal) || 0,
    }))
    const parsedGroup: PurchaseLedgerSupplierGroup = {
      id: String(group.id ?? `group-${index}`),
      supplierId: (group.supplierId as string | null) ?? null,
      supplierName: String(group.supplierName ?? ""),
      accountDetails: String(group.accountDetails ?? ""),
      items,
      amountPaid: Number(group.amountPaid) || 0,
      amountDue: group.amountDue == null ? undefined : Number(group.amountDue) || 0,
      billUrl: String(group.billUrl ?? ""),
      billName: String(group.billName ?? ""),
    }
    return withGroupPaymentTotals(parsedGroup, parsedGroup.amountPaid ?? 0)
  })

  if (groups.length > 0) return groups

  if (fallback.items.length === 0 && !fallback.supplierName) return []

  return [newSupplierGroup({
    supplierId: fallback.supplierId ?? null,
    supplierName: fallback.supplierName ?? "",
    accountDetails: fallback.accountDetails ?? "",
    items: fallback.items,
  })]
}

function mapRow(row: Record<string, unknown>): PurchaseLedgerEntry {
  let items = parseJsonArray<PurchaseLedgerItem>(row.items)
  let payments: PurchaseLedgerPayment[] = parseJsonArray<PurchaseLedgerPayment>(row.payments).map((payment, index) => {
    const mapped: PurchaseLedgerPayment = {
      id: String((payment as PurchaseLedgerPayment).id ?? `pay-${index}`),
      amount: Number((payment as PurchaseLedgerPayment).amount) || 0,
      date: String((payment as PurchaseLedgerPayment).date ?? ""),
      proofUrl: String((payment as PurchaseLedgerPayment).proofUrl ?? ""),
      proofName: String((payment as PurchaseLedgerPayment).proofName ?? ""),
      notes: String((payment as PurchaseLedgerPayment).notes ?? ""),
      createdAt: String((payment as PurchaseLedgerPayment).createdAt ?? new Date().toISOString()),
      createdBy: String((payment as PurchaseLedgerPayment).createdBy ?? ""),
    }
    if ((payment as PurchaseLedgerPayment).supplierGroupId) {
      mapped.supplierGroupId = String((payment as PurchaseLedgerPayment).supplierGroupId)
    }
    if ((payment as PurchaseLedgerPayment).supplierName) {
      mapped.supplierName = String((payment as PurchaseLedgerPayment).supplierName)
    }
    return mapped
  })
  const totalAmount = Number(row.totalAmount) || 0
  const linkMode = normalizeLinkMode(String(row.linkMode ?? "general"))
  payments = clampPaymentsToTotal(payments, totalAmount)
  const amountPaid = Math.min(totalAmount, Math.max(Number(row.amountPaid) || 0, sumPayments(payments)))
  const amountDue = Math.max(0, totalAmount - amountPaid)

  if (items.length === 0 && row.productName) {
    items = [{
      id: "legacy",
      productName: row.productName as string,
      quantity: Number(row.quantity) || 0,
      unitPrice: Number(row.unitPrice) || 0,
      lineTotal: totalAmount,
    }]
  }

  let supplierGroups = parseSupplierGroups(row.supplierGroups, {
    supplierId: (row.supplierId as string | null) ?? null,
    supplierName: (row.supplierName as string) ?? "",
    accountDetails: (row.accountDetails as string) ?? "",
    items,
  })

  supplierGroups = syncSupplierGroupsToPayments(supplierGroups, payments)

  if (
    linkMode === "project"
    && supplierGroups.length > 1
    && sumGroupAmountPaid(supplierGroups) === 0
    && amountPaid > 0
  ) {
    supplierGroups = supplierGroups.map(group => {
      const share = totalAmount > 0 ? getGroupSubtotal(group) / totalAmount : 0
      return withGroupPaymentTotals(group, amountPaid * share)
    })
  }

  const resolvedItems = items.length > 0 ? items : flattenSupplierGroupItems(supplierGroups)
  const rawNotes = (row.notes as string) ?? ""
  const billMeta = extractBillFromNotes(rawNotes)

  if (
    linkMode === "project"
    && billMeta.billUrl
    && supplierGroups.length > 0
    && !supplierGroups.some(group => group.billUrl)
  ) {
    supplierGroups = supplierGroups.map((group, index) => (
      index === 0 ? { ...group, billUrl: billMeta.billUrl, billName: billMeta.billName } : group
    ))
  }

  return {
    id: row.id as string,
    purchaseScopeId: (row.purchaseScopeId as string) || "P1",
    ledgerNumber: row.ledgerNumber as string,
    transactionDate: row.transactionDate as string,
    linkMode,
    projectName: (row.projectName as string) ?? "",
    orderId: (row.orderId as string | null) ?? null,
    orderNumber: (row.orderNumber as string) ?? "",
    supplierId: (row.supplierId as string | null) ?? null,
    supplierName: (row.supplierName as string) ?? "",
    productName: (row.productName as string) ?? (resolvedItems[0]?.productName ?? ""),
    transactionType: row.transactionType as PurchaseTransactionType,
    category: (row.category as PurchaseCategory) ?? "expense",
    quantity: Number(row.quantity) || resolvedItems.reduce((s, i) => s + i.quantity, 0),
    unitPrice: Number(row.unitPrice) || 0,
    totalAmount,
    amountPaid,
    amountDue,
    items: resolvedItems,
    supplierGroups,
    payments,
    notes: billMeta.notes,
    dueDate: (row.dueDate as string) ?? "",
    accountDetails: (row.accountDetails as string) ?? "",
    paymentProofUrl: (row.paymentProofUrl as string) ?? "",
    paymentProofName: (row.paymentProofName as string) ?? "",
    billUrl: billMeta.billUrl,
    billName: billMeta.billName,
    createdBy: (row.createdBy as string) ?? "",
    createdAt: row.createdAt as string,
  }
}

export async function getPurchaseLedgerEntries(purchaseScopeId?: string): Promise<PurchaseLedgerEntry[]> {
  const qs = purchaseScopeId ? `?scope=${encodeURIComponent(purchaseScopeId)}` : ""
  const res = await fetch(`/api/db/purchase-ledger${qs}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data ?? []).map(mapRow)
}

export async function getNextLedgerNumber(purchaseScopeId?: string): Promise<string> {
  const qs = new URLSearchParams()
  qs.set("nextNumber", "1")
  if (purchaseScopeId) qs.set("scope", purchaseScopeId)
  const res = await fetch(`/api/db/purchase-ledger?${qs.toString()}`)
  if (!res.ok) return "PL-0001"
  const data = await res.json()
  return data.ledgerNumber ?? "PL-0001"
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    if (data && typeof data.error === "string" && data.error) return data.error
  } catch {
    // ignore non-JSON bodies
  }
  return `${fallback} (HTTP ${res.status})`
}

export async function savePurchaseLedgerEntry(
  entry: Omit<PurchaseLedgerEntry, "id" | "createdAt"> & { id?: string },
): Promise<PurchaseLedgerEntry> {
  const res = await fetch("/api/db/purchase-ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to save purchase ledger entry"))
  return mapRow(await res.json())
}

export async function addPurchaseLedgerPayment(
  id: string,
  payment: Omit<PurchaseLedgerPayment, "id" | "createdAt"> & { id?: string },
): Promise<PurchaseLedgerEntry> {
  const res = await fetch("/api/db/purchase-ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addPayment", id, payment }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to record payment"))
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
  if (entry.linkMode === "supplier") return entry.supplierName || "—"
  return "—"
}

export function formatLedgerSuppliers(entry: PurchaseLedgerEntry): string {
  if (entry.supplierGroups.length > 0) {
    const names = entry.supplierGroups.map(g => g.supplierName).filter(Boolean)
    if (names.length > 0) return names.join(", ")
  }
  return entry.supplierName || "—"
}

export function formatLedgerItemsSummary(entry: PurchaseLedgerEntry): string {
  const items = entry.items.length > 0 ? entry.items : flattenSupplierGroupItems(entry.supplierGroups)
  if (items.length === 0) return entry.productName || "—"
  if (items.length === 1) return items[0].productName
  return `${items[0].productName} +${items.length - 1} more`
}

export function formatLinkModeLabel(mode: PurchaseLinkMode | string): string {
  return PURCHASE_LINK_MODES.find(m => m.value === normalizeLinkMode(mode))?.label ?? mode
}
