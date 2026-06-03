/** Normalize product image URLs for public site (uploads, absolute, legacy paths). */
export function normalizeProductImageUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  if (trimmed.startsWith("/")) return trimmed
  if (trimmed.startsWith("uploads/")) return `/${trimmed}`
  return `/uploads/products/${trimmed}`
}

export function getProductImageList(product: {
  images?: unknown
  image?: unknown
}): string[] {
  const fromArray = Array.isArray(product.images)
    ? product.images
        .map((u) => normalizeProductImageUrl(String(u)))
        .filter((u): u is string => Boolean(u))
    : []
  const single = normalizeProductImageUrl(
    typeof product.image === "string" ? product.image : undefined,
  )
  const merged = single && !fromArray.includes(single) ? [single, ...fromArray] : fromArray
  return merged
}

export const PRODUCT_IMAGE_FALLBACK = "/images/product-placeholder.svg"
