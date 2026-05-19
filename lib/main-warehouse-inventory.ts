import { serialNumberKey, type InventorySerialUnit } from "@/lib/inventory-serial-units"

export type MainWarehouseStockRow = {
  id: string
  description: string
  name?: string
  unit?: string
  availableQty?: number
}

export type MainWarehouseItem = {
  id: string
  model: string
  productDescription: string
  itemName: string
  specs: string
  quantity: number
  inStock: number
  totalUnits: number
  unit: string
  inventoryStockId: string | null
}

export function buildModelLabelMap(
  labels: Array<{ model: string; displayName: string }>,
  units: InventorySerialUnit[],
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const label of labels) {
    if (label.model && label.displayName) map[label.model] = label.displayName
  }
  for (const unit of units) {
    const m = unit.model?.trim()
    if (!m || map[m]) continue
    const name = unit.productName?.trim()
    if (name && name !== m) map[m] = name
  }
  return map
}

function dedupeSerialUnits(units: InventorySerialUnit[]): InventorySerialUnit[] {
  const byKey = new Map<string, InventorySerialUnit>()
  for (const unit of units) {
    const key = serialNumberKey(unit.serialNumber)
    if (!key) continue
    if (!byKey.has(key)) byKey.set(key, unit)
  }
  return Array.from(byKey.values())
}

function resolveStockId(
  model: string,
  modelUnits: InventorySerialUnit[],
  stockRows: MainWarehouseStockRow[],
): string | null {
  const fromUnit = modelUnits.find((u) => u.inventoryStockId)?.inventoryStockId
  if (fromUnit) return fromUnit

  const m = model.toLowerCase()
  const stock = stockRows.find(
    (s) =>
      s.description?.toLowerCase() === m ||
      s.name?.toLowerCase() === m ||
      s.description?.toLowerCase().includes(m) ||
      m.includes(s.description?.toLowerCase() ?? ""),
  )
  return stock?.id ?? null
}

/** Group scanned serial units by model — same source as Inventory tab. */
export function buildMainWarehouseItems(
  units: InventorySerialUnit[],
  labelMap: Record<string, string> = {},
  stockRows: MainWarehouseStockRow[] = [],
): MainWarehouseItem[] {
  const unique = dedupeSerialUnits(units)
  const byModel = new Map<string, InventorySerialUnit[]>()

  for (const unit of unique) {
    const key = unit.model?.trim() || "Unknown model"
    const list = byModel.get(key) ?? []
    list.push(unit)
    byModel.set(key, list)
  }

  return Array.from(byModel.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([model, modelUnits]) => {
      const inStock = modelUnits.filter((u) => u.status === "in_stock").length
      const displayName =
        labelMap[model]?.trim() ||
        modelUnits.find((u) => u.productName?.trim() && u.productName.trim() !== model)?.productName?.trim() ||
        model
      const specs = modelUnits.find((u) => u.specs?.trim())?.specs?.trim() || ""

      return {
        id: `wh:${model}`,
        model,
        productDescription: displayName !== model ? `${displayName} · ${model}` : model,
        itemName: displayName,
        specs,
        quantity: inStock,
        inStock,
        totalUnits: modelUnits.length,
        unit: "pcs",
        inventoryStockId: resolveStockId(model, modelUnits, stockRows),
      }
    })
}
