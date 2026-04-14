import { DM_Sans } from "next/font/google"
import Image from "next/image"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300","400","500","600","700"], variable: "--font-dm-sans" })

const categoryColors: Record<string, string> = {
  Residential: "bg-blue-50 text-blue-600 border-blue-100",
  Industrial:  "bg-orange-50 text-orange-600 border-orange-100",
  EV:          "bg-purple-50 text-purple-600 border-purple-100",
  BMS:         "bg-neutral-100 text-neutral-600 border-neutral-200",
}

function StockBadge({ stock }: { stock: any }) {
  const s = typeof stock === "number" ? (stock > 0 ? "in" : stock === 0 ? "low" : "out") : stock
  if (s === "in")  return <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="w-3 h-3" /> In Stock</span>
  if (s === "low") return <span className="flex items-center gap-1 text-xs text-amber-500 font-medium"><AlertCircle className="w-3 h-3" /> Low Stock</span>
  return <span className="flex items-center gap-1 text-xs text-neutral-400 font-medium"><XCircle className="w-3 h-3" /> Out of Stock</span>
}

async function getProducts() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false })
  return data || []
}

export const revalidate = 60

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
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
                const images = Array.isArray(p.images) ? p.images : []
                const thumb = images[0]
                return (
                  <Link key={p.id} href={`/products/${p.id}`} className="group flex flex-col gap-4 p-6 rounded-2xl border border-neutral-100 bg-white hover:border-neutral-200 hover:shadow-lg hover:shadow-neutral-100 transition-all duration-200">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${categoryColors[p.category] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{p.category}</span>
                      <StockBadge stock={p.stock} />
                    </div>
                    <div className="relative w-full h-44 rounded-xl overflow-hidden bg-neutral-50 flex items-center justify-center">
                      {thumb
                        ? <Image src={thumb} alt={p.name} fill className="object-contain p-3" />
                        : <span className="text-xs text-neutral-300">No image</span>}
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-bold text-neutral-900 text-base">{p.name}</h3>
                      <p className="text-sm text-neutral-500 leading-relaxed">{p.description}</p>
                    </div>
                    <div className="flex items-end justify-between pt-2 border-t border-neutral-50">
                      <div>
                        <p className="text-lg font-bold text-neutral-900">{p.price ? `Rs. ${Number(p.price).toLocaleString()}` : "—"}</p>
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
