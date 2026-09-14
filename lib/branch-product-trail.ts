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

export function branchProductKey(...parts: Array<string | null | undefined>) {
  return productCanonicalKeyFromText(parts.filter(Boolean).join(" "))
}

export function inventoryProductKey(inv: BranchInventory) {
  return branchProductKey(
    inv.model,
    inv.productDescription,
    inv.itemName,
    inv.inventoryId?.startsWith("wh:") ? inv.inventoryId.slice(3) : inv.inventoryId,
  )
}

export function inventoryMatchesProduct(inv: BranchInventory, productKey: string) {
  if (!productKey) return true
  return inventoryProductKey(inv) === productKey
}

export function transferLineMatchesProduct(
  productDescription: string,
  productKey: string,
) {
  if (!productKey) return true
  return branchProductKey(productDescription) === productKey
}

/** Qty of a specific product inside a transfer row (batch-aware). */
export function transferEntryProductQty(
  entry: TransferHistoryDisplayEntry,
  productKey: string,
): number {
  if (!productKey) return Number(entry.quantity) || 0
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
  if (!productKey) return true
  return transferEntryProductQty(entry, productKey) > 0
}

export function collectBranchProductOptions(params: {
  inventory: BranchInventory[]
  transfers: TransferHistoryDisplayEntry[]
  posLabels?: Array<{ key: string; label: string }>
}): BranchProductOption[] {
  const map = new Map<string, string>()

  for (const inv of params.inventory) {
    const key = inventoryProductKey(inv)
    if (!key || key === "unknown") continue
    const label =
      inv.model?.trim() ||
      inv.productDescription?.trim() ||
      inv.itemName?.trim() ||
      key
    if (!map.has(key)) map.set(key, label)
  }

  for (const entry of params.transfers) {
    const lines =
      entry.lineItems.length > 0
        ? entry.lineItems
        : [{ productDescription: entry.productDescription, quantity: entry.quantity, unit: entry.unit }]
    for (const line of lines) {
      const key = branchProductKey(line.productDescription)
      if (!key || key === "unknown") continue
      if (!map.has(key)) map.set(key, line.productDescription.trim() || key)
    }
  }

  for (const pos of params.posLabels || []) {
    if (!pos.key || pos.key === "unknown") continue
    if (!map.has(pos.key)) map.set(pos.key, pos.label)
  }

  return [...map.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
}

export function inventoryOnHandForProduct(inventory: BranchInventory[], productKey: string) {
  if (!productKey) {
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
