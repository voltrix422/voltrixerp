import type { ProductSpecsPayload } from "@/lib/product-specs"
import { isProductPublished } from "@/lib/product-published"

/** First published product tagged as Voltrix Fusion in the admin catalog. */
export function findFeaturedFusionProduct(
  products: Record<string, unknown>[]
): Record<string, unknown> | null {
  if (!Array.isArray(products)) return null
  return (
    products.find((p) => {
      if (!isProductPublished(p)) return false
      return String(p.category ?? "") === "Voltrix Fusion"
    }) ?? null
  )
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
