import { getSalePrice } from "@/lib/product-display"

export function dealLabelForCount(count: number): string {
  if (count <= 0) return "Deal"
  if (count === 1) return "Flash Deal"
  if (count === 2) return "Combo Deal"
  if (count === 3) return "Triple Deal"
  return "Bundle Deal"
}

export function sumCatalogPrices(
  products: Array<{ price?: number | string | null; quoteMode?: boolean }>,
): number {
  let total = 0
  for (const p of products) {
    if (p.quoteMode) continue
    const sale = getSalePrice(p)
    if (sale != null) total += sale
  }
  return Math.round(total)
}
