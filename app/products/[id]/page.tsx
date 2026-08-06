import { DM_Sans } from "next/font/google"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import { promises as fs } from "fs"
import path from "path"
import { loadProductTermsTemplates, resolveProductTermsDisplay } from "@/lib/product-terms"
import { getMainCategory } from "@/lib/product-categories"
import { getProductDisplayName } from "@/lib/product-display-name"
import { getProductImageList } from "@/lib/product-image"
import { buildPageMetadata, productJsonLd } from "@/lib/seo"
import { JsonLd } from "@/components/landing/site-json-ld"
import ProductDetailClient from "./product-detail-client"

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

async function getProduct(id: string) {
  try {
    const dataFile = path.join(process.cwd(), "data", "products.json")
    const data = await fs.readFile(dataFile, "utf-8")
    const products = JSON.parse(data)
    return products.find((p: { id?: string; published?: boolean }) => p.id === id && p.published)
  } catch (error) {
    console.error("Error reading product:", error)
    return null
  }
}

async function getRelated(category: string, excludeId: string) {
  try {
    const dataFile = path.join(process.cwd(), "data", "products.json")
    const data = await fs.readFile(dataFile, "utf-8")
    const products = JSON.parse(data)
    return products
      .filter(
        (p: { id?: string; category?: string; published?: boolean }) =>
          getMainCategory(p.category || "") === getMainCategory(category) &&
          p.id !== excludeId &&
          p.published,
      )
      .slice(0, 3)
  } catch (error) {
    console.error("Error reading related products:", error)
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) {
    return buildPageMetadata({
      title: "Product not found",
      description: "This Voltrix product is unavailable.",
      path: `/products/${id}`,
      noIndex: true,
    })
  }

  const { title, model } = getProductDisplayName(product)
  const images = getProductImageList(product)
  const desc =
    String(product.description || product.full_desc || "").trim() ||
    `${title}${model ? ` (${model})` : ""} — Voltrix ${product.category || "energy storage"} in Pakistan.`

  return buildPageMetadata({
    title,
    description: desc.slice(0, 160),
    path: `/products/${id}`,
    image: images[0] || "/logo.png",
    keywords: [title, model || "", String(product.category || ""), "Voltrix Batteries", "Pakistan"].filter(
      Boolean,
    ),
  })
}

export const revalidate = 0

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) notFound()

  const related = await getRelated(product.category, product.id)
  const termsTemplates = await loadProductTermsTemplates()
  const termsDisplay = resolveProductTermsDisplay(product, termsTemplates)
  const { title } = getProductDisplayName(product)

  return (
    <main
      className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`}
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <JsonLd data={productJsonLd({ ...product, name: title })} />
      <Navbar />
      <ProductDetailClient
        product={product}
        related={related}
        categoryColors={categoryColors}
        termsDisplay={termsDisplay}
      />
      <Footer />
      <WhatsappButton />
    </main>
  )
}
