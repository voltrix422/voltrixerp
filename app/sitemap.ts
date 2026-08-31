import type { MetadataRoute } from "next"
import { MARKETING_ROUTES, SITE_URL } from "@/lib/seo"
import { readProductsCatalog } from "@/lib/products-catalog-server"
import { assignProductSlugs } from "@/lib/product-slug"
import { isProductPublished } from "@/lib/product-published"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = MARKETING_ROUTES.map((r) => ({
    url: r.path === "/" ? SITE_URL : `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  const read = await readProductsCatalog()
  const catalog = read.ok ? read.products : []
  const slugs = assignProductSlugs(catalog)
  const productEntries: MetadataRoute.Sitemap = catalog
    .filter((p) => isProductPublished(p))
    .map((p) => ({
      url: `${SITE_URL}/products/${slugs.get(String(p.id)) || p.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }))

  return [...staticEntries, ...productEntries]
}
