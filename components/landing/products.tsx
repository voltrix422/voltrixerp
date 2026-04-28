// @ts-nocheck
"use client"

import { useEffect, useState } from "react"
import { ArrowRight, CheckCircle2, XCircle, AlertCircle, FileText, Box } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

const categoryColors: Record<string, string> = {
  Residential: "bg-blue-50 text-blue-600 border-blue-200",
  Industrial:  "bg-orange-50 text-orange-600 border-orange-200",
  EV:          "bg-purple-50 text-purple-600 border-purple-200",
  BMS:         "bg-neutral-100 text-neutral-600 border-neutral-200",
}

function StockBadge({ stock }: { stock: any }) {
  const s = typeof stock === "number" ? (stock > 0 ? "in" : stock === 0 ? "low" : "out") : stock
  if (s === "in")  return <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> In Stock</span>
  if (s === "low") return <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200"><AlertCircle className="w-3.5 h-3.5" /> Low Stock</span>
  return <span className="flex items-center gap-1 text-xs font-medium text-neutral-400 bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200"><XCircle className="w-3.5 h-3.5" /> Out of Stock</span>
}

export default function Products() {
  const [products, setProducts] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("All")

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        const published = (data || []).filter((p: any) => p.published)
        const sorted = published.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        setProducts(sorted)
      })
      .catch(err => console.error('Error fetching products:', err))
  }, [])

  const categories = ["All", ...Array.from(new Set(products.map((p: any) => p.category).filter(Boolean)))]
  const filteredProducts = selectedCategory === "All" 
    ? products 
    : products.filter((p: any) => p.category === selectedCategory)

  return (
    <section className="py-24 px-4 bg-white" id="products">
      <div className="max-w-7xl mx-auto space-y-14">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1a9f9a]">
            Our Products
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 tracking-tight">
            The full Voltrix lineup.
          </h2>
          <p className="text-neutral-500 text-base leading-relaxed">
            From residential wall-mount packs to industrial-scale BESS — every product is built on the same LiFePO₄ foundation.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category
                  ? "bg-[#1a9f9a] text-white shadow-lg shadow-[#1a9f9a]/20"
                  : "bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-[#1a9f9a] hover:text-[#1a9f9a] hover:bg-neutral-100"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-neutral-400 text-sm">No products in this category.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
              const images = Array.isArray(p.images) ? p.images : []
              const thumb = images[0]
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group bg-white rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:shadow-neutral-100 transition-all duration-300 overflow-hidden flex flex-col"
                >
                  {/* Image Section */}
                  <div className="relative w-full h-64 bg-gradient-to-br from-neutral-50 to-neutral-100 p-6 flex items-center justify-center group-hover:from-neutral-100 group-hover:to-neutral-150 transition-colors">
                    {thumb
                      ? <Image src={thumb} alt={p.name} fill className="object-contain p-4" />
                      : <Box className="w-16 h-16 text-neutral-300" />}
                  </div>

                  {/* Content Section */}
                  <div className="p-6 flex flex-col gap-4 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${categoryColors[p.category] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{p.category}</span>
                      <StockBadge stock={p.stock} />
                    </div>
                    
                    <div className="space-y-2 flex-1">
                      <h3 className="font-bold text-neutral-900 text-lg leading-tight">{p.name}</h3>
                      <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2">{p.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                      <div>
                        {p.quoteMode ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#1a9f9a]" />
                            <span className="text-sm font-semibold text-[#1a9f9a]">Request Quote</span>
                          </div>
                        ) : (
                          <p className="text-lg font-bold text-neutral-900">{p.price ? `Rs. ${Number(p.price).toLocaleString()}` : "—"}</p>
                        )}
                        <p className="text-xs text-neutral-400 mt-0.5">Warranty: {p.warranty || "—"}</p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-medium text-[#1a9f9a] group-hover:gap-2 transition-all">
                        Details <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="text-center">
          <Link
            href="/quote"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold text-white bg-[#1a9f9a] hover:bg-[#158a85] transition-all duration-300 shadow-lg shadow-[#1a9f9a]/20 hover:shadow-xl hover:shadow-[#1a9f9a]/30 hover:scale-105"
          >
            Request a custom quote <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
