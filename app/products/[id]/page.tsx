import { DM_Sans } from "next/font/google"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import { loadProductTermsTemplates, resolveProductTermsDisplay } from "@/lib/product-terms"
import { getMainCategory } from "@/lib/product-categories"
import { getProductDisplayName } from "@/lib/product-display-name"
import { getProductImageList } from "@/lib/product-image"
import { buildPageMetadata, faqJsonLd, productJsonLd, truncateMetaDescription } from "@/lib/seo"
import { JsonLd } from "@/components/landing/site-json-ld"
import { readProductsCatalog } from "@/lib/products-catalog-server"
import {
  assignProductSlugs,
  findProductByParam,
  isUuidParam,
} from "@/lib/product-slug"
import { buildProductSeoCopy, productMetaDescription } from "@/lib/product-seo-copy"
import { normalizeSpecRows } from "@/lib/product-specs"
import { isProductPublished } from "@/lib/product-published"
import ProductDetailClient from "./product-detail-client"
import { ProductSeoSections } from "@/components/products/product-seo-sections"

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
})

const categoryColors: Record<string, string> = {
  Residential: "bg-blue-50 text-blue-600 border-blue-100",
  Industrial: "bg-orange-50 text-orange-600 border-orange-100",
  EV: "bg-purple-50 text-purple-600 border-purple-100",
  BMS: "bg-neutral-100 text-neutral-600 border-neutral-200",
  Inverter: "bg-sky-50 text-sky-700 border-sky-200",
  "Energy Storage Battery": "bg-teal-50 text-teal-700 border-teal-200",
  "Energy Storage": "bg-teal-50 text-teal-700 border-teal-200",
  "Voltrix Prime": "bg-sky-50 text-sky-700 border-sky-200",
  "Voltrix Nivo": "bg-sky-50 text-sky-700 border-sky-200",
  "Voltrix Fusion": "bg-amber-50 text-amber-700 border-amber-200",
}

async function loadCatalog(): Promise<Record<string, unknown>[]> {
  const read = await readProductsCatalog()
  if (!read.ok) return []
  return read.products
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const catalog = await loadCatalog()
  const product = findProductByParam(catalog, id)
  if (!product || !isProductPublished(product)) {
    return buildPageMetadata({
      title: "Product not found",
      description: "This Voltrix product is unavailable.",
      path: `/products/${id}`,
      noIndex: true,
    })
  }

  const slugs = assignProductSlugs(catalog)
  const slug = slugs.get(String(product.id)) || String(product.id)
  const { title, model } = getProductDisplayName(product)
  const images = getProductImageList(product)
  const catalogDesc = String(product.description || product.full_desc || "").trim()
  const desc = truncateMetaDescription(productMetaDescription(product, catalogDesc))

  return buildPageMetadata({
    title: model ? `${title} (${model})` : title,
    description: desc,
    path: `/products/${slug}`,
    image: images[0] || "/logo.png",
    keywords: [
      title,
      model || "",
      String(product.category || ""),
      "LiFePO4 battery Pakistan",
      "solar battery Pakistan",
      "Voltrix Batteries",
    ].filter(Boolean),
  })
}

export const revalidate = 0

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const catalog = await loadCatalog()
  const product = findProductByParam(catalog, id)
  if (!product || !isProductPublished(product)) notFound()

  const slugs = assignProductSlugs(catalog)
  const slug = slugs.get(String(product.id)) || String(product.id)
  if (isUuidParam(id) && slug !== id) {
    permanentRedirect(`/products/${slug}`)
  }

  const related = catalog
    .filter(
      (p) =>
        isProductPublished(p) &&
        getMainCategory(String(p.category || "")) === getMainCategory(String(product.category || "")) &&
        String(p.id) !== String(product.id),
    )
    .slice(0, 3)
    .map((p) => ({
      ...p,
      publicPath: `/products/${slugs.get(String(p.id)) || p.id}`,
    }))

  const termsTemplates = await loadProductTermsTemplates()
  const termsDisplay = resolveProductTermsDisplay(product, termsTemplates)
  const { title, model } = getProductDisplayName({
    name: String(product.name ?? ""),
    model: product.model != null ? String(product.model) : undefined,
  })
  const seo = buildProductSeoCopy(product)
  const specRows = normalizeSpecRows(product.specs)
  const publicPath = `/products/${slug}`
  const images = getProductImageList(product)

  return (
    <main
      className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`}
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <JsonLd
        data={[
          productJsonLd({
            id: String(product.id),
            name: title,
            model: model || undefined,
            description: seo.intro,
            category: String(product.category || ""),
            price: product.price as number | string | null | undefined,
            images,
            warranty: product.warranty ? String(product.warranty) : undefined,
            stock: product.stock as string | number | undefined,
            path: publicPath,
          }),
          faqJsonLd(seo.faqs),
        ]}
      />
      <Navbar />
      <ProductDetailClient
        product={product}
        related={related}
        categoryColors={categoryColors}
        termsDisplay={termsDisplay}
        seoHeading={seo.h1}
      />
      <ProductSeoSections copy={seo} specRows={specRows} productName={title} />
      <Footer />
      <WhatsappButton />
    </main>
  )
}
