import { extractBillFromNotes } from "@/lib/purchase-ledger-bill"

export type PurchaseLinkMode = "project" | "supplier" | "general"
export type PurchaseCategory = "expense" | "service_charge" | "inventory" | "transport" | "other"
export type PurchaseTransactionType = "purchase" | "expense" | "service" | "payment" | "rent" | "other"

export interface PurchaseLedgerItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type LedgerAttachment = {
  url: string
  name: string
}

export interface PurchaseLedgerSupplierGroup {
  id: string
  supplierId: string | null
  supplierName: string
  accountDetails: string
  items: PurchaseLedgerItem[]
  amountPaid?: number
  amountDue?: number
  /** Date for this supplier’s purchase / payment (shown per supplier). */
  date?: string
  /** @deprecated Prefer billAttachments — kept for older rows. */
  billUrl?: string
  billName?: string
  billAttachments?: LedgerAttachment[]
  /** @deprecated Prefer paymentProofAttachments — kept for older rows. */
  paymentProofUrl?: string
  paymentProofName?: string
  paymentProofAttachments?: LedgerAttachment[]
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
  /** GST / tax percent applied to items subtotal (0 if using a fixed tax amount). */
  taxPercent: number
  /** Tax amount in PKR — included in totalAmount. */
  taxAmount: number
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
  { value: "rent", label: "Rent" },
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

export function normalizeAttachments(
  list: LedgerAttachment[] | undefined,
  legacyUrl?: string,
  legacyName?: string,
): LedgerAttachment[] {
  const fromList = (Array.isArray(list) ? list : [])
    .map(item => ({
      url: String(item?.url ?? "").trim(),
      name: String(item?.name ?? "").trim() || "Attachment",
    }))
    .filter(item => item.url)
  if (fromList.length > 0) {
    const seen = new Set<string>()
    return fromList.filter(item => {
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
  }
  const url = String(legacyUrl ?? "").trim()
  if (!url) return []
  return [{ url, name: String(legacyName ?? "").trim() || "Attachment" }]
}

export function withSyncedLegacyAttachments(
  group: PurchaseLedgerSupplierGroup,
): PurchaseLedgerSupplierGroup {
  const billAttachments = normalizeAttachments(group.billAttachments, group.billUrl, group.billName)
  const paymentProofAttachments = normalizeAttachments(
    group.paymentProofAttachments,
    group.paymentProofUrl,
    group.paymentProofName,
  )
  return {
    ...group,
    billAttachments,
    paymentProofAttachments,
    billUrl: billAttachments[0]?.url || "",
    billName: billAttachments[0]?.name || "",
    paymentProofUrl: paymentProofAttachments[0]?.url || "",
    paymentProofName: paymentProofAttachments[0]?.name || "",
  }
}

export function newSupplierGroup(partial?: Partial<PurchaseLedgerSupplierGroup>): PurchaseLedgerSupplierGroup {
  return withSyncedLegacyAttachments({
    id: partial?.id ?? Date.now().toString() + Math.random().toString(36).slice(2, 6),
    supplierId: partial?.supplierId ?? null,
    supplierName: partial?.supplierName ?? "",
    accountDetails: partial?.accountDetails ?? "",
    items: partial?.items?.length ? partial.items.map(item => ({ ...item })) : [newLedgerItem()],
    amountPaid: partial?.amountPaid ?? 0,
    amountDue: partial?.amountDue,
    date: partial?.date ?? "",
    billUrl: partial?.billUrl ?? "",
    billName: partial?.billName ?? "",
    billAttachments: partial?.billAttachments,
    paymentProofUrl: partial?.paymentProofUrl ?? "",
    paymentProofName: partial?.paymentProofName ?? "",
    paymentProofAttachments: partial?.paymentProofAttachments,
  })
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

/** Tax amount from percent of items subtotal (rounded to 2 decimals). */
export function taxAmountFromPercent(itemsSubtotal: number, taxPercent: number) {
  const sub = Math.max(0, Number(itemsSubtotal) || 0)
  const pct = Math.max(0, Number(taxPercent) || 0)
  return Math.round(((sub * pct) / 100) * 100) / 100
}

/** Grand total = items subtotal + tax. */
export function ledgerGrandTotal(itemsSubtotal: number, taxAmount: number) {
  return Math.max(0, Number(itemsSubtotal) || 0) + Math.max(0, Number(taxAmount) || 0)
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

export function normalizeSupplierKey(name: string | undefined | null) {
  return String(name ?? "").replace(/\s+/g, " ").trim().toLowerCase()
}

/** Pull supplier hint from notes like "Initial payment · ARAMCO". */
export function supplierNameFromPaymentNotes(notes: string | undefined | null) {
  const parts = String(notes ?? "")
    .split("·")
    .map(part => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return ""
  const last = parts[parts.length - 1]
  // Ignore trailing person names when pattern is "… · Supplier · Person"
  if (parts.length >= 3 && /payment/i.test(parts[0])) {
    return parts[1] || last
  }
  return last
}

/**
 * Re-attach payments to current supplier groups.
 * Fixes orphan/stale supplierGroupId (common after edits) by matching supplier name.
 * Also folds proof-only (amount 0) rows onto the latest real payment for that group.
 */
export function reconcilePaymentsToSupplierGroups(
  payments: PurchaseLedgerPayment[],
  groups: PurchaseLedgerSupplierGroup[],
): PurchaseLedgerPayment[] {
  if (payments.length === 0) return payments

  const byId = new Map(groups.map(group => [group.id, group]))
  const byName = new Map<string, PurchaseLedgerSupplierGroup>()
  for (const group of groups) {
    const key = normalizeSupplierKey(group.supplierName)
    if (key && !byName.has(key)) byName.set(key, group)
  }

  const linked = payments.map((payment) => {
    const rawId = payment.supplierGroupId?.trim()
    if (rawId && byId.has(rawId)) {
      const group = byId.get(rawId)!
      return {
        ...payment,
        supplierGroupId: group.id,
        supplierName: payment.supplierName?.trim() || group.supplierName,
      }
    }

    const nameHint =
      payment.supplierName?.trim()
      || supplierNameFromPaymentNotes(payment.notes)
    const byNameHit = nameHint ? byName.get(normalizeSupplierKey(nameHint)) : undefined
    if (byNameHit) {
      return {
        ...payment,
        supplierGroupId: byNameHit.id,
        supplierName: payment.supplierName?.trim() || byNameHit.supplierName,
      }
    }

    // Drop orphan ids so amounts can fall into the unassigned pool when syncing.
    if (rawId && !byId.has(rawId)) {
      return { ...payment, supplierGroupId: undefined }
    }
    return payment
  })

  // Merge zero-amount proof rows into the latest positive payment for the same group.
  const proofOnly = linked.filter(p => (Number(p.amount) || 0) <= 0 && p.proofUrl)
  const keep: PurchaseLedgerPayment[] = []
  for (const payment of linked) {
    const amount = Math.max(0, Number(payment.amount) || 0)
    if (amount <= 0) continue
    keep.push(payment)
  }

  for (const proof of proofOnly) {
    const groupId = proof.supplierGroupId?.trim()
    let targetIndex = -1
    for (let i = keep.length - 1; i >= 0; i--) {
      const candidate = keep[i]
      if (groupId && candidate.supplierGroupId === groupId) {
        targetIndex = i
        break
      }
      if (
        !groupId
        && normalizeSupplierKey(candidate.supplierName) === normalizeSupplierKey(proof.supplierName)
        && normalizeSupplierKey(proof.supplierName)
      ) {
        targetIndex = i
        break
      }
    }
    if (targetIndex >= 0) {
      const target = keep[targetIndex]
      if (!target.proofUrl) {
        keep[targetIndex] = {
          ...target,
          proofUrl: proof.proofUrl,
          proofName: proof.proofName || target.proofName,
        }
      }
    } else {
      // Keep standalone proof if nothing to merge onto.
      keep.push({ ...proof, amount: 0 })
    }
  }

  return keep
}

/**
 * If a supplier is over-paid (payments > subtotal), move the excess amount
 * onto other suppliers that still have remaining due.
 */
export function redistributePaymentOverflow(
  payments: PurchaseLedgerPayment[],
  groups: PurchaseLedgerSupplierGroup[],
): PurchaseLedgerPayment[] {
  if (payments.length === 0 || groups.length === 0) return payments

  const roomById = new Map(groups.map(group => [group.id, getGroupSubtotal(group)]))
  const groupById = new Map(groups.map(group => [group.id, group]))
  const groupOrder = groups.map(group => group.id)
  const result: PurchaseLedgerPayment[] = []

  for (const payment of payments) {
    let left = Math.max(0, Number(payment.amount) || 0)
    if (left <= 0) {
      if (payment.proofUrl) result.push({ ...payment, amount: 0 })
      continue
    }

    const homeId = payment.supplierGroupId?.trim() || ""
    const tryOrder = homeId
      ? [homeId, ...groupOrder.filter(id => id !== homeId)]
      : [...groupOrder]

    let keptProofOnHome = false
    let chunkIndex = 0
    for (const groupId of tryOrder) {
      if (left <= 0) break
      const room = roomById.get(groupId) || 0
      if (room <= 0) continue
      const take = Math.min(left, room)
      roomById.set(groupId, room - take)
      left -= take
      const group = groupById.get(groupId)
      const isHome = Boolean(homeId && groupId === homeId)
      const attachProof = Boolean(payment.proofUrl) && (isHome || (!homeId && chunkIndex === 0))
      if (attachProof && isHome) keptProofOnHome = true
      result.push({
        ...payment,
        id: chunkIndex === 0 ? payment.id : `${payment.id}-x${chunkIndex}`,
        amount: take,
        supplierGroupId: groupId,
        supplierName: group?.supplierName || payment.supplierName,
        // Don't carry a home-supplier proof onto another supplier when overflow moves.
        proofUrl: attachProof && (isHome || !keptProofOnHome) ? payment.proofUrl : (attachProof ? payment.proofUrl : ""),
        proofName: attachProof && (isHome || !keptProofOnHome) ? payment.proofName : (attachProof ? payment.proofName : ""),
      })
      // Clear proof on overflow chunks when home already kept it (or when reassigning away from home).
      if (!isHome && homeId) {
        const last = result[result.length - 1]
        result[result.length - 1] = { ...last, proofUrl: "", proofName: "" }
      }
      chunkIndex += 1
    }

    if (left > 0) {
      result.push({
        ...payment,
        id: chunkIndex === 0 ? payment.id : `${payment.id}-rest`,
        amount: left,
        supplierGroupId: undefined,
        proofUrl: chunkIndex === 0 ? payment.proofUrl : "",
        proofName: chunkIndex === 0 ? payment.proofName : "",
      })
    }
  }

  return result
}

/** Merge multiple payment lines for the same supplier into one (keeps a real proof). */
export function consolidatePaymentsBySupplier(
  payments: PurchaseLedgerPayment[],
  groups: PurchaseLedgerSupplierGroup[],
): PurchaseLedgerPayment[] {
  if (payments.length <= 1) return payments

  const groupById = new Map(groups.map(group => [group.id, group]))
  const buckets = new Map<string, PurchaseLedgerPayment[]>()
  const passthrough: PurchaseLedgerPayment[] = []

  for (const payment of payments) {
    const groupId = payment.supplierGroupId?.trim()
    const nameKey = normalizeSupplierKey(payment.supplierName)
    const key = groupId || (nameKey ? `name:${nameKey}` : "")
    if (!key) {
      passthrough.push(payment)
      continue
    }
    const list = buckets.get(key) ?? []
    list.push(payment)
    buckets.set(key, list)
  }

  const merged: PurchaseLedgerPayment[] = []
  for (const [key, list] of buckets) {
    if (list.length === 1) {
      merged.push(list[0])
      continue
    }

    const groupId = key.startsWith("name:") ? list.find(p => p.supplierGroupId)?.supplierGroupId : key
    const group = groupId ? groupById.get(groupId) : undefined
    const groupNameKey = normalizeSupplierKey(group?.supplierName || list[0].supplierName)
    const total = list.reduce((sum, p) => sum + Math.max(0, Number(p.amount) || 0), 0)
    const proof =
      [...list].reverse().find(p =>
        p.proofUrl
        && normalizeSupplierKey(p.supplierName) === groupNameKey
      )
      || [...list].reverse().find(p => p.proofUrl)
      || list[0]
    const dates = list.map(p => p.date).filter(Boolean).sort()
    const creators = list.map(p => p.createdBy).filter(Boolean)

    merged.push({
      ...list[0],
      id: list[0].id,
      amount: total,
      date: dates[0] || list[0].date,
      proofUrl: proof.proofUrl || "",
      proofName: proof.proofName || "",
      notes: `Combined payment${group?.supplierName || list[0].supplierName ? ` · ${group?.supplierName || list[0].supplierName}` : ""}`,
      createdAt: list[0].createdAt,
      createdBy: proof.createdBy || creators[creators.length - 1] || list[0].createdBy,
      supplierGroupId: group?.id || list[0].supplierGroupId,
      supplierName: group?.supplierName || list[0].supplierName,
    })
  }

  return [...merged, ...passthrough]
}

/** Normalize payments against supplier groups: re-link, move overflow, combine per supplier. */
export function normalizeProjectPayments(
  payments: PurchaseLedgerPayment[],
  groups: PurchaseLedgerSupplierGroup[],
  totalAmount?: number,
): PurchaseLedgerPayment[] {
  let next = reconcilePaymentsToSupplierGroups(payments, groups)
  next = redistributePaymentOverflow(next, groups)
  next = consolidatePaymentsBySupplier(next, groups)
  if (totalAmount != null) next = clampPaymentsToTotal(next, totalAmount)
  return next
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
    const amount = Math.max(0, Number(payment.amount) || 0)
    if (amount <= 0) {
      // Keep proof-only attachment rows (amount 0 with a file).
      if (payment.proofUrl) result.push({ ...payment, amount: 0 })
      continue
    }
    if (remaining <= 0) {
      if (payment.proofUrl) result.push({ ...payment, amount: 0 })
      continue
    }
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

  const validIds = new Set(groups.map(group => group.id))
  const paidByGroup = new Map<string, number>()
  let unassigned = 0

  for (const payment of payments) {
    const amount = Math.max(0, Number(payment.amount) || 0)
    if (amount <= 0) continue
    const groupId = payment.supplierGroupId?.trim()
    if (groupId && validIds.has(groupId)) {
      paidByGroup.set(groupId, (paidByGroup.get(groupId) || 0) + amount)
    } else {
      unassigned += amount
    }
  }

  let next = groups.map((group) => {
    const subtotal = getGroupSubtotal(group)
    const fromPayments = paidByGroup.get(group.id) || 0
    const applied = Math.min(subtotal, fromPayments)
    if (fromPayments > applied) unassigned += fromPayments - applied
    return withGroupPaymentTotals(group, applied)
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

  // Carry matching payment proofs onto the group when group has none.
  return next.map((group) => {
    const synced = withSyncedLegacyAttachments(group)
    if ((synced.paymentProofAttachments?.length || 0) > 0) return synced
    const groupName = normalizeSupplierKey(group.supplierName)
    const proofs = payments
      .filter(p => {
        if (!p.proofUrl) return false
        if (p.supplierGroupId === group.id) return true
        return Boolean(groupName && normalizeSupplierKey(p.supplierName) === groupName)
      })
      .map(p => ({ url: p.proofUrl, name: p.proofName || "Payment proof" }))
    if (proofs.length === 0) return synced
    return withSyncedLegacyAttachments({
      ...synced,
      paymentProofAttachments: proofs,
    })
  })
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
    const parsedGroup = withSyncedLegacyAttachments({
      id: String(group.id ?? `group-${index}`),
      supplierId: (group.supplierId as string | null) ?? null,
      supplierName: String(group.supplierName ?? ""),
      accountDetails: String(group.accountDetails ?? ""),
      items,
      amountPaid: Number(group.amountPaid) || 0,
      amountDue: group.amountDue == null ? undefined : Number(group.amountDue) || 0,
      date: String(group.date ?? ""),
      billUrl: String(group.billUrl ?? ""),
      billName: String(group.billName ?? ""),
      billAttachments: parseJsonArray<LedgerAttachment>(group.billAttachments),
      paymentProofUrl: String(group.paymentProofUrl ?? ""),
      paymentProofName: String(group.paymentProofName ?? ""),
      paymentProofAttachments: parseJsonArray<LedgerAttachment>(group.paymentProofAttachments),
    })
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

  payments = normalizeProjectPayments(payments, supplierGroups, totalAmount)
  supplierGroups = syncSupplierGroupsToPayments(supplierGroups, payments)

  const amountPaid = Math.min(
    totalAmount,
    Math.max(Number(row.amountPaid) || 0, sumPayments(payments), sumGroupAmountPaid(supplierGroups)),
  )
  const amountDue = Math.max(0, totalAmount - amountPaid)

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
    taxPercent: Number(row.taxPercent) || 0,
    taxAmount: Number(row.taxAmount) || 0,
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

export function formatTransactionTypeLabel(type: PurchaseTransactionType | string): string {
  return PURCHASE_TRANSACTION_TYPES.find(t => t.value === type)?.label ?? type
}

export type PurchaseLedgerStats = {
  count: number
  total: number
  paid: number
  due: number
}

/** Rent rows: explicit type or legacy supplier rent lines (e.g. "Rent for Lahore Outlet"). */
export function isRentLedgerEntry(entry: PurchaseLedgerEntry): boolean {
  if (entry.transactionType === "rent") return true
  const items =
    entry.items.length > 0 ? entry.items : flattenSupplierGroupItems(entry.supplierGroups)
  return items.some(item => /^\s*rent(\s+for)?\b/i.test(item.productName.trim()))
}

export function aggregateLedgerStats(entries: PurchaseLedgerEntry[]): PurchaseLedgerStats {
  return {
    count: entries.length,
    total: entries.reduce((sum, entry) => sum + entry.totalAmount, 0),
    paid: entries.reduce((sum, entry) => sum + entry.amountPaid, 0),
    due: entries.reduce((sum, entry) => sum + entry.amountDue, 0),
  }
}

/** Build a supplier-based rent row for the purchase ledger (counts in totals like other entries). */
export function buildRentLedgerPayload(params: {
  purchaseScopeId: string
  ledgerNumber: string
  transactionDate: string
  outletName: string
  landlordSupplierId: string | null
  landlordName: string
  amount: number
  dueDate: string
  periodLabel: string
  createdBy: string
}): Omit<PurchaseLedgerEntry, "id" | "createdAt"> {
  const outlet = params.outletName.trim()
  const landlord = params.landlordName.trim() || outlet
  const period = params.periodLabel.trim()
  const itemName = period ? `Rent for ${outlet} (${period})` : `Rent for ${outlet}`
  const amount = Math.max(0, Number(params.amount) || 0)
  const group = withGroupPaymentTotals(
    newSupplierGroup({
      supplierId: params.landlordSupplierId,
      supplierName: landlord,
      items: [
        newLedgerItem({
          productName: itemName,
          quantity: 1,
          unitPrice: amount,
          lineTotal: amount,
        }),
      ],
      date: params.transactionDate,
    }),
    0,
  )

  return {
    purchaseScopeId: params.purchaseScopeId,
    ledgerNumber: params.ledgerNumber,
    transactionDate: params.transactionDate,
    linkMode: "supplier",
    projectName: outlet,
    orderId: null,
    orderNumber: "",
    supplierId: params.landlordSupplierId,
    supplierName: landlord,
    productName: itemName,
    transactionType: "rent",
    category: "expense",
    quantity: 1,
    unitPrice: amount,
    taxPercent: 0,
    taxAmount: 0,
    totalAmount: amount,
    amountPaid: 0,
    amountDue: amount,
    items: group.items,
    supplierGroups: [group],
    payments: [],
    notes: "",
    dueDate: params.dueDate,
    accountDetails: "",
    paymentProofUrl: "",
    paymentProofName: "",
    billUrl: "",
    billName: "",
    createdBy: params.createdBy,
  }
}
