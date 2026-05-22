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

export function isInverterSubcategory(category: string): boolean {
  return (INVERTER_SUBCATEGORIES as readonly string[]).includes(category)
}

export function getMainCategory(category: string): string {
  if (!category) return ""
  if (isInverterSubcategory(category)) return "Inverter"
  if (ENERGY_STORAGE_ALIASES.includes(category)) return "Energy Storage Battery"
  return category
}

export function productMatchesCategoryFilter(
  productCategory: string,
  filter: string,
): boolean {
  if (filter === "All") return true
  if (filter === "Inverter") return getMainCategory(productCategory) === "Inverter"
  if (filter === "Energy Storage Battery") {
    return ENERGY_STORAGE_ALIASES.includes(productCategory)
  }
  return productCategory === filter
}

/** Top-level filter chips in display order (excluding All). */
export const WEBSITE_CATEGORY_FILTERS: { id: string; label: string; children?: string[] }[] = [
  { id: "Energy Storage Battery", label: "Energy Storage Battery" },
  { id: "Inverter", label: "Inverter", children: [...INVERTER_SUBCATEGORIES] },
  { id: "Voltrix Fusion", label: "Voltrix Fusion" },
]

export function resolveStoredCategory(main: string, sub: string): string {
  if (main === "Inverter" && sub) return sub
  return main || sub || ""
}

export function splitStoredCategory(category: string): { main: string; sub: string } {
  if (isInverterSubcategory(category)) {
    return { main: "Inverter", sub: category }
  }
  if (ENERGY_STORAGE_ALIASES.includes(category)) {
    return { main: "Energy Storage Battery", sub: "" }
  }
  return { main: category || "Energy Storage Battery", sub: "" }
}
