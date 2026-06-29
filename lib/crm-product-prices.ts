export type CrmPriceTier = "retail" | "wholesale" | "dealership"

export type CrmProductPrice = {
  id: string
  model: string
  displayName: string
  retailPrice: number
  wholesalePrice: number
  dealershipPrice: number
  updatedBy: string
  updatedAt: string
}

export const CRM_PRICE_TIER_LABELS: Record<CrmPriceTier, string> = {
  retail: "Retail",
  wholesale: "Wholesale",
  dealership: "Dealership",
}

function mapRow(row: Record<string, unknown>): CrmProductPrice {
  return {
    id: String(row.id ?? ""),
    model: String(row.model ?? ""),
    displayName: String(row.displayName ?? ""),
    retailPrice: Number(row.retailPrice ?? 0),
    wholesalePrice: Number(row.wholesalePrice ?? 0),
    dealershipPrice: Number(row.dealershipPrice ?? 0),
    updatedBy: String(row.updatedBy ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
  }
}

export async function getCrmProductPrices(): Promise<CrmProductPrice[]> {
  const res = await fetch("/api/db/crm-product-prices", { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load product prices")
  const data = await res.json()
  return (Array.isArray(data) ? data : []).map(mapRow)
}

export async function saveCrmProductPrice(payload: {
  model: string
  displayName?: string
  retailPrice: number
  wholesalePrice: number
  dealershipPrice: number
  updatedBy?: string
}): Promise<CrmProductPrice> {
  const res = await fetch("/api/db/crm-product-prices", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || "Failed to save product price")
  }
  return mapRow(await res.json())
}

export function buildCrmPriceMap(rows: CrmProductPrice[]): Map<string, CrmProductPrice> {
  const map = new Map<string, CrmProductPrice>()
  for (const row of rows) {
    const key = row.model.trim().toLowerCase()
    if (key) map.set(key, row)
  }
  return map
}

export function unitPriceForTier(
  row: CrmProductPrice | undefined,
  tier: CrmPriceTier,
): number {
  if (!row) return 0
  switch (tier) {
    case "wholesale":
      return row.wholesalePrice
    case "dealership":
      return row.dealershipPrice
    default:
      return row.retailPrice
  }
}

export function lookupCrmUnitPrice(
  priceMap: Map<string, CrmProductPrice>,
  model: string | undefined | null,
  tier: CrmPriceTier,
): number {
  if (!model?.trim()) return 0
  return unitPriceForTier(priceMap.get(model.trim().toLowerCase()), tier)
}

export function applyCrmPriceTierToItems<T extends { model?: string; unitPrice: number }>(
  items: T[],
  tier: CrmPriceTier,
  priceMap: Map<string, CrmProductPrice>,
): T[] {
  return items.map((item) => {
    if (!item.model?.trim()) return item
    return {
      ...item,
      unitPrice: lookupCrmUnitPrice(priceMap, item.model, tier),
    }
  })
}
