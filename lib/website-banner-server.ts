import { promises as fs } from "fs"
import path from "path"
import { readProductsCatalog } from "@/lib/products-catalog-server"
import { productPublicPath } from "@/lib/product-slug"

export const WEBSITE_BANNER_FILE = path.join(process.cwd(), "data", "website-banner.json")

export type WebsiteBannerConfig = {
  enabled: boolean
  productId: string | null
}

const DEFAULT_CONFIG: WebsiteBannerConfig = {
  enabled: false,
  productId: null,
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
    return {
      enabled: Boolean(parsed.enabled),
      productId: parsed.productId ? String(parsed.productId) : null,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function writeWebsiteBannerConfig(config: WebsiteBannerConfig): Promise<void> {
  await ensureWebsiteBannerFile()
  const dir = path.dirname(WEBSITE_BANNER_FILE)
  const tmp = path.join(dir, `.website-banner-${Date.now()}.tmp`)
  const body = JSON.stringify(
    {
      enabled: Boolean(config.enabled),
      productId: config.productId ? String(config.productId) : null,
    },
    null,
    2,
  )
  await fs.writeFile(tmp, body, "utf-8")
  await fs.rename(tmp, WEBSITE_BANNER_FILE)
}

export async function resolveHomeBannerProduct(): Promise<{
  product: Record<string, unknown>
  publicPath: string
} | null> {
  const config = await readWebsiteBannerConfig()
  if (!config.enabled || !config.productId) return null

  const read = await readProductsCatalog()
  if (!read.ok) return null

  const product = read.products.find(p => p.id === config.productId)
  if (!product || !product.published) return null

  return {
    product,
    publicPath: productPublicPath(product, read.products),
  }
}
