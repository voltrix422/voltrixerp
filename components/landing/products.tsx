// @ts-nocheck
"use client"

import { useEffect, useState } from "react"
import { ArrowRight, CheckCircle2, XCircle, AlertCircle, FileText } from "lucide-react"
import Image from "next/image"
import ScrollFloat from "./scroll-float"
import Link from "next/link"

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

export default function Products() {
  const [products, setProducts] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("All")

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        const published = (data || []).filter((p: any) => p.published)
        setProducts(published)
      })
      .catch(err => console.error('Error fetching products:', err))
  }, [])

  const categories = ["All", "Residential", "Industrial", "EV", "BMS"]
  const filteredProducts = selectedCategory === "All" 
    ? products 
    : products.filter((p: any) => p.category === selectedCategory)

  return (
    <section className="py-24 px-4 bg-neutral-50/40" id="products">
      <div className="max-w-6xl mx-auto space-y-14">
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>
            Our Products
          </p>
          <ScrollFloat
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.03}
            containerClassName="text-4xl font-bold text-neutral-900 tracking-tight"
          >
            The full Voltrix lineup.
          </ScrollFloat>
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
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category
                  ? "bg-[#1a9f9a] text-white shadow-md"
                  : "bg-white text-neutral-600 border border-neutral-200 hover:border-[#1a9f9a] hover:text-[#1a9f9a]"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-neutral-400 text-sm">No products in this category.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p) => {
              const images = Array.isArray(p.images) ? p.images : []
              const thumb = images[0]
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group border border-neutral-100 rounded-2xl shadow-none hover:shadow-lg hover:shadow-neutral-100 transition-all duration-200 bg-white flex flex-col"
                >
                  <div className="p-6 flex flex-col gap-4 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${categoryColors[p.category] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{p.category}</span>
                      <StockBadge stock={p.stock} />
                    </div>
                    <div className="relative w-full h-44 rounded-xl overflow-hidden bg-neutral-50 flex items-center justify-center">
                      {thumb
                        ? <Image src={thumb} alt={p.name} fill className="object-contain p-3" />
                        : <span className="text-xs text-neutral-300">No image</span>}
                    </div>
                    <div className="space-y-1 flex-1">
                      <h3 className="font-bold text-neutral-900 text-base">{p.name}</h3>
                      <p className="text-sm text-neutral-500 leading-relaxed">{p.description}</p>
                    </div>
                    <div className="flex items-end justify-between pt-2 border-t border-neutral-50">
                      <div>
                        {p.quoteMode ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[#1a9f9a]" />
                            <span className="text-sm font-semibold text-[#1a9f9a]">Request Quote</span>
                          </div>
                        ) : (
                          <p className="text-lg font-bold text-neutral-900">{p.price ? `Rs. ${Number(p.price).toLocaleString()}` : "—"}</p>
                        )}
                        <p className="text-xs text-neutral-400">Warranty: {p.warranty || "—"}</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-neutral-400 group-hover:text-[#1a9f9a] transition-colors">
                        Details <ArrowRight className="w-3 h-3" />
                      </span>
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
            className="inline-flex items-center gap-2 px-8 h-12 rounded-full text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#1a9f9a" }}
          >
            Request a custom quote <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
