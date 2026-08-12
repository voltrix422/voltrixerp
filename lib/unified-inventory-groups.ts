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
    if (existing.units.length === 0) {
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

  return Array.from(groups.values()).sort((a, b) => a.modelKey.localeCompare(b.modelKey))
}

export function unifiedGroupFaulty(group: UnifiedInventoryModelGroup): number {
  const serialFaulty = group.units.filter((u) => u.status === "faulty").length
  if (serialFaulty > 0) return serialFaulty
  return group.stockOnly?.faultyQty ?? 0
}

export function unifiedGroupInStock(group: UnifiedInventoryModelGroup): number {
  if (group.units.length > 0) {
    return group.units.filter((u) => u.status === "in_stock").length
  }
  return group.stockOnly?.inStock ?? 0
}

export function unifiedGroupTotal(group: UnifiedInventoryModelGroup): number {
  if (group.units.length > 0) return group.units.length
  return group.stockOnly?.total ?? 0
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
