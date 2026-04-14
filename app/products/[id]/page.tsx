import { DM_Sans } from "next/font/google"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react"
import { createClient } from "@supabase/supabase-js"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300","400","500","600","700"], variable: "--font-dm-sans" })

const categoryColors: Record<string, string> = {
  Residential: "bg-blue-50 text-blue-600 border-blue-100",
  Industrial:  "bg-orange-50 text-orange-600 border-orange-100",
  EV:          "bg-purple-50 text-purple-600 border-purple-100",
  BMS:         "bg-neutral-100 text-neutral-600 border-neutral-200",
}

function StockBadge({ stock }: { stock: string }) {
  if (stock === "in")  return <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><CheckCircle2 className="w-4 h-4" /> In Stock</span>
  if (stock === "low") return <span className="flex items-center gap-1.5 text-sm text-amber-500 font-medium"><AlertCircle className="w-4 h-4" /> Low Stock</span>
  return <span className="flex items-center gap-1.5 text-sm text-neutral-400 font-medium"><XCircle className="w-4 h-4" /> Out of Stock</span>
}

async function getProduct(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .single()
  return data
}

async function getRelated(category: string, excludeId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("category", category)
    .eq("published", true)
    .neq("id", excludeId)
    .limit(3)
  return data || []
}

export const revalidate = 60

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) notFound()

  const related = await getRelated(product.category, product.id)
  const images = Array.isArray(product.images) ? product.images : []
  const primaryImage = images[0]

  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-5xl mx-auto space-y-12">

          <Link href="/products" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-700 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> All products
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            {/* Left */}
            <div className="space-y-6">
              <div className="relative w-full h-72 rounded-2xl overflow-hidden bg-neutral-50 border border-neutral-100 flex items-center justify-center">
                {primaryImage
                  ? <Image src={primaryImage} alt={product.name} fill className="object-contain p-6" priority />
                  : <span className="text-sm text-neutral-300">No image</span>}
              </div>

              {/* Extra images */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img: string, i: number) => (
                    <div key={i} className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-neutral-100 bg-neutral-50">
                      <Image src={img} alt="" fill className="object-contain p-1" />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${categoryColors[product.category] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{product.category}</span>
                <StockBadge stock={product.stock} />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-neutral-900">{product.name}</h1>
              <p className="text-neutral-500 text-base leading-relaxed">{product.full_desc}</p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link href="/quote" className="inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: "#1a9f9a" }}>
                  Request a quote <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link href="/#contact" className="inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full text-sm font-medium text-neutral-600 border border-neutral-200 hover:border-neutral-300 transition-colors">
                  Contact us
                </Link>
              </div>
            </div>

            {/* Right */}
            <div className="space-y-5">
              <div className="p-6 rounded-2xl border border-neutral-100 bg-neutral-50/60 space-y-4">
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Price</p>
                  <p className="text-3xl font-bold text-neutral-900 mt-1">{product.price}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Warranty</p>
                  <p className="text-base font-semibold text-neutral-900 mt-1">{product.warranty}</p>
                </div>
              </div>

              {product.specs?.length > 0 && (
                <div className="rounded-2xl border border-neutral-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50/60">
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Specifications</p>
                  </div>
                  <div className="divide-y divide-neutral-50">
                    {product.specs.map((s: any) => (
                      <div key={s.label} className="flex items-center justify-between px-5 py-3">
                        <p className="text-sm text-neutral-500">{s.label}</p>
                        <p className="text-sm font-semibold text-neutral-900">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <div className="space-y-6 pt-8 border-t border-neutral-100">
              <h2 className="text-xl font-bold text-neutral-900">Related products</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((r: any) => {
                  const rImgs = Array.isArray(r.images) ? r.images : []
                  const rThumb = rImgs[0]
                  return (
                    <Link key={r.id} href={`/products/${r.id}`} className="group flex flex-col gap-3 p-5 rounded-2xl border border-neutral-100 hover:border-neutral-200 hover:shadow-md hover:shadow-neutral-100 transition-all">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border w-fit ${categoryColors[r.category] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{r.category}</span>
                      <div className="relative w-full h-36 rounded-xl overflow-hidden bg-neutral-50 flex items-center justify-center">
                        {rThumb
                          ? <Image src={rThumb} alt={r.name} fill className="object-contain p-3" />
                          : <span className="text-xs text-neutral-300">No image</span>}
                      </div>
                      <p className="font-bold text-neutral-900 text-sm">{r.name}</p>
                      <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">{r.description}</p>
                      <p className="text-sm font-bold text-neutral-900 mt-auto">{r.price}</p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>
      <Footer />
      <WhatsappButton />
    </main>
  )
}
