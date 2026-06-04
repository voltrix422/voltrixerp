import { isProductPublished } from "@/lib/product-published"

/** Website product category tree — main groups and inverter sub-lines. */
export const INVERTER_SUBCATEGORIES = ["Voltrix Prime", "Voltrix Nivo"] as const

export const MAIN_CATEGORIES = [
  "Energy Storage Battery",
  "Inverter",
  "Voltrix Fusion",
] as const

export type MainCategory = (typeof MAIN_CATEGORIES)[number]
export type InverterSubcategory = (typeof INVERTER_SUBCATEGORIES)[number]

/** Legacy / alias values stored on older products */
const ENERGY_STORAGE_ALIASES = ["Energy Storage Battery", "Energy Storage"]

/** Stored values that belong under the Inverter website filter (incl. legacy tag). */
const INVERTER_STORED_ALIASES = ["Inverter", "Residential"] as const

export function isInverterSubcategory(category: string): boolean {
  return (INVERTER_SUBCATEGORIES as readonly string[]).includes(category)
}

export function isInverterCategory(category: string): boolean {
  if (!category) return false
  if ((INVERTER_STORED_ALIASES as readonly string[]).includes(category)) return true
  return isInverterSubcategory(category)
}

export function getMainCategory(category: string): string {
  if (!category) return ""
  if (isInverterCategory(category)) return "Inverter"
  if (ENERGY_STORAGE_ALIASES.includes(category)) return "Energy Storage Battery"
  return category
}

export function getCategoryDisplayLabel(category: string): string {
  if (!category) return ""
  if (isInverterSubcategory(category)) return `Inverter · ${category}`
  if (isInverterCategory(category)) return "Inverter"
  const main = getMainCategory(category)
  return main || category
}

export function productMatchesCategoryFilter(
  productCategory: string,
  filter: string,
): boolean {
  if (filter === "All") return true
  const main = getMainCategory(productCategory)
  if (filter === "Inverter") return main === "Inverter"
  if (isInverterSubcategory(filter)) return productCategory === filter
  if (filter === "Energy Storage Battery") return main === "Energy Storage Battery"
  return productCategory === filter || main === filter
}

/** Published products per website filter id (for empty-state hints). */
export function countProductsForFilter(
  products: { category?: string; published?: boolean | string }[],
  filter: string,
): number {
  return products.filter(
    p => isProductPublished(p) &&
      productMatchesCategoryFilter(String(p.category ?? ""), filter),
  ).length
}

/** Top-level filter chips in display order (excluding All). */
export const WEBSITE_CATEGORY_FILTERS: { id: string; label: string; children?: string[] }[] = [
  { id: "Energy Storage Battery", label: "Energy Storage Battery" },
  { id: "Inverter", label: "Inverter", children: [...INVERTER_SUBCATEGORIES] },
  { id: "Voltrix Fusion", label: "Voltrix Fusion" },
]

export function resolveStoredCategory(main: string, sub: string): string {
  if (main === "Inverter") return sub || "Inverter"
  return main || sub || ""
}

export function splitStoredCategory(category: string): { main: string; sub: string } {
  if (isInverterSubcategory(category)) {
    return { main: "Inverter", sub: category }
  }
  if (category === "Inverter" || category === "Residential") {
    return { main: "Inverter", sub: "" }
  }
  if (ENERGY_STORAGE_ALIASES.includes(category)) {
    return { main: "Energy Storage Battery", sub: "" }
  }
  return { main: category || "Energy Storage Battery", sub: "" }
}
