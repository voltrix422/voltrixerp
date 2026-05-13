export type ProductPricing = {
  quoteMode?: boolean
  price?: number | string | null
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
