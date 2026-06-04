"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { getProductImageList } from "@/lib/product-image"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  ZoomIn,
  ClipboardList,
} from "lucide-react"
import ProductTermsModal from "@/components/products/product-terms-modal"
import ProductSpecsModal from "@/components/products/product-specs-modal"
import ProductBrochurePanel from "@/components/products/product-brochure-panel"
import { formatProductPrice, shouldRequestQuote } from "@/lib/product-display"
import { getCategoryDisplayLabel, getMainCategory } from "@/lib/product-categories"
import { hasProductSpecs } from "@/lib/product-specs"

type TabType = "description" | "specifications" | "brochure"

function StockBadge({ stock }: { stock: unknown }) {
  const s = typeof stock === "number" ? (stock > 0 ? "in" : stock === 0 ? "low" : "out") : stock
  if (s === "in")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
        <CheckCircle2 className="w-4 h-4" /> In Stock
      </span>
    )
  if (s === "low")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
        <AlertCircle className="w-4 h-4" /> Low Stock
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-3 py-1 rounded-full">
      <XCircle className="w-4 h-4" /> Out of Stock
    </span>
  )
}

function ProductImages({ images, productName }: { images: string[]; productName: string }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [failed, setFailed] = useState<Set<number>>(() => new Set())
  const activeSrc = images[currentIndex]
  const activeFailed = failed.has(currentIndex)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % images.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [images.length])

  useEffect(() => {
    if (!isLightboxOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLightboxOpen(false)
      if (e.key === "ArrowLeft") setLightboxIndex(prev => (prev - 1 + images.length) % images.length)
      if (e.key === "ArrowRight") setLightboxIndex(prev => (prev + 1) % images.length)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isLightboxOpen, images.length])

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    if (distance > 50) setLightboxIndex(prev => (prev + 1) % images.length)
    if (distance < -50) setLightboxIndex(prev => (prev - 1 + images.length) % images.length)
    setTouchStart(0)
    setTouchEnd(0)
  }

  if (images.length === 0) {
    return (
      <div className="relative w-full min-h-[min(55vh,520px)] lg:min-h-[min(72vh,780px)] bg-neutral-100">
        <ProductThumbnail src={null} alt={productName} fill />
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full min-h-[min(55vh,520px)] lg:min-h-[min(72vh,780px)]">
        <button
          type="button"
          onClick={() => {
            setLightboxIndex(currentIndex)
            setIsLightboxOpen(true)
          }}
          className="relative flex-1 w-full bg-gradient-to-b from-neutral-50 to-neutral-100 group cursor-zoom-in"
          aria-label="View full size image"
        >
          {activeFailed ? (
            <ProductThumbnail src={null} alt={productName} fill />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeSrc}
              alt={productName}
              className="absolute inset-0 w-full h-full object-contain p-6 md:p-10 lg:p-14 transition-transform duration-300 group-hover:scale-[1.02]"
              onError={() => setFailed(prev => new Set(prev).add(currentIndex))}
            />
          )}
          <span className="absolute bottom-5 right-5 flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-4 py-2 text-xs font-medium text-neutral-600 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-4 h-4" /> Click to enlarge
          </span>
          {images.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setCurrentIndex(i)
                  }}
                  className={`h-2 rounded-full transition-all ${
                    i === currentIndex ? "w-10 bg-[#1a9f9a]" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                  }`}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </button>

        {images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto px-4 py-4 bg-white border-t border-neutral-100 lg:px-6">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`relative w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-xl overflow-hidden border-2 bg-white transition-all ${
                  i === currentIndex
                    ? "border-[#1a9f9a] ring-2 ring-[#1a9f9a]/25 shadow-md"
                    : "border-neutral-200 hover:border-neutral-300 opacity-80 hover:opacity-100"
                }`}
              >
                <ProductThumbnail src={img} alt="" fill imgClassName="p-2" />
              </button>
            ))}
          </div>
        )}
      </div>

      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="relative w-full h-full flex items-center justify-center px-4"
            onClick={e => e.stopPropagation()}
            onTouchStart={e => setTouchStart(e.targetTouches[0].clientX)}
            onTouchMove={e => setTouchEnd(e.targetTouches[0].clientX)}
            onTouchEnd={handleTouchEnd}
          >
            <div className="relative w-full max-w-6xl h-[85vh]">
              {!failed.has(lightboxIndex) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[lightboxIndex]}
                  alt={productName}
                  className="absolute inset-0 w-full h-full object-contain"
                  onError={() => setFailed(prev => new Set(prev).add(lightboxIndex))}
                />
              )}
            </div>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(prev => (prev - 1 + images.length) % images.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(prev => (prev + 1) % images.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                  {lightboxIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default function ProductDetailClient({
  product,
  related,
  categoryColors,
  termsDisplay,
}: {
  product: Record<string, unknown>
  related: Record<string, unknown>[]
  categoryColors: Record<string, string>
  termsDisplay: { content: string; fileUrl?: string | null }
}) {
  const images = getProductImageList(product)
  const [activeTab, setActiveTab] = useState<TabType>("description")
  const [termsOpen, setTermsOpen] = useState(false)
  const [specsOpen, setSpecsOpen] = useState(false)
  const requestQuote = shouldRequestQuote(product)
  const hasBrochure = Boolean(product.brochureUrl)
  const showSpecs = hasProductSpecs(product)
  const category = String(product.category ?? "")
  const catClass =
    categoryColors[category] ||
    categoryColors[getMainCategory(category)] ||
    "bg-neutral-100 text-neutral-600 border-neutral-200"

  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb — light padding only */}
      <div className="pt-24 px-4 sm:px-6 lg:px-8 border-b border-neutral-100">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-[#1a9f9a] transition-colors py-4"
        >
          <ArrowLeft className="w-4 h-4" /> All products
        </Link>
      </div>

      {/* Hero: full-width split — large image | product info */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] xl:grid-cols-[1.35fr_1fr] w-full border-b border-neutral-100">
        <div className="border-b lg:border-b-0 lg:border-r border-neutral-100 bg-neutral-50/50">
          <ProductImages images={images} productName={String(product.name)} />
        </div>

        <div className="flex flex-col justify-center px-6 sm:px-10 lg:px-12 xl:px-16 py-10 lg:py-14 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${catClass}`}>
              {getCategoryDisplayLabel(category)}
            </span>
            <StockBadge stock={product.stock} />
          </div>

          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-neutral-900 leading-[1.1]">
            {String(product.name)}
          </h1>

          {product.description ? (
            <p className="mt-4 text-lg text-neutral-600 leading-relaxed max-w-xl">
              {String(product.description)}
            </p>
          ) : null}

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 py-8 border-y border-neutral-100">
            {requestQuote ? (
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">Pricing</p>
                <div className="flex items-center gap-2 text-[#1a9f9a]">
                  <FileText className="w-5 h-5" />
                  <span className="text-xl font-bold">Request a Quote</span>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">Price</p>
                <p className="text-2xl xl:text-3xl font-bold text-neutral-900">
                  {formatProductPrice(product.price as string | number | null | undefined) ?? "—"}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">Warranty</p>
              <p className="text-2xl xl:text-3xl font-bold text-neutral-900">
                {String(product.warranty || "—")}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/quote"
                className="inline-flex items-center justify-center gap-2 flex-1 min-h-[52px] rounded-full text-sm font-semibold text-white bg-[#1a9f9a] hover:bg-[#158a85] transition-all shadow-lg shadow-[#1a9f9a]/20"
              >
                Request a quote <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/#contact"
                className="inline-flex items-center justify-center gap-2 flex-1 min-h-[52px] rounded-full text-sm font-medium text-neutral-700 border-2 border-neutral-200 hover:border-[#1a9f9a] hover:text-[#1a9f9a] transition-all"
              >
                Contact us
              </Link>
            </div>
            {showSpecs && (
              <button
                type="button"
                onClick={() => setSpecsOpen(true)}
                className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-full text-sm font-semibold text-[#1a9f9a] border-2 border-[#1a9f9a]/40 bg-[#1a9f9a]/5 hover:bg-[#1a9f9a]/10 transition-all"
              >
                <ClipboardList className="w-4 h-4" />
                View specifications & download PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — full width content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-10 lg:py-14">
        <div className="flex flex-wrap gap-1 border-b border-neutral-200 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab("description")}
            className={`px-6 py-3.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === "description"
                ? "border-[#1a9f9a] text-[#1a9f9a]"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Description
          </button>
          {showSpecs && (
            <button
              type="button"
              onClick={() => setSpecsOpen(true)}
              className="px-6 py-3.5 text-sm font-semibold border-b-2 -mb-px border-transparent text-neutral-500 hover:text-[#1a9f9a] hover:border-[#1a9f9a]/40 transition-colors"
            >
              Specifications
            </button>
          )}
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="px-6 py-3.5 text-sm font-semibold border-b-2 -mb-px border-transparent text-neutral-500 hover:text-neutral-800"
          >
            Terms & Conditions
          </button>
          {hasBrochure && (
            <button
              type="button"
              onClick={() => setActiveTab("brochure")}
              className={`px-6 py-3.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === "brochure"
                  ? "border-[#1a9f9a] text-[#1a9f9a]"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              Brochure
            </button>
          )}
        </div>

        <div className="max-w-5xl">
          {activeTab === "description" && (
            <div className="text-neutral-600 text-base lg:text-lg leading-relaxed whitespace-pre-wrap">
              {String(product.full_desc || product.description || "") || (
                <span className="text-neutral-400">No description available.</span>
              )}
            </div>
          )}

          {activeTab === "brochure" && hasBrochure && (
            <ProductBrochurePanel
              brochureUrl={String(product.brochureUrl)}
              brochureName={product.brochureName ? String(product.brochureName) : undefined}
              productName={String(product.name)}
            />
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-12 lg:py-16 bg-neutral-50 border-t border-neutral-100">
          <h2 className="text-2xl font-bold text-neutral-900 mb-8">Related products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((r: Record<string, unknown>) => {
              const rThumb = getProductImageList(r)[0] ?? null
              const rCat = String(r.category ?? "")
              return (
                <Link
                  key={String(r.id)}
                  href={`/products/${r.id}`}
                  className="group flex flex-col bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:border-[#1a9f9a]/40 hover:shadow-xl transition-all duration-300"
                >
                  <div className="relative w-full aspect-[4/3] bg-neutral-50">
                    <ProductThumbnail
                      src={rThumb}
                      alt={String(r.name)}
                      fill
                      imgClassName="p-6 group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-5 space-y-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border w-fit ${
                        categoryColors[rCat] ||
                        categoryColors[getMainCategory(rCat)] ||
                        "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {getCategoryDisplayLabel(rCat)}
                    </span>
                    <p className="font-bold text-neutral-900">{String(r.name)}</p>
                    <p className="text-sm text-neutral-500 line-clamp-2">{String(r.description ?? "")}</p>
                    {shouldRequestQuote(r) ? (
                      <span className="text-sm font-semibold text-[#1a9f9a]">Request a Quote</span>
                    ) : (
                      <p className="text-base font-bold text-neutral-900">
                        {formatProductPrice(r.price as string | number | null | undefined) ?? "—"}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <ProductTermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        productName={String(product.name)}
        termsDisplay={termsDisplay}
      />

      <ProductSpecsModal
        open={specsOpen}
        onClose={() => setSpecsOpen(false)}
        product={{
          name: String(product.name),
          category: category,
          description: product.description ? String(product.description) : undefined,
          full_desc: product.full_desc ? String(product.full_desc) : undefined,
          warranty: product.warranty ? String(product.warranty) : undefined,
          specSheetUrl: product.specSheetUrl ? String(product.specSheetUrl) : undefined,
          specs: product.specs,
          images: images,
        }}
      />
    </div>
  )
}
