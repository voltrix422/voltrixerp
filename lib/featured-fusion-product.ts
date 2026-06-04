import type { ProductSpecsPayload } from "@/lib/product-specs"

/** Catalog product shown in homepage “Voltrix Fusion” featured section */
export const FEATURED_FUSION_PRODUCT_ID = "77207579-5f80-450c-a15d-f2310e9ea5ea"

export const FEATURED_FUSION_NAME_MATCH = "HS-TQS4.2KW"

/** Used when live catalog is missing this product (e.g. after VPS JSON repair). */
export const FALLBACK_FUSION_PRODUCT: Record<string, unknown> = {
  id: FEATURED_FUSION_PRODUCT_ID,
  name: "4.2 KW inverter + 8 KWh Battery | HS-TQS4.2KW+8038.4Wh",
  model: "HS-TQS4.2KW+8038.4Wh",
  category: "Voltrix Fusion",
  description: "Stackable energy storage battery with off-grid inverter",
  full_desc:
    "Stackable energy storage battery with off-grid inverter. Features 4200W rated output power, 8038.4Wh battery capacity, and advanced LiFePO4 technology.",
  published: true,
  specs: [
    { label: "Rated Output Power", value: "4200W" },
    { label: "Battery Voltage", value: "25.6V" },
    { label: "Battery Capacity", value: "314Ah" },
    { label: "Battery Energy", value: "8038.4Wh" },
    { label: "PV Input Power", value: "5000W max" },
    { label: "AC Output Voltage", value: "208/220/230/240Vac" },
    { label: "Inverter Type", value: "Off-grid" },
  ],
}

export function findFeaturedFusionProduct(
  products: Record<string, unknown>[]
): Record<string, unknown> | null {
  if (!Array.isArray(products)) return null
  const match = (p: Record<string, unknown>) => {
    const name = String(p.name ?? "").toUpperCase()
    const cat = String(p.category ?? "")
    return (
      String(p.id) === FEATURED_FUSION_PRODUCT_ID ||
      name.includes(FEATURED_FUSION_NAME_MATCH.toUpperCase()) ||
      name.includes("TQS4.2") ||
      cat === "Voltrix Fusion" ||
      (name.includes("FUSION") && name.includes("8038"))
    )
  }
  return products.find(match) ?? null
}

export function resolveFeaturedFusionProduct(
  fromApi: Record<string, unknown> | null
): Record<string, unknown> {
  if (!fromApi) return { ...FALLBACK_FUSION_PRODUCT }
  return {
    ...FALLBACK_FUSION_PRODUCT,
    ...fromApi,
    specs:
      Array.isArray(fromApi.specs) && fromApi.specs.length > 0
        ? fromApi.specs
        : FALLBACK_FUSION_PRODUCT.specs,
    specSheetUrl: fromApi.specSheetUrl ?? FALLBACK_FUSION_PRODUCT.specSheetUrl,
  }
}

export function fusionProductToSpecsPayload(
  product: Record<string, unknown>
): ProductSpecsPayload {
  const name = String(product.name ?? "Voltrix Fusion")
  const model = product.model != null ? String(product.model) : ""
  return {
    name: model && !name.includes(model) ? `${name} · ${model}` : name,
    category: String(product.category ?? "Voltrix Fusion"),
    description: product.description ? String(product.description) : undefined,
    full_desc: product.full_desc ? String(product.full_desc) : undefined,
    warranty: product.warranty ? String(product.warranty) : undefined,
    specSheetUrl: product.specSheetUrl ? String(product.specSheetUrl) : undefined,
    specs: product.specs,
  }
}
