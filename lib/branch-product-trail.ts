import type { BranchInventory } from "@/lib/branches"
import type { TransferHistoryDisplayEntry } from "@/lib/branch-transfer-history-display"
import {
  normalizeProductText,
  productCanonicalKeyFromText,
} from "@/lib/order-product-search"

export type BranchProductOption = {
  key: string
  label: string
}

/** Prefer a single model/description field — never join several fields (that splits one SKU into many keys). */
export function branchProductKey(...parts: Array<string | null | undefined>) {
  for (const part of parts) {
    const trimmed = String(part || "").trim()
    if (!trimmed) continue
    const key = productCanonicalKeyFromText(trimmed)
    if (key && key !== "unknown") return key
  }
  return "unknown"
}

/**
 * Model codes are sometimes truncated in transfer notes (e.g. …-INVE vs …-INVERTER).
 * Treat equal keys, or one as a prefix of the other (shared stem), as the same product.
 */
export function productKeysMatch(a: string, b: string): boolean {
  if (!a || !b || a === "unknown" || b === "unknown") return false
  if (a === b) return true
  const minStem = 16
  if (a.length >= minStem && b.length >= minStem && (a.startsWith(b) || b.startsWith(a))) {
    return true
  }
  return false
}

export function inventoryProductKey(inv: BranchInventory) {
  return branchProductKey(
    inv.model,
    inv.productDescription,
    inv.itemName,
    inv.inventoryId?.startsWith("wh:")
      ? inv.inventoryId.slice(3)
      : inv.inventoryId?.startsWith("man:")
        ? inv.inventoryId.slice(4)
        : inv.inventoryId?.startsWith("MAN-")
          ? inv.inventoryId
          : undefined,
  )
}

function productFilterKey(productKey: string) {
  return Boolean(productKey && productKey !== "unknown")
}

export function inventoryMatchesProduct(inv: BranchInventory, productKey: string) {
  if (!productFilterKey(productKey)) return true
  return productKeysMatch(inventoryProductKey(inv), productKey)
}

export function transferLineMatchesProduct(
  productDescription: string,
  productKey: string,
) {
  if (!productFilterKey(productKey)) return true
  return productKeysMatch(branchProductKey(productDescription), productKey)
}

/** Qty of a specific product inside a transfer row (batch-aware). */
export function transferEntryProductQty(
  entry: TransferHistoryDisplayEntry,
  productKey: string,
): number {
  if (!productFilterKey(productKey)) return Number(entry.quantity) || 0
  if (entry.lineItems.length > 0) {
    return entry.lineItems
      .filter((line) => transferLineMatchesProduct(line.productDescription, productKey))
      .reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
  }
  return transferLineMatchesProduct(entry.productDescription, productKey)
    ? Number(entry.quantity) || 0
    : 0
}

export function transferEntryTouchesProduct(
  entry: TransferHistoryDisplayEntry,
  productKey: string,
) {
  if (!productFilterKey(productKey)) return true
  return transferEntryProductQty(entry, productKey) > 0
}

function preferLabel(current: string | undefined, next: string) {
  const a = (current || "").trim()
  const b = next.trim()
  if (!a) return b
  if (!b) return a
  // Prefer the longer label (usually the untruncated model / full name).
  return b.length > a.length ? b : a
}

function mergeIntoKeyMap(map: Map<string, string>, key: string, label: string) {
  if (!key || key === "unknown") return
  for (const existing of map.keys()) {
    if (!productKeysMatch(existing, key)) continue
    const keepKey = key.length > existing.length ? key : existing
    const dropKey = keepKey === key ? existing : key
    const mergedLabel = preferLabel(map.get(existing), label)
    if (dropKey !== keepKey) {
      map.delete(dropKey)
    }
    map.set(keepKey, preferLabel(map.get(keepKey), mergedLabel))
    return
  }
  map.set(key, preferLabel(undefined, label))
}

export function collectBranchProductOptions(params: {
  inventory: BranchInventory[]
  transfers: TransferHistoryDisplayEntry[]
  posLabels?: Array<{ key: string; label: string }>
}): BranchProductOption[] {
  const map = new Map<string, string>()

  for (const inv of params.inventory) {
    const key = inventoryProductKey(inv)
    const label =
      inv.model?.trim() ||
      inv.productDescription?.trim() ||
      inv.itemName?.trim() ||
      key
    mergeIntoKeyMap(map, key, label)
  }

  for (const entry of params.transfers) {
    const lines =
      entry.lineItems.length > 0
        ? entry.lineItems
        : [{ productDescription: entry.productDescription, quantity: entry.quantity, unit: entry.unit }]
    for (const line of lines) {
      const key = branchProductKey(line.productDescription)
      mergeIntoKeyMap(map, key, line.productDescription.trim() || key)
    }
  }

  for (const pos of params.posLabels || []) {
    mergeIntoKeyMap(map, pos.key, pos.label)
  }

  return [...map.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
}

export function inventoryOnHandForProduct(inventory: BranchInventory[], productKey: string) {
  if (!productFilterKey(productKey)) {
    return inventory.reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0)
  }
  return inventory
    .filter((inv) => inventoryMatchesProduct(inv, productKey))
    .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0)
}

export function productSearchHit(text: string, query: string) {
  const q = normalizeProductText(query)
  if (!q) return true
  return normalizeProductText(text).includes(q)
}
