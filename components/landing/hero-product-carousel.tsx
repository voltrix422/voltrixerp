// @ts-nocheck
"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { getProductImageList } from "@/lib/product-image"
import { ProductPriceDisplay } from "@/components/products/product-price-display"
import { shouldRequestQuote } from "@/lib/product-display"
import { isProductPublished } from "@/lib/product-published"
import { getProductDisplayName } from "@/lib/product-display-name"
import { getCategoryDisplayLabel, getMainCategory } from "@/lib/product-categories"
import { assignProductSlugs } from "@/lib/product-slug"

const CAROUSEL_INTERVAL_MS = 3000

const PRIORITY_MODELS = [
  "HS-25.6V100AH",
  "HS-25.6V 100Ah",
  "HS-12.8V100Ah",
  "HS-12.8V 100Ah",
  "HS-LD15KW-A",
  "HS-LD15KW-A2",
  "5 KWh",
  "HS-YD3.6KW",
]

const categoryColors: Record<string, string> = {
  "Energy Storage Battery": "bg-teal-50 text-teal-800 border-teal-200",
  "Energy Storage": "bg-teal-50 text-teal-800 border-teal-200",
  "Voltrix Fusion": "bg-amber-50 text-amber-800 border-amber-200",
  Inverter: "bg-sky-50 text-sky-800 border-sky-200",
}

function StockBadge({ stock }: { stock: unknown }) {
  const s = typeof stock === "number" ? (stock > 0 ? "in" : stock === 0 ? "low" : "out") : stock
  if (s === "in")
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" /> In Stock
      </span>
    )
  if (s === "low")
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
        <AlertCircle className="w-3 h-3" /> Low Stock
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
      <XCircle className="w-3 h-3" /> Out of Stock
    </span>
  )
}

function sortForCarousel(products: Record<string, unknown>[]) {
  const score = (p: Record<string, unknown>) => {
    const model = String(p.model ?? p.name ?? "").toLowerCase()
    const idx = PRIORITY_MODELS.findIndex((m) => model.includes(m.toLowerCase().replace(/\s/g, "")))
    if (idx >= 0) return idx
    const cat = String(p.category ?? "")
    if (cat.includes("Energy Storage")) return 20 + (Number(p.order) || 0)
    if (cat === "Voltrix Fusion") return 30 + (Number(p.order) || 0)
    return 100 + (Number(p.order) || 0)
  }
  return [...products].sort((a, b) => score(a) - score(b))
}

export default function HeroProductCarousel() {
  const [products, setProducts] = useState<Record<string, unknown>[]>([])
  const [catalog, setCatalog] = useState<Record<string, unknown>[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setCatalog(list)
        const published = list.filter((p) => isProductPublished(p))
        setProducts(sortForCarousel(published))
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const count = products.length

  const next = useCallback(() => {
    if (count === 0) return
    setCurrentIndex((prev) => (prev + 1) % count)
  }, [count])

  const prev = useCallback(() => {
    if (count === 0) return
    setCurrentIndex((prev) => (prev - 1 + count) % count)
  }, [count])

  useEffect(() => {
    if (count <= 1) return
    const interval = setInterval(next, CAROUSEL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [count, next])

  if (!loaded || count === 0) return null

  const slugById = assignProductSlugs(catalog.length ? catalog : products)

  return (
    <div className="w-full max-w-[380px] mx-auto lg:mx-0">
      <div className="relative rounded-2xl border border-neutral-200/90 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)] overflow-hidden">
        {/* Slides */}
        <div className="relative min-h-[420px]">
          {products.map((product, index) => {
            const slideThumb = getProductImageList(product)[0] ?? null
            const display = getProductDisplayName({
              name: String(product.name ?? ""),
              model: product.model != null ? String(product.model) : undefined,
            })
            const slideCat = getCategoryDisplayLabel(String(product.category ?? ""))
            const slideCatClass =
              categoryColors[String(product.category ?? "")] ||
              categoryColors[getMainCategory(String(product.category ?? ""))] ||
              "bg-neutral-50 text-neutral-700 border-neutral-200"

            return (
              <Link
                key={String(product.id)}
                href={`/products/${slugById.get(String(product.id)) || product.id}`}
                className={`absolute inset-0 flex flex-col transition-all duration-700 ease-out ${
                  index === currentIndex
                    ? "opacity-100 translate-x-0 pointer-events-auto z-10"
                    : "opacity-0 translate-x-6 pointer-events-none z-0"
                }`}
              >
                <div className="relative w-full h-52 bg-neutral-50 border-b border-neutral-100">
                  <ProductThumbnail src={slideThumb} alt={display.title} fill imgClassName="p-5 object-contain" />
                </div>

                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border ${slideCatClass}`}>
                      {slideCat}
                    </span>
                    <StockBadge stock={product.stock} />
                  </div>

                  <div className="space-y-1 flex-1">
                    <h3 className="font-bold text-neutral-900 text-base leading-tight line-clamp-2">
                      {display.title}
                    </h3>
                    {display.model ? (
                      <p className="text-[11px] font-mono text-neutral-500">Model: {display.model}</p>
                    ) : null}
                    {product.freeDelivery ? (
                      <p className="text-[11px] font-medium text-[#158a85]">Free Home Delivery</p>
                    ) : null}
                    <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                      {String(product.description ?? "")}
                    </p>
                  </div>

                  <div className="flex items-end justify-between pt-3 border-t border-neutral-100">
                    <div>
                      {shouldRequestQuote(product) ? (
                        <span className="text-sm font-semibold text-[#1a9f9a]">Request a Quote</span>
                      ) : (
                        <ProductPriceDisplay
                          product={product}
                          size="md"
                          className="[&_span]:text-neutral-900 [&_.line-through]:text-neutral-400"
                        />
                      )}
                      <p className="text-[10px] text-neutral-500 mt-0.5">
                        Warranty: {String(product.warranty || "—")}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium text-[#1a9f9a]">
                      Details <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Controls */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                prev()
              }}
              className="absolute left-2 top-[104px] z-20 w-8 h-8 rounded-full bg-white/95 border border-neutral-200 shadow-sm flex items-center justify-center text-neutral-700 hover:bg-white hover:text-neutral-900 transition-colors"
              aria-label="Previous product"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                next()
              }}
              className="absolute right-2 top-[104px] z-20 w-8 h-8 rounded-full bg-white/95 border border-neutral-200 shadow-sm flex items-center justify-center text-neutral-700 hover:bg-white hover:text-neutral-900 transition-colors"
              aria-label="Next product"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Dot progress — 3s fill */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {products.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className="relative w-8 h-1 rounded-full overflow-hidden bg-neutral-200 hover:bg-neutral-300 transition-colors"
              aria-label={`Go to product ${index + 1}`}
            >
              <div
                className={`absolute inset-0 bg-[#1a9f9a] origin-left ${
                  index === currentIndex ? "animate-carousel-fill" : "scale-x-0"
                }`}
                style={{
                  animation:
                    index === currentIndex
                      ? `carousel-fill ${CAROUSEL_INTERVAL_MS}ms linear`
                      : "none",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
