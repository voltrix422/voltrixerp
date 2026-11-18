import type { InventorySerialUnit } from "@/lib/inventory-serial-units"
import type { ManualInventoryItem } from "@/lib/manual-inventory"

export type StockOnlyMeta = {
  inStock: number
  total: number
  faultyQty?: number
  unit: string
  isManual: boolean
  manualId?: string
  stockId?: string
}

export type UnifiedInventoryModelGroup = {
  modelKey: string
  displayName: string
  units: InventorySerialUnit[]
  stockOnly?: StockOnlyMeta
}

type StockRow = {
  id?: string
  description?: string | null
  name?: string | null
  availableQty?: number | null
  receivedQty?: number | null
  faultyQty?: number | null
  unit?: string | null
  poType?: string | null
}

function modelKey(value: string): string {
  return value.trim() || "Unknown model"
}

/** Merge serial units, manual inventory, and stock rows into one list per model. */
export function buildUnifiedInventoryGroups(
  units: InventorySerialUnit[],
  manualItems: ManualInventoryItem[],
  stockRows: StockRow[],
  labelMap: Record<string, string> = {},
): UnifiedInventoryModelGroup[] {
  const groups = new Map<string, UnifiedInventoryModelGroup>()

  for (const unit of units) {
    const key = modelKey(unit.model || "")
    const existing = groups.get(key)
    if (existing) {
      existing.units.push(unit)
    } else {
      groups.set(key, {
        modelKey: key,
        displayName: labelMap[key] || unit.productName?.trim() || key,
        units: [unit],
      })
    }
  }

  for (const manual of manualItems) {
    const key = modelKey(manual.model)
    const existing = groups.get(key)
    const displayName = manual.name?.trim() || labelMap[key] || key

    if (!existing) {
      groups.set(key, {
        modelKey: key,
        displayName,
        units: [],
        stockOnly: {
          inStock: manual.availableQty ?? 0,
          total: manual.qty ?? 0,
          faultyQty: Number(manual.faultyQty) || 0,
          unit: manual.unit || "pcs",
          isManual: true,
          manualId: manual.id,
          stockId: manual.inventoryStockId ?? undefined,
        },
      })
      continue
    }

    existing.displayName = displayName
    // Always keep Manual qty as stockOnly — SN units are tracking only and must not hide Manual counts.
    existing.stockOnly = {
      inStock: manual.availableQty ?? 0,
      total: manual.qty ?? 0,
      faultyQty: Number(manual.faultyQty) || 0,
      unit: manual.unit || "pcs",
      isManual: true,
      manualId: manual.id,
      stockId: manual.inventoryStockId ?? undefined,
    }
  }

  for (const stock of stockRows) {
    const key = modelKey(stock.description || stock.name || "")
    if (!key || key === "Unknown model") continue
    if (groups.has(key)) continue
    if (stock.poType === "manual") continue

    const inStock = Math.max(0, Number(stock.availableQty) || 0)
    const total = Math.max(inStock, Number(stock.receivedQty) || 0)
    if (inStock <= 0 && total <= 0) continue

    groups.set(key, {
      modelKey: key,
      displayName: labelMap[key] || stock.name?.trim() || key,
      units: [],
      stockOnly: {
        inStock,
        total,
        faultyQty: Math.max(0, Number(stock.faultyQty) || 0),
        unit: stock.unit?.trim() || "pcs",
        isManual: false,
        stockId: stock.id,
      },
    })
  }

  return mergeAliasGroupsIntoManual(Array.from(groups.values())).sort((a, b) =>
    a.modelKey.localeCompare(b.modelKey),
  )
}

/** Fold SN/stock alias rows (e.g. HSLD15KW) into the Manual group with the same product name. */
function mergeAliasGroupsIntoManual(
  groups: UnifiedInventoryModelGroup[],
): UnifiedInventoryModelGroup[] {
  const byKey = new Map(groups.map((g) => [g.modelKey, g]))
  const manualByName = new Map<string, UnifiedInventoryModelGroup>()
  for (const g of groups) {
    if (!g.stockOnly?.isManual) continue
    const name = g.displayName.trim().toLowerCase()
    if (name) manualByName.set(name, g)
  }

  const drop = new Set<string>()
  for (const g of groups) {
    if (g.stockOnly?.isManual) continue
    const name = g.displayName.trim().toLowerCase()
    const manual = name ? manualByName.get(name) : undefined
    if (!manual || manual.modelKey === g.modelKey) continue

    manual.units.push(...g.units)
    // Keep Manual qty; only absorb SN units for tracking.
    drop.add(g.modelKey)
  }

  if (drop.size === 0) return groups
  return [...byKey.values()].filter((g) => !drop.has(g.modelKey))
}

export function unifiedGroupFaulty(group: UnifiedInventoryModelGroup): number {
  const serialFaulty = group.units.filter((u) => u.status === "faulty").length
  if (serialFaulty > 0) return serialFaulty
  return group.stockOnly?.faultyQty ?? 0
}

export function unifiedGroupInStock(group: UnifiedInventoryModelGroup): number {
  const serialInStock = group.units.filter((u) => u.status === "in_stock").length
  // Manual / stock row is the warehouse quantity source of truth when present.
  if (group.stockOnly) {
    return Math.max(group.stockOnly.inStock, serialInStock)
  }
  return serialInStock
}

export function unifiedGroupTotal(group: UnifiedInventoryModelGroup): number {
  const serialTotal = group.units.length
  if (group.stockOnly) {
    return Math.max(group.stockOnly.total, serialTotal, unifiedGroupInStock(group))
  }
  return serialTotal
}

export function filterUnifiedGroups(
  groups: UnifiedInventoryModelGroup[],
  query: string,
): UnifiedInventoryModelGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups

  return groups.filter((group) => {
    if (group.modelKey.toLowerCase().includes(q)) return true
    if (group.displayName.toLowerCase().includes(q)) return true
    return group.units.some(
      (u) =>
        u.serialNumber.toLowerCase().includes(q) ||
        (u.productName || "").toLowerCase().includes(q) ||
        (u.notes || "").toLowerCase().includes(q),
    )
  })
}
