import { isInverterCategory, getMainCategory } from "@/lib/product-categories"

export type CatalogProduct = {
  id?: string
  name?: string
  model?: string
  category?: string
  description?: string
  full_desc?: string
  specification?: string
  specs?: { label?: string; value?: string }[]
  price?: number | string | null
  stock?: string | number
  published?: boolean | string
  images?: string[]
  image?: string
}

function productText(p: CatalogProduct): string {
  const specText = (p.specs || [])
    .map((s) => `${s.label || ""} ${s.value || ""}`)
    .join(" ")
  return [
    p.name,
    p.model,
    p.category,
    p.description,
    p.full_desc,
    p.specification,
    specText,
  ]
    .filter(Boolean)
    .join(" ")
}

export function parseKwFromText(text: string): number | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*k\s*w(?:\s|$|[^h])/i,
    /(\d+(?:\.\d+)?)\s*kw\b/i,
    /(\d+(?:\.\d+)?)\s*kilowatt/i,
  ]
  let best: number | null = null
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const n = Number(m[1])
      if (n >= 1 && n <= 500) best = best ? Math.max(best, n) : n
    }
  }
  return best
}

export function parseKwhFromText(text: string): number | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*k\s*w\s*h/i,
    /(\d+(?:\.\d+)?)\s*kwh/i,
  ]
  let best: number | null = null
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const n = Number(m[1])
      if (n >= 1 && n <= 500) best = best ? Math.max(best, n) : n
    }
  }
  return best
}

export function parseWattageFromText(text: string): number | null {
  const patterns = [
    /(\d{3,4})\s*w(?:att)?s?\b/i,
    /(\d{3,4})w\b/i,
    /longi\s*(\d{3,4})/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const n = Number(m[1])
      if (n >= 300 && n <= 800) return n
    }
  }
  return null
}

export function isSolarPanelProduct(p: CatalogProduct): boolean {
  const text = productText(p).toLowerCase()
  if (/solar\s*panel|mono\s*perc|bifacial|longi|jinko|trina|canadian\s*solar/.test(text)) {
    return true
  }
  const w = parseWattageFromText(text)
  return Boolean(w && /panel|module|pv/.test(text))
}

export function isBifacialPanelProduct(p: CatalogProduct): boolean {
  const text = productText(p).toLowerCase()
  return /bifacial|bi[- ]?facial/.test(text)
}

export function isFusionComboProduct(p: CatalogProduct): boolean {
  if (String(p.category || "") === "Voltrix Fusion") return true
  const text = productText(p).toLowerCase()
  const hasInv = /inverter/.test(text) && parseKwFromText(text) !== null
  const hasBat = /battery/.test(text) && parseKwhFromText(text) !== null
  return hasInv && hasBat
}

export function isInverterProduct(p: CatalogProduct): boolean {
  const cat = String(p.category || "")
  if (isInverterCategory(cat)) return true
  const text = productText(p).toLowerCase()
  return /inverter|hybrid|on[- ]?grid|off[- ]?grid/.test(text) && parseKwFromText(text) !== null
}

export function isStandaloneInverterProduct(p: CatalogProduct): boolean {
  return isInverterProduct(p) && !isFusionComboProduct(p)
}

export function isBatteryProduct(p: CatalogProduct): boolean {
  const main = getMainCategory(String(p.category || ""))
  if (main === "Energy Storage Battery") return true
  const text = productText(p).toLowerCase()
  return /battery|bess|lifepo|energy\s*storage/.test(text) && parseKwhFromText(text) !== null
}

export function isStandaloneBatteryProduct(p: CatalogProduct): boolean {
  return isBatteryProduct(p) && !isFusionComboProduct(p)
}

export function fusionMeetsBackup(p: CatalogProduct, backupKwh: number): boolean {
  if (!isFusionComboProduct(p)) return false
  const kwh = getProductKwh(p)
  return kwh !== null && kwh >= backupKwh * 0.85
}

export function getProductKw(p: CatalogProduct): number | null {
  return parseKwFromText(productText(p))
}

export function getProductKwh(p: CatalogProduct): number | null {
  return parseKwhFromText(productText(p))
}

export function getProductWattage(p: CatalogProduct): number | null {
  return parseWattageFromText(productText(p))
}

export function isInStock(p: CatalogProduct): boolean {
  const s = p.stock
  if (s === "in" || s === "low") return true
  if (typeof s === "number") return s > 0
  return false
}

export type ProductAvailability = "in_stock" | "low_stock" | "out_of_stock" | "not_in_catalog"

export function getProductAvailability(p: CatalogProduct | null | undefined): ProductAvailability {
  if (!p?.id) return "not_in_catalog"
  const s = p.stock
  if (s === "low") return "low_stock"
  if (s === "out" || s === 0 || s === "0") return "out_of_stock"
  if (s === "in") return "in_stock"
  if (typeof s === "number") return s > 0 ? "in_stock" : "out_of_stock"
  return "in_stock"
}

export function productAvailabilityLabel(status: ProductAvailability): string {
  switch (status) {
    case "in_stock":
      return "In stock"
    case "low_stock":
      return "Low stock"
    case "out_of_stock":
      return "Not available in store right now"
    case "not_in_catalog":
      return "Not available in store right now"
  }
}

/** Fallback panels when catalog has no published panel SKUs. */
export const DEFAULT_SOLAR_PANELS = [
  { id: "default-longi-620-bifacial", name: "Longi 620W Bifacial Panel", wattage: 620 },
  { id: "default-550", name: "550W Solar Panel", wattage: 550 },
] as const
