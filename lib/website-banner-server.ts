import { promises as fs } from "fs"
import path from "path"
import { readProductsCatalog } from "@/lib/products-catalog-server"
import { productPublicPath } from "@/lib/product-slug"

export const WEBSITE_BANNER_FILE = path.join(process.cwd(), "data", "website-banner.json")

export type WebsiteBannerDealItem = {
  productId: string
  /** Promotional selling price shown big in the popup. */
  dealPrice: number | null
}

export type WebsiteBannerConfig = {
  enabled: boolean
  /** @deprecated Use items — kept for backward compatibility. */
  productId: string | null
  items: WebsiteBannerDealItem[]
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
  dealPrice: number | null
  /** Catalog price used as the crossed-out “was” amount when dealPrice is set. */
  wasPrice: number | null
  publicPath: string
}

const DEFAULT_CONFIG: WebsiteBannerConfig = {
  enabled: false,
  productId: null,
  items: [],
  headline: "",
}

function parseDealPrice(raw: unknown): number | null {
  if (raw == null || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function normalizeItems(raw: unknown, legacyProductId?: string | null): WebsiteBannerDealItem[] {
  const out: WebsiteBannerDealItem[] = []
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue
      const productId = String((row as WebsiteBannerDealItem).productId || "").trim()
      if (!productId) continue
      if (out.some((x) => x.productId === productId)) continue
      out.push({
        productId,
        dealPrice: parseDealPrice((row as WebsiteBannerDealItem).dealPrice),
      })
      if (out.length >= 4) break
    }
  }
  if (out.length === 0 && legacyProductId) {
    out.push({ productId: String(legacyProductId), dealPrice: null })
  }
  return out
}

export function dealLabelForCount(count: number): string {
  if (count <= 0) return "Deal"
  if (count === 1) return "Flash Deal"
  if (count === 2) return "Combo Deal"
  if (count === 3) return "Triple Deal"
  return "Bundle Deal"
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
    const parsed = JSON.parse(raw) as Partial<WebsiteBannerConfig>
    const legacyId = parsed.productId ? String(parsed.productId) : null
    const items = normalizeItems(parsed.items, legacyId)
    return {
      enabled: Boolean(parsed.enabled),
      productId: items[0]?.productId ?? legacyId,
      items,
      headline: parsed.headline != null ? String(parsed.headline).trim().slice(0, 80) : "",
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function writeWebsiteBannerConfig(config: WebsiteBannerConfig): Promise<void> {
  await ensureWebsiteBannerFile()
  const items = normalizeItems(config.items, config.productId)
  const dir = path.dirname(WEBSITE_BANNER_FILE)
  const tmp = path.join(dir, `.website-banner-${Date.now()}.tmp`)
  const body = JSON.stringify(
    {
      enabled: Boolean(config.enabled),
      productId: items[0]?.productId ?? null,
      items,
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
  products: ResolvedBannerProduct[]
} | null> {
  const config = await readWebsiteBannerConfig()
  if (!config.enabled || config.items.length === 0) return null

  const read = await readProductsCatalog()
  if (!read.ok) return null

  const products: ResolvedBannerProduct[] = []
  for (const item of config.items) {
    const product = read.products.find((p) => p.id === item.productId)
    if (!product || !product.published) continue
    const catalogPrice = Number(product.price)
    const wasPrice =
      Number.isFinite(catalogPrice) && catalogPrice > 0 ? catalogPrice : null
    const dealPrice =
      item.dealPrice != null && wasPrice != null && item.dealPrice < wasPrice
        ? item.dealPrice
        : item.dealPrice != null && wasPrice == null
          ? item.dealPrice
          : null
    products.push({
      id: String(product.id),
      name: String(product.name || ""),
      model: product.model != null ? String(product.model) : undefined,
      price: product.price as number | string | null,
      compareAtPrice: (product as { compareAtPrice?: number | string | null }).compareAtPrice ?? null,
      quoteMode: Boolean(product.quoteMode),
      images: Array.isArray(product.images) ? (product.images as string[]) : [],
      published: true,
      dealPrice,
      wasPrice: dealPrice != null ? wasPrice : null,
      publicPath: productPublicPath(product, read.products),
    })
  }

  if (products.length === 0) return null

  return {
    enabled: true,
    headline: config.headline || "",
    dealLabel: dealLabelForCount(products.length),
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
      price: p.dealPrice ?? p.price,
      compareAtPrice: p.wasPrice ?? p.compareAtPrice,
      quoteMode: p.quoteMode,
      images: p.images,
      published: true,
    },
    publicPath: p.publicPath,
  }
}
