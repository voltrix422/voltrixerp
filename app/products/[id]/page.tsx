import { DM_Sans } from "next/font/google"
import { notFound } from "next/navigation"
import Link from "next/link"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react"
import { promises as fs } from 'fs'
import path from 'path'
import ProductDetailClient from './product-detail-client'

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300","400","500","600","700"], variable: "--font-dm-sans" })

const categoryColors: Record<string, string> = {
  Residential: "bg-blue-50 text-blue-600 border-blue-100",
  Industrial:  "bg-orange-50 text-orange-600 border-orange-100",
  EV:          "bg-purple-50 text-purple-600 border-purple-100",
  BMS:         "bg-neutral-100 text-neutral-600 border-neutral-200",
}

function StockBadge({ stock }: { stock: any }) {
  const s = typeof stock === "number" ? (stock > 0 ? "in" : stock === 0 ? "low" : "out") : stock
  if (s === "in")  return <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><CheckCircle2 className="w-4 h-4" /> In Stock</span>
  if (s === "low") return <span className="flex items-center gap-1.5 text-sm text-amber-500 font-medium"><AlertCircle className="w-4 h-4" /> Low Stock</span>
  return <span className="flex items-center gap-1.5 text-sm text-neutral-400 font-medium"><XCircle className="w-4 h-4" /> Out of Stock</span>
}

async function getProduct(id: string) {
  try {
    const dataFile = path.join(process.cwd(), 'data', 'products.json')
    const data = await fs.readFile(dataFile, 'utf-8')
    const products = JSON.parse(data)
    return products.find((p: any) => p.id === id && p.published)
  } catch (error) {
    console.error('Error reading product:', error)
    return null
  }
}

async function getRelated(category: string, excludeId: string) {
  try {
    const dataFile = path.join(process.cwd(), 'data', 'products.json')
    const data = await fs.readFile(dataFile, 'utf-8')
    const products = JSON.parse(data)
    return products
      .filter((p: any) => p.category === category && p.id !== excludeId && p.published)
      .slice(0, 3)
  } catch (error) {
    console.error('Error reading related products:', error)
    return []
  }
}

export const revalidate = 0

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) notFound()

  const related = await getRelated(product.category, product.id)

  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Navbar />
      <ProductDetailClient product={product} related={related} categoryColors={categoryColors} />
      <Footer />
      <WhatsappButton />
    </main>
  )
}
