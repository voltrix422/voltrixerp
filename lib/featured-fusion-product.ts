/** Catalog product shown in homepage “Voltrix Fusion” featured section */
export const FEATURED_FUSION_PRODUCT_ID = "77207579-5f80-450c-a15d-f2310e9ea5ea"

export const FEATURED_FUSION_NAME_MATCH = "HS-TQS4.2KW"

export function findFeaturedFusionProduct(
  products: Record<string, unknown>[]
): Record<string, unknown> | null {
  if (!Array.isArray(products)) return null
  return (
    products.find(p => String(p.id) === FEATURED_FUSION_PRODUCT_ID) ??
    products.find(p => String(p.name ?? "").includes(FEATURED_FUSION_NAME_MATCH)) ??
    null
  )
}
