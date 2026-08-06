import { Space_Grotesk } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { getProductImageList } from "@/lib/product-image"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, FileText } from "lucide-react"
import Link from "next/link"
import { promises as fs } from 'fs'
import path from 'path'
import { shouldRequestQuote } from "@/lib/product-display"
import { ProductPriceDisplay } from "@/components/products/product-price-display"
import { getCategoryDisplayLabel, getMainCategory } from "@/lib/product-categories"
import { getProductDisplayName } from "@/lib/product-display-name"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" })

const categoryColors: Record<string, string> = {
  Residential: "bg-blue-50 text-blue-600 border-blue-100",
  Industrial:  "bg-orange-50 text-orange-600 border-orange-100",
  EV:          "bg-purple-50 text-purple-600 border-purple-100",
  BMS:         "bg-neutral-100 text-neutral-600 border-neutral-200",
  Inverter: "bg-sky-50 text-sky-700 border-sky-200",
  "Energy Storage Battery": "bg-teal-50 text-teal-700 border-teal-200",
  "Energy Storage": "bg-teal-50 text-teal-700 border-teal-200",
  "Voltrix Prime": "bg-sky-50 text-sky-700 border-sky-200",
  "Voltrix Nivo": "bg-sky-50 text-sky-700 border-sky-200",
  "Voltrix Fusion": "bg-amber-50 text-amber-700 border-amber-200",
}

function StockBadge({ stock }: { stock: any }) {
  const s = typeof stock === "number" ? (stock > 0 ? "in" : stock === 0 ? "low" : "out") : stock
  if (s === "in")  return <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="w-3 h-3" /> In Stock</span>
  if (s === "low") return <span className="flex items-center gap-1 text-xs text-amber-500 font-medium"><AlertCircle className="w-3 h-3" /> Low Stock</span>
  return <span className="flex items-center gap-1 text-xs text-neutral-400 font-medium"><XCircle className="w-3 h-3" /> Out of Stock</span>
}

async function getProducts() {
  try {
    const dataFile = path.join(process.cwd(), 'data', 'products.json')
    const data = await fs.readFile(dataFile, 'utf-8')
    const products = JSON.parse(data)
    return products.filter((p: any) => p.published)
  } catch (error) {
    console.error('Error reading products:', error)
    return []
  }
}

export const revalidate = 0

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <main className={`${spaceGrotesk.className} min-h-screen bg-white text-neutral-900 antialiased`}>
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Our Products</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">The full Voltrix lineup.</h1>
            <p className="text-neutral-500 text-base leading-relaxed">From residential wall-mount packs to industrial-scale BESS — every product built on LiFePO₄.</p>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-24 text-neutral-400 text-sm">No products available yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p: any) => {
                const thumb = getProductImageList(p)[0] ?? null
                const { title, model } = getProductDisplayName({
                  name: String(p.name ?? ""),
                  model: p.model != null ? String(p.model) : undefined,
                })
                return (
                  <Link key={p.id} href={`/products/${p.id}`} className="group flex flex-col gap-4 p-6 rounded-2xl border border-neutral-100 bg-white hover:border-neutral-200 hover:shadow-lg hover:shadow-neutral-100 transition-all duration-200">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${categoryColors[p.category] || categoryColors[getMainCategory(p.category)] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{getCategoryDisplayLabel(p.category)}</span>
                      <StockBadge stock={p.stock} />
                    </div>
                    <div className="relative w-full h-44 rounded-xl overflow-hidden bg-neutral-50">
                      <ProductThumbnail src={thumb} alt={p.name} fill priority={false} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-bold text-neutral-900 text-base">{title}</h3>
                      {model ? (
                        <p className="text-xs font-mono text-neutral-500">Model: {model}</p>
                      ) : null}
                      <p className="text-sm text-neutral-500 leading-relaxed">{p.description}</p>
                    </div>
                    <div className="flex items-end justify-between pt-2 border-t border-neutral-50">
                      <div>
                        {shouldRequestQuote(p) ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#1a9f9a]" />
                            <span className="text-sm font-semibold text-[#1a9f9a]">Request a Quote</span>
                          </div>
                        ) : (
                          <ProductPriceDisplay product={p} size="md" />
                        )}
                        <p className="text-xs text-neutral-400">Warranty: {p.warranty || "—"}</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-neutral-400 group-hover:text-[#1a9f9a] transition-colors">
                        Details <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="text-center">
            <Link href="/quote" className="inline-flex items-center gap-2 px-8 h-12 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: "#1a9f9a" }}>
              Request a custom quote <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      <Footer />
      <WhatsappButton />
    </main>
  )
}
