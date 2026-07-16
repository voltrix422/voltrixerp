import { prisma } from "@/lib/db"

type SyncGroup = {
  id: string
  supplierName: string
  items: { productName?: string; lineTotal?: number }[]
  date?: string
  billUrl?: string
  billName?: string
  paymentProofUrl?: string
  paymentProofName?: string
}

type SyncEntry = {
  id: string
  purchaseScopeId: string
  ledgerNumber: string
  projectName?: string
  transactionDate: string
  linkMode?: string
  supplierName?: string
  createdBy?: string
  supplierGroups: SyncGroup[]
}

type AdvanceTxn = {
  id: string
  type: "deposit" | "expense"
  amount: number
  date: string
  description: string
  receiptUrl: string
  receiptName: string
  createdBy: string
  createdAt: string
  referenceType?: string
  referenceId?: string
  referenceNumber?: string
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function parseTransactions(raw: unknown): AdvanceTxn[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t, index) => ({
    id: String((t as AdvanceTxn).id ?? `txn-${index}`),
    type: (t as AdvanceTxn).type === "expense" ? "expense" : "deposit",
    amount: Number((t as AdvanceTxn).amount) || 0,
    date: String((t as AdvanceTxn).date ?? ""),
    description: String((t as AdvanceTxn).description ?? ""),
    receiptUrl: String((t as AdvanceTxn).receiptUrl ?? ""),
    receiptName: String((t as AdvanceTxn).receiptName ?? ""),
    createdBy: String((t as AdvanceTxn).createdBy ?? ""),
    createdAt: String((t as AdvanceTxn).createdAt ?? new Date().toISOString()),
    referenceType: String((t as AdvanceTxn).referenceType ?? "") || undefined,
    referenceId: String((t as AdvanceTxn).referenceId ?? "") || undefined,
    referenceNumber: String((t as AdvanceTxn).referenceNumber ?? "") || undefined,
  }))
}

function computeTotals(transactions: AdvanceTxn[]) {
  const totalDeposited = transactions
    .filter(t => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalSpent = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0)
  return { totalDeposited, totalSpent, balance: totalDeposited - totalSpent }
}

function groupSubtotal(group: SyncGroup) {
  return (group.items || []).reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0)
}

function itemSummary(group: SyncGroup) {
  const names = (group.items || [])
    .map(i => String(i.productName || "").trim())
    .filter(Boolean)
  if (names.length === 0) return "Purchase items"
  if (names.length === 1) return names[0]
  return `${names[0]} +${names.length - 1} more`
}

function ledgerRefPrefix(entryId: string) {
  return `pl:${entryId}:`
}

function ledgerTxnId(entryId: string, groupId: string) {
  return `pl-${entryId}-${groupId}`
}

/**
 * When a purchase ledger entry includes a supplier who has an open advance
 * account (matched by name in the same purchase scope), mirror that supplier's
 * item total as an expense on the advance — so Remaining decreases and the
 * spend shows in advance transactions.
 */
export async function syncPurchaseLedgerToAdvances(entry: SyncEntry): Promise<void> {
  const scope = String(entry.purchaseScopeId || "P1").trim().toUpperCase()
  const groups: SyncGroup[] = (entry.supplierGroups || []).filter(g => (g.supplierName || "").trim())
  if (groups.length === 0 && entry.supplierName?.trim()) {
    groups.push({
      id: "primary",
      supplierName: entry.supplierName,
      items: [{ productName: "Purchase", lineTotal: 0 }],
    })
  }
  if (groups.length === 0) {
    await removePurchaseLedgerFromAdvances(entry.id, scope)
    return
  }

  const advances = await prisma.erpAdvanceAccount.findMany({
    where: { purchaseScopeId: scope, status: "open" },
  })
  if (advances.length === 0) {
    await removePurchaseLedgerFromAdvances(entry.id, scope)
    return
  }

  const byName = new Map<string, typeof advances[0]>()
  for (const account of advances) {
    const key = normalizeName(account.personName)
    if (key && !byName.has(key)) byName.set(key, account)
  }

  const desiredByAdvance = new Map<string, AdvanceTxn[]>()
  const prefix = ledgerRefPrefix(entry.id)
  const projectBit = entry.projectName?.trim() ? ` · ${entry.projectName.trim()}` : ""

  for (const group of groups) {
    const amount = groupSubtotal(group)
    if (amount <= 0.004) continue
    const account = byName.get(normalizeName(group.supplierName))
    if (!account) continue

    const receiptUrl = group.paymentProofUrl || group.billUrl || ""
    const receiptName = group.paymentProofName || group.billName || ""
    const txn: AdvanceTxn = {
      id: ledgerTxnId(entry.id, group.id),
      type: "expense",
      amount,
      date: group.date || entry.transactionDate || new Date().toISOString().slice(0, 10),
      description: `Purchase ${entry.ledgerNumber}${projectBit} · ${itemSummary(group)}`,
      receiptUrl,
      receiptName,
      createdBy: entry.createdBy || "",
      createdAt: new Date().toISOString(),
      referenceType: "purchase_ledger",
      referenceId: `${prefix}${group.id}`,
      referenceNumber: entry.ledgerNumber,
    }
    const list = desiredByAdvance.get(account.id) || []
    list.push(txn)
    desiredByAdvance.set(account.id, list)
  }

  // Update every advance in scope that either needs new txns or still has old ones for this entry.
  const accountsToTouch = new Set<string>([
    ...desiredByAdvance.keys(),
    ...advances
      .filter(a => parseTransactions(a.transactions).some(t =>
        t.referenceType === "purchase_ledger" && String(t.referenceId || "").startsWith(prefix),
      ))
      .map(a => a.id),
  ])

  for (const accountId of accountsToTouch) {
    const account = advances.find(a => a.id === accountId)
    if (!account) continue
    const existing = parseTransactions(account.transactions)
    const withoutOld = existing.filter(t =>
      !(t.referenceType === "purchase_ledger" && String(t.referenceId || "").startsWith(prefix)),
    )
    const desired = desiredByAdvance.get(accountId) || []
    // Preserve createdAt if we are updating the same txn id
    const mergedDesired = desired.map(txn => {
      const prev = existing.find(t => t.id === txn.id)
      return prev ? { ...txn, createdAt: prev.createdAt || txn.createdAt } : txn
    })
    const next = [...withoutOld, ...mergedDesired]
    await prisma.erpAdvanceAccount.update({
      where: { id: accountId },
      data: { transactions: next, ...computeTotals(next) },
    })
  }
}

/** Remove all advance expenses linked to a purchase ledger entry. */
export async function removePurchaseLedgerFromAdvances(
  entryId: string,
  purchaseScopeId?: string,
): Promise<void> {
  const scope = purchaseScopeId ? String(purchaseScopeId).trim().toUpperCase() : ""
  const advances = await prisma.erpAdvanceAccount.findMany({
    where: scope ? { purchaseScopeId: scope } : undefined,
  })
  const prefix = ledgerRefPrefix(entryId)
  for (const account of advances) {
    const existing = parseTransactions(account.transactions)
    const next = existing.filter(t =>
      !(t.referenceType === "purchase_ledger" && String(t.referenceId || "").startsWith(prefix)),
    )
    if (next.length === existing.length) continue
    await prisma.erpAdvanceAccount.update({
      where: { id: account.id },
      data: { transactions: next, ...computeTotals(next) },
    })
  }
}
