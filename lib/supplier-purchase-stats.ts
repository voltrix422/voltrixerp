import type { Supplier } from "@/lib/purchase"
import type { PurchaseLedgerEntry } from "@/lib/purchase-ledger"

export type SupplierPurchaseInfo = {
  totalPurchases: number
  totalPaid: number
  totalDue: number
  entryCount: number
  purchaseRank: number
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

export function entryMatchesSupplier(entry: PurchaseLedgerEntry, supplier: Supplier): boolean {
  if (entry.supplierId && entry.supplierId === supplier.id) return true
  if (!entry.supplierName) return false
  const entryName = normalizeName(entry.supplierName)
  const supplierName = normalizeName(supplier.name)
  const companyName = normalizeName(supplier.company || "")
  return entryName === supplierName || (!!companyName && entryName === companyName)
}

export function getEntriesForSupplier(
  entries: PurchaseLedgerEntry[],
  supplier: Supplier,
): PurchaseLedgerEntry[] {
  return entries.filter(entry => entryMatchesSupplier(entry, supplier))
}

export function buildSupplierPurchaseMap(
  entries: PurchaseLedgerEntry[],
): Map<string, Omit<SupplierPurchaseInfo, "purchaseRank">> {
  const map = new Map<string, Omit<SupplierPurchaseInfo, "purchaseRank">>()

  for (const entry of entries) {
    const key = entry.supplierId || `name:${normalizeName(entry.supplierName)}`
    const prev = map.get(key) || { totalPurchases: 0, totalPaid: 0, totalDue: 0, entryCount: 0 }
    prev.totalPurchases += entry.totalAmount || 0
    prev.totalPaid += entry.amountPaid || 0
    prev.totalDue += entry.amountDue || 0
    prev.entryCount += 1
    map.set(key, prev)
  }
  return map
}

export function getSupplierPurchaseInfo(
  supplier: Supplier,
  entries: PurchaseLedgerEntry[],
): Omit<SupplierPurchaseInfo, "purchaseRank"> {
  const linked = getEntriesForSupplier(entries, supplier)
  return {
    totalPurchases: linked.reduce((s, e) => s + (e.totalAmount || 0), 0),
    totalPaid: linked.reduce((s, e) => s + (e.amountPaid || 0), 0),
    totalDue: linked.reduce((s, e) => s + (e.amountDue || 0), 0),
    entryCount: linked.length,
  }
}

export function assignSupplierPurchaseRanks(
  suppliers: Supplier[],
  entries: PurchaseLedgerEntry[],
): Map<string, SupplierPurchaseInfo> {
  const ranked = suppliers
    .map(s => ({ id: s.id, ...getSupplierPurchaseInfo(s, entries) }))
    .filter(s => s.totalPurchases > 0)
    .sort((a, b) => b.totalPurchases - a.totalPurchases)

  const result = new Map<string, SupplierPurchaseInfo>()
  for (const supplier of suppliers) {
    const stats = getSupplierPurchaseInfo(supplier, entries)
    const rankIndex = ranked.findIndex(r => r.id === supplier.id)
    result.set(supplier.id, {
      ...stats,
      purchaseRank: rankIndex >= 0 ? rankIndex + 1 : 0,
    })
  }
  return result
}

export function sortSuppliersByPurchases<T extends Supplier>(
  suppliers: T[],
  statsMap: Map<string, SupplierPurchaseInfo>,
): T[] {
  return [...suppliers].sort((a, b) => {
    const sa = statsMap.get(a.id)?.totalPurchases ?? 0
    const sb = statsMap.get(b.id)?.totalPurchases ?? 0
    if (sb !== sa) return sb - sa
    return a.name.localeCompare(b.name)
  })
}
