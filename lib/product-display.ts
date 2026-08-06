export type ProductPricing = {
  quoteMode?: boolean
  price?: number | string | null
  compareAtPrice?: number | string | null
  originalPrice?: number | string | null
}

export function shouldRequestQuote(product: ProductPricing): boolean {
  if (product.quoteMode) return true
  const price = Number(product.price)
  return !Number.isFinite(price) || price <= 0
}

export function formatProductPrice(price: number | string | null | undefined): string | null {
  const value = Number(price)
  if (!Number.isFinite(value) || value <= 0) return null
  return `Rs. ${value.toLocaleString()}`
}

/** Higher “was” price used for cut-price / sale UI (compareAtPrice or originalPrice). */
export function getCompareAtPrice(product: ProductPricing): number | null {
  const raw = product.compareAtPrice ?? product.originalPrice
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

export function getSalePrice(product: ProductPricing): number | null {
  const value = Number(product.price)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

/** True when compare-at is set and higher than the current selling price. */
export function hasCutPrice(product: ProductPricing): boolean {
  const sale = getSalePrice(product)
  const compare = getCompareAtPrice(product)
  return sale != null && compare != null && compare > sale
}

export function cutPricePercentOff(product: ProductPricing): number | null {
  if (!hasCutPrice(product)) return null
  const sale = getSalePrice(product)!
  const compare = getCompareAtPrice(product)!
  return Math.round(((compare - sale) / compare) * 100)
}
