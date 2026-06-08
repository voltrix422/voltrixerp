import { getInventorySerialUnits } from "@/lib/inventory-serial-units"
import { getInventoryModelLabels } from "@/lib/inventory-model-labels"
import { getManualInventoryItems } from "@/lib/manual-inventory"
import {
  buildUnifiedInventoryGroups,
  unifiedGroupInStock,
  type UnifiedInventoryModelGroup,
} from "@/lib/unified-inventory-groups"

export type InventoryProductOption = {
  modelKey: string
  displayName: string
  inStock: number
  unit: string
}

function unitForGroup(group: UnifiedInventoryModelGroup): string {
  return group.stockOnly?.unit || "pcs"
}

export async function loadInventoryProductOptions(): Promise<InventoryProductOption[]> {
  const [units, labels, manualItems, stockRes] = await Promise.all([
    getInventorySerialUnits().catch(() => []),
    getInventoryModelLabels().catch(() => []),
    getManualInventoryItems().catch(() => []),
    fetch("/api/db/inventory-stock", { cache: "no-store" }).catch(() => null),
  ])

  const stockRows = stockRes?.ok ? await stockRes.json() : []
  const labelMap: Record<string, string> = {}
  for (const label of labels) {
    if (label.model && label.displayName) labelMap[label.model] = label.displayName
  }

  const groups = buildUnifiedInventoryGroups(units, manualItems, stockRows, labelMap)

  return groups
    .map((group) => ({
      modelKey: group.modelKey,
      displayName: group.displayName || group.modelKey,
      inStock: unifiedGroupInStock(group),
      unit: unitForGroup(group),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}
