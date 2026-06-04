"use client"

import { useState, useEffect } from "react"
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
  ZoomIn,
  Shield,
  FileText,
} from "lucide-react"
import ProductTermsModal from "@/components/products/product-terms-modal"
import ProductSpecsModal from "@/components/products/product-specs-modal"
import ProductBrochurePanel from "@/components/products/product-brochure-panel"
import { formatProductPrice, shouldRequestQuote } from "@/lib/product-display"
import { getCategoryDisplayLabel, getMainCategory } from "@/lib/product-categories"
import { hasProductSpecs } from "@/lib/product-specs"

function StockPill({ stock }: { stock: unknown }) {
  const s = typeof stock === "number" ? (stock > 0 ? "in" : stock === 0 ? "low" : "out") : stock
  if (s === "in")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" /> In stock
      </span>
    )
  if (s === "low")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
        <AlertCircle className="w-3.5 h-3.5" /> Low stock
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
      <XCircle className="w-3.5 h-3.5" /> Out of stock
    </span>
  )
}

function ProductImages({ images, productName }: { images: string[]; productName: string }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [failed, setFailed] = useState<Set<number>>(() => new Set())
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

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

  const activeSrc = images[currentIndex]
  const activeFailed = failed.has(currentIndex)

  if (images.length === 0) {
    return (
      <div className="relative aspect-[4/3] max-h-[280px] w-full rounded-xl bg-neutral-50 border border-neutral-100 overflow-hidden">
        <ProductThumbnail src={null} alt={productName} fill />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setLightboxIndex(currentIndex)
            setIsLightboxOpen(true)
          }}
          className="relative block w-full aspect-[4/3] max-h-[280px] rounded-xl bg-neutral-50 border border-neutral-100 overflow-hidden group cursor-zoom-in"
          aria-label="View full size image"
        >
          {activeFailed ? (
            <ProductThumbnail src={null} alt={productName} fill />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeSrc}
              alt={productName}
              className="absolute inset-0 w-full h-full object-contain p-4 transition-transform duration-200 group-hover:scale-[1.02]"
              onError={() => setFailed(prev => new Set(prev).add(currentIndex))}
            />
          )}
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-neutral-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-3 h-3" /> Enlarge
          </span>
        </button>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border bg-white transition-all ${
                  i === currentIndex
                    ? "border-[#1a9f9a] ring-1 ring-[#1a9f9a]/30"
                    : "border-neutral-200 opacity-70 hover:opacity-100"
                }`}
              >
                <ProductThumbnail src={img} alt="" fill imgClassName="p-1.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative w-full max-w-4xl h-[80vh]" onClick={e => e.stopPropagation()}>
            {!failed.has(lightboxIndex) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[lightboxIndex]}
                alt={productName}
                className="absolute inset-0 w-full h-full object-contain"
                onError={() => setFailed(prev => new Set(prev).add(lightboxIndex))}
              />
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(prev => (prev - 1 + images.length) % images.length)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(prev => (prev + 1) % images.length)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
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
  const [termsOpen, setTermsOpen] = useState(false)
  const [specsOpen, setSpecsOpen] = useState(false)
  const [brochureOpen, setBrochureOpen] = useState(false)
  const requestQuote = shouldRequestQuote(product)
  const hasBrochure = Boolean(product.brochureUrl)
  const showSpecs = hasProductSpecs(product)
  const category = String(product.category ?? "")
  const catClass =
    categoryColors[category] ||
    categoryColors[getMainCategory(category)] ||
    "bg-neutral-100 text-neutral-600 border-neutral-200"
  const shortDesc = String(product.description ?? "").trim()
  const fullDesc = String(product.full_desc || product.description || "").trim()
  const warranty = String(product.warranty || "").trim()

  const docLinks: { label: string; onClick: () => void }[] = []
  if (showSpecs) docLinks.push({ label: "Specifications", onClick: () => setSpecsOpen(true) })
  docLinks.push({ label: "Terms & Conditions", onClick: () => setTermsOpen(true) })
  if (hasBrochure) docLinks.push({ label: "Brochure", onClick: () => setBrochureOpen(true) })

  return (
    <div className="bg-white min-h-screen">
      <div className="pt-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#1a9f9a] transition-colors py-3"
        >
          <ArrowLeft className="w-4 h-4" /> All products
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,340px)_1fr] gap-8 lg:gap-10 items-start">
          <ProductImages images={images} productName={String(product.name)} />

          <div className="min-w-0 space-y-4">
            <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md border ${catClass}`}>
              {getCategoryDisplayLabel(category)}
            </span>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 leading-snug">
              {String(product.name)}
            </h1>

            {shortDesc ? (
              <p className="text-sm text-neutral-600 leading-relaxed">{shortDesc}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 px-4 rounded-lg bg-neutral-50 border border-neutral-100 text-sm">
              <StockPill stock={product.stock} />
              {warranty ? (
                <>
                  <span className="hidden sm:inline w-px h-4 bg-neutral-200" aria-hidden />
                  <span className="inline-flex items-center gap-1.5 text-neutral-700">
                    <Shield className="w-3.5 h-3.5 text-[#1a9f9a]" />
                    <span className="text-neutral-500">Warranty</span>
                    <span className="font-medium">{warranty}</span>
                  </span>
                </>
              ) : null}
              <span className="hidden sm:inline w-px h-4 bg-neutral-200" aria-hidden />
              {requestQuote ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-[#1a9f9a]">
                  <FileText className="w-3.5 h-3.5" />
                  Request a quote
                </span>
              ) : (
                <span className="text-neutral-700">
                  <span className="text-neutral-500 mr-1.5">Price</span>
                  <span className="font-semibold text-neutral-900">
                    {formatProductPrice(product.price as string | number | null | undefined) ?? "—"}
                  </span>
                </span>
              )}
            </div>

            <Link
              href="/quote"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-w-[200px] px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1a9f9a] hover:bg-[#158a85] transition-colors"
            >
              Request a quote <ArrowRight className="w-4 h-4" />
            </Link>

            <nav className="flex flex-wrap items-center gap-1 pt-1 border-t border-neutral-100" aria-label="Product documents">
              {docLinks.map((link, i) => (
                <span key={link.label} className="inline-flex items-center">
                  {i > 0 && <span className="text-neutral-300 mx-1">·</span>}
                  <button
                    type="button"
                    onClick={link.onClick}
                    className="text-sm text-neutral-600 hover:text-[#1a9f9a] font-medium transition-colors py-2"
                  >
                    {link.label}
                  </button>
                </span>
              ))}
            </nav>
          </div>
        </div>

        {fullDesc && fullDesc !== shortDesc ? (
          <section className="mt-10 pt-8 border-t border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Description</h2>
            <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap max-w-3xl">
              {fullDesc}
            </div>
          </section>
        ) : fullDesc && !shortDesc ? (
          <section className="mt-10 pt-8 border-t border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Description</h2>
            <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap max-w-3xl">
              {fullDesc}
            </div>
          </section>
        ) : null}
      </div>

      {brochureOpen && hasBrochure && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setBrochureOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Product brochure</h2>
              <button
                type="button"
                onClick={() => setBrochureOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ProductBrochurePanel
              brochureUrl={String(product.brochureUrl)}
              brochureName={product.brochureName ? String(product.brochureName) : undefined}
              productName={String(product.name)}
            />
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-t border-neutral-100">
          <h2 className="text-lg font-semibold text-neutral-900 mb-5">Related products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {related.map((r: Record<string, unknown>) => {
              const rThumb = getProductImageList(r)[0] ?? null
              const rCat = String(r.category ?? "")
              return (
                <Link
                  key={String(r.id)}
                  href={`/products/${r.id}`}
                  className="group flex flex-col bg-white rounded-xl border border-neutral-200 overflow-hidden hover:border-[#1a9f9a]/30 hover:shadow-md transition-all"
                >
                  <div className="relative w-full aspect-[4/3] bg-neutral-50">
                    <ProductThumbnail
                      src={rThumb}
                      alt={String(r.name)}
                      fill
                      imgClassName="p-4 group-hover:scale-[1.02] transition-transform"
                    />
                  </div>
                  <div className="p-4 space-y-1.5">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border w-fit ${
                        categoryColors[rCat] ||
                        categoryColors[getMainCategory(rCat)] ||
                        "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {getCategoryDisplayLabel(rCat)}
                    </span>
                    <p className="font-semibold text-sm text-neutral-900">{String(r.name)}</p>
                    {shouldRequestQuote(r) ? (
                      <span className="text-xs font-medium text-[#1a9f9a]">Request a Quote</span>
                    ) : (
                      <p className="text-sm font-semibold text-neutral-900">
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
          warranty: warranty || undefined,
          specSheetUrl: product.specSheetUrl ? String(product.specSheetUrl) : undefined,
          specs: product.specs,
          images: images,
        }}
        focusSpecSheet
      />
    </div>
  )
}
