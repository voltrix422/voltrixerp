import type { InventoryTransaction } from "@/lib/inventory-history"

export type StockSnapshot = {
  stock_before: number | null
  stock_after: number | null
  location_label: string
}

export function parseBranchTransferFromNote(notes?: string | null): {
  fromName: string
  fromCode: string
  toName: string
  toCode: string
} | null {
  if (!notes) return null
  const match = notes.match(
    /from\s+(.+?)\s*\(([^)]+)\)\s+to\s+(.+?)\s*\(([^)]+)\)/i,
  )
  if (!match) return null
  return {
    fromName: match[1].trim(),
    fromCode: match[2].trim(),
    toName: match[3].trim(),
    toCode: match[4].trim(),
  }
}

function normalizeItemKey(item: string) {
  return item.trim().toLowerCase()
}

function movementDelta(tx: Pick<InventoryTransaction, "transaction_type" | "quantity">): number {
  const qty = Math.abs(Number(tx.quantity) || 0)
  if (tx.transaction_type === "in") return qty
  return -qty
}

function stockLocationKey(
  tx: Pick<
    InventoryTransaction,
    "item_description" | "transaction_type" | "reference_type" | "reference_id" | "notes"
  >,
): string {
  const item = normalizeItemKey(tx.item_description)
  if (
    tx.reference_type === "branch" &&
    (tx.transaction_type === "branch_transfer" || tx.transaction_type === "assigned_to_branch")
  ) {
    if (tx.transaction_type === "branch_transfer" && tx.reference_id) {
      return `${item}::branch::${tx.reference_id}`
    }
    return `${item}::main`
  }
  return `${item}::main`
}

export function resolveStockLocationLabel(
  tx: Pick<
    InventoryTransaction,
    "transaction_type" | "reference_type" | "reference_id" | "reference_number" | "notes"
  >,
  stored?: string | null,
): string {
  if (stored?.trim()) return stored.trim()

  const parsed = parseBranchTransferFromNote(tx.notes)
  if (parsed) {
    if (tx.transaction_type === "branch_transfer") {
      return `${parsed.fromName} (${parsed.fromCode})`
    }
    if (tx.transaction_type === "assigned_to_branch") {
      return "Main Warehouse"
    }
  }

  if (tx.reference_type === "branch") {
    return `Branch ${tx.reference_number || "—"}`
  }

  return "Main Warehouse"
}

type HistoryWithStock = InventoryTransaction & {
  stock_before?: number | null
  stock_after?: number | null
  location_label?: string | null
}

export function computeStockSnapshots(
  allTransactions: HistoryWithStock[],
): Map<string, StockSnapshot> {
  const sorted = [...allTransactions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const ledger = new Map<string, number>()
  const snapshots = new Map<string, StockSnapshot>()

  for (const tx of sorted) {
    const key = stockLocationKey(tx)
    const locationLabel = resolveStockLocationLabel(tx, tx.location_label)
    const delta = movementDelta(tx)

    if (tx.stock_before != null && tx.stock_after != null) {
      snapshots.set(tx.id, {
        stock_before: tx.stock_before,
        stock_after: tx.stock_after,
        location_label: locationLabel,
      })
      ledger.set(key, tx.stock_after)
      continue
    }

    const before = ledger.get(key) ?? 0
    const after = before + delta
    ledger.set(key, after)

    snapshots.set(tx.id, {
      stock_before: before,
      stock_after: after,
      location_label: locationLabel,
    })
  }

  return snapshots
}

export function attachStockSnapshots<T extends HistoryWithStock>(
  visible: T[],
  allForItems: T[],
): Array<T & StockSnapshot> {
  const snapshots = computeStockSnapshots(allForItems)
  return visible.map((tx) => {
    const snap = snapshots.get(tx.id)
    return {
      ...tx,
      stock_before: snap?.stock_before ?? null,
      stock_after: snap?.stock_after ?? null,
      location_label: snap?.location_label ?? resolveStockLocationLabel(tx, tx.location_label),
    }
  })
}

export function formatStockRange(
  before: number | null | undefined,
  after: number | null | undefined,
  unit?: string,
): string {
  if (before == null || after == null) return "—"
  const u = unit ? ` ${unit}` : ""
  return `${before}${u} → ${after}${u}`
}
