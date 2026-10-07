import { promises as fs } from "fs"
import path from "path"
import { getSalePrice } from "@/lib/product-display"
import { readProductsCatalog } from "@/lib/products-catalog-server"
import { productPublicPath } from "@/lib/product-slug"
import { dealLabelForCount, sumCatalogPrices } from "@/lib/website-banner-utils"

export { dealLabelForCount, sumCatalogPrices } from "@/lib/website-banner-utils"

export const WEBSITE_BANNER_FILE = path.join(process.cwd(), "data", "website-banner.json")

export type WebsiteBannerDealItem = {
  productId: string
  /** @deprecated Per-item deal prices — use bundleDealPrice */
  dealPrice?: number | null
}

export type WebsiteBannerConfig = {
  enabled: boolean
  /** @deprecated First product id — kept for compatibility */
  productId: string | null
  items: WebsiteBannerDealItem[]
  productIds: string[]
  /** One promotional price for the whole bundle (all selected products). */
  bundleDealPrice: number | null
  headline?: string
}

export type ResolvedBannerProduct = {
  id: string
  name: string
  model?: string
  price: number | string | null
  compareAtPrice?: number | string | null
  quoteMode?: boolean
  images?: string[]
  published?: boolean
  catalogPrice: number | null
  publicPath: string
}

const DEFAULT_CONFIG: WebsiteBannerConfig = {
  enabled: false,
  productId: null,
  items: [],
  productIds: [],
  bundleDealPrice: null,
  headline: "",
}

function parsePrice(raw: unknown): number | null {
  if (raw == null || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function normalizeProductIds(
  rawIds: unknown,
  rawItems: unknown,
  legacyProductId?: string | null,
): string[] {
  const out: string[] = []
  const push = (id: string) => {
    const t = id.trim()
    if (!t || out.includes(t)) return
    out.push(t)
  }
  if (Array.isArray(rawIds)) {
    for (const id of rawIds) push(String(id))
  }
  if (Array.isArray(rawItems)) {
    for (const row of rawItems) {
      if (!row || typeof row !== "object") continue
      push(String((row as WebsiteBannerDealItem).productId || ""))
    }
  }
  if (legacyProductId) push(String(legacyProductId))
  return out.slice(0, 4)
}

export async function ensureWebsiteBannerFile(): Promise<void> {
  try {
    await fs.access(WEBSITE_BANNER_FILE)
  } catch {
    await fs.mkdir(path.dirname(WEBSITE_BANNER_FILE), { recursive: true })
    await fs.writeFile(WEBSITE_BANNER_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2))
  }
}

export async function readWebsiteBannerConfig(): Promise<WebsiteBannerConfig> {
  await ensureWebsiteBannerFile()
  try {
    const raw = await fs.readFile(WEBSITE_BANNER_FILE, "utf-8")
    const parsed = JSON.parse(raw) as Partial<WebsiteBannerConfig> & {
      items?: WebsiteBannerDealItem[]
    }
    const legacyId = parsed.productId ? String(parsed.productId) : null
    const productIds = normalizeProductIds(parsed.productIds, parsed.items, legacyId)
    let bundleDealPrice = parsePrice(parsed.bundleDealPrice)
    // Legacy: single item with dealPrice and no bundle field
    if (bundleDealPrice == null && Array.isArray(parsed.items) && parsed.items.length === 1) {
      bundleDealPrice = parsePrice(parsed.items[0]?.dealPrice)
    }
    const items = productIds.map((productId) => ({ productId }))
    return {
      enabled: Boolean(parsed.enabled),
      productId: productIds[0] ?? legacyId,
      items,
      productIds,
      bundleDealPrice,
      headline: parsed.headline != null ? String(parsed.headline).trim().slice(0, 80) : "",
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function writeWebsiteBannerConfig(config: WebsiteBannerConfig): Promise<void> {
  await ensureWebsiteBannerFile()
  const productIds = normalizeProductIds(config.productIds, config.items, config.productId)
  const items = productIds.map((productId) => ({ productId }))
  const dir = path.dirname(WEBSITE_BANNER_FILE)
  const tmp = path.join(dir, `.website-banner-${Date.now()}.tmp`)
  const body = JSON.stringify(
    {
      enabled: Boolean(config.enabled),
      productId: productIds[0] ?? null,
      productIds,
      items,
      bundleDealPrice: parsePrice(config.bundleDealPrice),
      headline: String(config.headline || "").trim().slice(0, 80),
    },
    null,
    2,
  )
  await fs.writeFile(tmp, body, "utf-8")
  await fs.rename(tmp, WEBSITE_BANNER_FILE)
}

export async function resolveHomeBannerDeal(): Promise<{
  enabled: true
  headline: string
  dealLabel: string
  bundleWasTotal: number | null
  bundleDealPrice: number | null
  bundlePctOff: number | null
  products: ResolvedBannerProduct[]
} | null> {
  const config = await readWebsiteBannerConfig()
  if (!config.enabled || config.productIds.length === 0) return null

  const read = await readProductsCatalog()
  if (!read.ok) return null

  const products: ResolvedBannerProduct[] = []
  for (const productId of config.productIds) {
    const product = read.products.find((p) => p.id === productId)
    if (!product || !product.published) continue
    const catalogPrice = getSalePrice(product)
    products.push({
      id: String(product.id),
      name: String(product.name || ""),
      model: product.model != null ? String(product.model) : undefined,
      price: product.price as number | string | null,
      compareAtPrice: (product as { compareAtPrice?: number | string | null }).compareAtPrice ?? null,
      quoteMode: Boolean(product.quoteMode),
      images: Array.isArray(product.images) ? (product.images as string[]) : [],
      published: true,
      catalogPrice,
      publicPath: productPublicPath(product, read.products),
    })
  }

  if (products.length === 0) return null

  const bundleWasTotal = sumCatalogPrices(products)
  const bundleDealPrice = config.bundleDealPrice
  const bundlePctOff =
    bundleDealPrice != null &&
    bundleWasTotal > 0 &&
    bundleDealPrice < bundleWasTotal
      ? Math.round(((bundleWasTotal - bundleDealPrice) / bundleWasTotal) * 100)
      : null

  return {
    enabled: true,
    headline: config.headline || "",
    dealLabel: dealLabelForCount(products.length),
    bundleWasTotal: bundleWasTotal > 0 ? bundleWasTotal : null,
    bundleDealPrice,
    bundlePctOff,
    products,
  }
}

/** @deprecated Prefer resolveHomeBannerDeal */
export async function resolveHomeBannerProduct(): Promise<{
  product: Record<string, unknown>
  publicPath: string
} | null> {
  const deal = await resolveHomeBannerDeal()
  if (!deal?.products[0]) return null
  const p = deal.products[0]
  return {
    product: {
      id: p.id,
      name: p.name,
      model: p.model,
      price: deal.bundleDealPrice ?? p.price,
      compareAtPrice: deal.bundleWasTotal ?? p.compareAtPrice,
      quoteMode: p.quoteMode,
      images: p.images,
      published: true,
    },
    publicPath: p.publicPath,
  }
}
