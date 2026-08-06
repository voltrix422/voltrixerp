import type { MetadataRoute } from "next"
import { promises as fs } from "fs"
import path from "path"
import { MARKETING_ROUTES, SITE_URL } from "@/lib/seo"

export const dynamic = "force-dynamic"

async function publishedProductIds(): Promise<string[]> {
  try {
    const file = path.join(process.cwd(), "data", "products.json")
    const raw = await fs.readFile(file, "utf-8")
    const products = JSON.parse(raw) as { id?: string; published?: boolean | string }[]
    return products
      .filter((p) => p.published === true || p.published === "true")
      .map((p) => String(p.id || ""))
      .filter(Boolean)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = MARKETING_ROUTES.map((r) => ({
    url: r.path === "/" ? SITE_URL : `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  const productIds = await publishedProductIds()
  const productEntries: MetadataRoute.Sitemap = productIds.map((id) => ({
    url: `${SITE_URL}/products/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85,
  }))

  return [...staticEntries, ...productEntries]
}
