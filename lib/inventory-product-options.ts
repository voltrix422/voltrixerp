import { getInventorySerialUnits } from "@/lib/inventory-serial-units"
import { getInventoryModelLabels } from "@/lib/inventory-model-labels"
import { getManualInventoryItems } from "@/lib/manual-inventory"
import {
  buildUnifiedInventoryGroups,
  unifiedGroupInStock,
  type UnifiedInventoryModelGroup,
} from "@/lib/unified-inventory-groups"
import { normalizeProductText } from "@/lib/order-product-search"

export type InventoryProductOption = {
  /** Stable value for dropdown selection */
  id: string
  modelKey: string
  displayName: string
  inStock: number
  unit: string
  /** All model codes / names that should match this product in orders */
  matchTerms: string[]
}

function unitForGroup(group: UnifiedInventoryModelGroup): string {
  return group.stockOnly?.unit || "pcs"
}

function collectMatchTerms(
  group: UnifiedInventoryModelGroup,
  labelMap: Record<string, string>,
): string[] {
  const terms = new Set<string>()
  const add = (value?: string | null) => {
    const trimmed = value?.trim()
    if (trimmed) terms.add(trimmed)
  }

  add(group.modelKey)
  add(group.displayName)
  add(labelMap[group.modelKey])

  for (const unit of group.units) {
    add(unit.model)
    add(unit.productName)
    add(unit.assignedName)
  }

  if (group.stockOnly?.manualId) {
    add(group.stockOnly.manualId)
    add(`man:${group.stockOnly.manualId}`)
  }

  return [...terms]
}

function mergeKeyForGroup(group: UnifiedInventoryModelGroup): string {
  return normalizeProductText(group.displayName || group.modelKey)
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
  for (const manual of manualItems) {
    if (manual.model && manual.name) labelMap[manual.model] = manual.name
  }

  const groups = buildUnifiedInventoryGroups(units, manualItems, stockRows, labelMap)
  const merged = new Map<string, InventoryProductOption>()

  for (const group of groups) {
    const key = mergeKeyForGroup(group)
    const terms = collectMatchTerms(group, labelMap)
    const existing = merged.get(key)

    if (existing) {
      existing.inStock += unifiedGroupInStock(group)
      existing.matchTerms = [...new Set([...existing.matchTerms, ...terms])]
      if (!existing.modelKey && group.modelKey) existing.modelKey = group.modelKey
      continue
    }

    merged.set(key, {
      id: key,
      modelKey: group.modelKey,
      displayName: group.displayName || group.modelKey,
      inStock: unifiedGroupInStock(group),
      unit: unitForGroup(group),
      matchTerms: terms,
    })
  }

  // Link groups that share any model code or label alias (e.g. HSLD15KW ↔ 15.6 KWh Battery Storage)
  const options = [...merged.values()]
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const a = options[i]
      const b = options[j]
      const aTerms = new Set(a.matchTerms.map(normalizeProductText))
      const shared = b.matchTerms.some((term) => aTerms.has(normalizeProductText(term)))
      if (!shared) continue

      const mergedTerms = [...new Set([...a.matchTerms, ...b.matchTerms])]
      const mergedOption: InventoryProductOption = {
        id: a.id,
        modelKey: a.modelKey || b.modelKey,
        displayName: a.displayName.length >= b.displayName.length ? a.displayName : b.displayName,
        inStock: a.inStock + b.inStock,
        unit: a.unit || b.unit,
        matchTerms: mergedTerms,
      }
      options[i] = mergedOption
      options.splice(j, 1)
      merged.delete(b.id)
      j--
    }
  }

  return options.sort((a, b) => a.displayName.localeCompare(b.displayName))
}
