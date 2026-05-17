import { getInventoryModelLabels } from "@/lib/inventory-model-labels"
import { getInventorySerialUnits, type InventorySerialUnit } from "@/lib/inventory-serial-units"

export type CrmWarehouseProduct = {
  id: string
  model: string
  displayName: string
  description: string
  qty: number
  unit: string
}

export function warehouseProductId(model: string) {
  return `wh:${model}`
}

export function buildCrmWarehouseProducts(
  units: InventorySerialUnit[],
  labelMap: Record<string, string> = {},
): CrmWarehouseProduct[] {
  const byModel = new Map<string, { count: number; productName: string }>()
  for (const unit of units) {
    if (unit.status !== "in_stock") continue
    const model = unit.model?.trim() || "Unknown model"
    const cur = byModel.get(model) ?? { count: 0, productName: "" }
    cur.count += 1
    const name = unit.productName?.trim()
    if (name && name !== model) cur.productName = name
    byModel.set(model, cur)
  }

  return Array.from(byModel.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([model, { count, productName }]) => {
      const displayName = labelMap[model]?.trim() || productName || model
      const description =
        displayName !== model ? `${displayName} · ${model}` : model
      return {
        id: warehouseProductId(model),
        model,
        displayName,
        description,
        qty: count,
        unit: "pc",
      }
    })
}

export async function loadCrmWarehouseProducts(): Promise<CrmWarehouseProduct[]> {
  const [units, labels] = await Promise.all([
    getInventorySerialUnits(),
    getInventoryModelLabels().catch(() => []),
  ])
  const labelMap: Record<string, string> = {}
  for (const label of labels) {
    if (label.model && label.displayName) labelMap[label.model] = label.displayName
  }
  for (const unit of units) {
    const m = unit.model?.trim()
    if (!m || labelMap[m]) continue
    const name = unit.productName?.trim()
    if (name && name !== m) labelMap[m] = name
  }
  return buildCrmWarehouseProducts(units, labelMap)
}
