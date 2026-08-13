import type { ProductSpecsPayload } from "@/lib/product-specs"
import { isProductPublished } from "@/lib/product-published"

const FEATURED_MODEL = "HS-LD15KW-A"
const FEATURED_NAME_MATCH = /15\s*kwh/i

/** Featured homepage product: 15 kWh Energy Storage Battery (HS-LD15KW-A). */
export function findFeaturedFusionProduct(
  products: Record<string, unknown>[]
): Record<string, unknown> | null {
  if (!Array.isArray(products)) return null
  const published = products.filter(isProductPublished)

  const byModel = published.find((p) => {
    const model = String(p.model ?? "").trim().toUpperCase()
    return model === FEATURED_MODEL || model.startsWith("HS-LD15KW")
  })
  if (byModel) return byModel

  const byName = published.find((p) => FEATURED_NAME_MATCH.test(String(p.name ?? "")))
  return byName ?? null
}

export function fusionProductToSpecsPayload(
  product: Record<string, unknown>
): ProductSpecsPayload {
  const name = String(product.name ?? "15 kWh Energy Storage Battery")
  const model = product.model != null ? String(product.model) : ""
  return {
    name: model && !name.includes(model) ? `${name} · ${model}` : name,
    category: String(product.category ?? "Energy Storage Battery"),
    description: product.description ? String(product.description) : undefined,
    full_desc: product.full_desc ? String(product.full_desc) : undefined,
    warranty: product.warranty ? String(product.warranty) : undefined,
    specSheetUrl: product.specSheetUrl ? String(product.specSheetUrl) : undefined,
    specs: product.specs,
  }
}
