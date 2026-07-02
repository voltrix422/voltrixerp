"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import {
  ProductImageMagnifier,
  PRODUCT_IMAGE_MAX_W,
} from "@/components/products/product-image-magnifier"
import { getProductImageList } from "@/lib/product-image"
import { getProductDisplayName } from "@/lib/product-display-name"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Tag,
} from "lucide-react"
import ProductTermsModal from "@/components/products/product-terms-modal"
import ProductSpecsModal from "@/components/products/product-specs-modal"
import ProductDocumentPanel from "@/components/products/product-document-panel"
import { GetQuoteButton } from "@/components/ui/get-quote-button"
import { formatProductPrice, shouldRequestQuote } from "@/lib/product-display"
import { getCategoryDisplayLabel, getMainCategory } from "@/lib/product-categories"
import { hasProductSpecs } from "@/lib/product-specs"

type StockKey = "in" | "low" | "out"

function normalizeStock(stock: unknown): StockKey {
  if (typeof stock === "number") return stock > 0 ? "in" : stock === 0 ? "low" : "out"
  if (stock === "low" || stock === "out") return stock
  return "in"
}

const META_CHIP_CLASS =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[#1a9f9a]/30 bg-[#1a9f9a]/[0.07] text-neutral-700"

const STOCK_CHIPS: Record<StockKey, { label: string; icon: typeof CheckCircle2 }> = {
  in: { label: "In stock", icon: CheckCircle2 },
  low: { label: "Low stock", icon: AlertCircle },
  out: { label: "Out of stock", icon: XCircle },
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
  const openLightbox = () => {
    setLightboxIndex(currentIndex)
    setIsLightboxOpen(true)
  }

  if (images.length === 0) {
    return (
      <div
        className="relative aspect-square w-full mx-auto md:mx-0 rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200/80 overflow-hidden shadow-sm"
        style={{ maxWidth: PRODUCT_IMAGE_MAX_W }}
      >
        <ProductThumbnail src={null} alt={productName} fill />
      </div>
    )
  }

  if (failed.has(currentIndex)) {
    return (
      <div
        className="relative aspect-square w-full mx-auto md:mx-0 rounded-2xl bg-neutral-50 border overflow-hidden"
        style={{ maxWidth: PRODUCT_IMAGE_MAX_W }}
      >
        <ProductThumbnail src={null} alt={productName} fill />
      </div>
    )
  }

  return (
    <>
      <div
        className="space-y-3 w-full max-w-[580px] mx-auto lg:mx-0 lg:max-w-none lg:w-full"
        style={{ maxWidth: PRODUCT_IMAGE_MAX_W }}
      >
        <ProductImageMagnifier
          key={activeSrc}
          src={activeSrc}
          alt={productName}
          onOpenLightbox={openLightbox}
        />

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 bg-white transition-all ${
                  i === currentIndex
                    ? "border-[#1a9f9a] shadow-md shadow-[#1a9f9a]/15"
                    : "border-neutral-200 opacity-75 hover:opacity-100 hover:border-neutral-300"
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
          className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative w-full max-w-4xl h-[85vh]" onClick={e => e.stopPropagation()}>
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
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(prev => (prev + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
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
  const [manualOpen, setManualOpen] = useState(false)
  const requestQuote = shouldRequestQuote(product)
  const hasBrochure = Boolean(product.brochureUrl)
  const hasUserManual = Boolean(product.userManualUrl)
  const showSpecs = hasProductSpecs(product)
  const category = String(product.category ?? "")
  const { title, model } = getProductDisplayName({
    name: String(product.name ?? ""),
    model: product.model != null ? String(product.model) : undefined,
  })
  const catClass =
    categoryColors[category] ||
    categoryColors[getMainCategory(category)] ||
    "bg-neutral-100 text-neutral-600 border-neutral-200"
  const shortDesc = String(product.description ?? "").trim()
  const fullDesc = String(product.full_desc || "").trim()
  const warranty = String(product.warranty || "").trim()
  const stockKey = normalizeStock(product.stock)
  const stockChip = STOCK_CHIPS[stockKey]
  const StockIcon = stockChip.icon
  const descriptionBody = fullDesc || shortDesc
  const showShortAbove = Boolean(shortDesc) && shortDesc !== fullDesc

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50/80 via-white to-white">
      <div className="pt-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[#1a9f9a] transition-colors py-3 rounded-lg hover:bg-white/80 px-2 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" /> All products
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm shadow-neutral-200/40 p-6 sm:p-8">
          <div
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,580px)_minmax(0,1fr)] gap-8 lg:gap-12 items-start"
          >
            <ProductImages images={images} productName={title} />

            <div className="min-w-0 flex flex-col gap-5">
              <span
                className={`inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border ${catClass}`}
              >
                <Tag className="w-3 h-3 opacity-70" />
                {getCategoryDisplayLabel(category)}
              </span>

              <div>
                <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-neutral-900 leading-tight">
                  {title}
                </h1>
                {model ? (
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-mono font-medium text-neutral-500 bg-neutral-50 border border-neutral-200/80 rounded-lg px-3 py-1.5 w-fit">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-sans font-semibold">
                      Model
                    </span>
                    {model}
                  </p>
                ) : null}
              </div>

              {showShortAbove ? (
                <p className="text-sm text-neutral-600 leading-relaxed -mt-1">{shortDesc}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-1.5">
                <span className={META_CHIP_CLASS}>
                  <StockIcon className="w-3.5 h-3.5 shrink-0 text-[#1a9f9a]" />
                  {stockChip.label}
                </span>
                {warranty ? (
                  <span className={META_CHIP_CLASS}>
                    <Shield className="w-3.5 h-3.5 shrink-0 text-[#1a9f9a]" />
                    <span className="text-neutral-500">Warranty</span>
                    <span className="font-semibold text-neutral-800">{warranty}</span>
                  </span>
                ) : null}
                {!requestQuote && (
                  <span className={META_CHIP_CLASS}>
                    <span className="text-neutral-500">Price</span>
                    <span className="font-semibold text-neutral-800">
                      {formatProductPrice(product.price as string | number | null | undefined) ?? "—"}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {showSpecs && (
                    <button
                      type="button"
                      onClick={() => setSpecsOpen(true)}
                      className="text-sm font-medium text-neutral-700 hover:text-[#1a9f9a] cursor-pointer border-b border-dotted border-transparent hover:border-[#1a9f9a] pb-0.5 transition-colors bg-transparent"
                    >
                      Specifications
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="text-sm font-medium text-neutral-700 hover:text-[#1a9f9a] cursor-pointer border-b border-dotted border-transparent hover:border-[#1a9f9a] pb-0.5 transition-colors bg-transparent"
                  >
                    Terms & Conditions
                  </button>
                  {hasUserManual && (
                    <button
                      type="button"
                      onClick={() => setManualOpen(true)}
                      className="text-sm font-medium text-neutral-700 hover:text-[#1a9f9a] cursor-pointer border-b border-dotted border-transparent hover:border-[#1a9f9a] pb-0.5 transition-colors bg-transparent"
                    >
                      User Manual
                    </button>
                  )}
                  {hasBrochure && (
                    <button
                      type="button"
                      onClick={() => setBrochureOpen(true)}
                      className="text-sm font-medium text-neutral-700 hover:text-[#1a9f9a] cursor-pointer border-b border-dotted border-transparent hover:border-[#1a9f9a] pb-0.5 transition-colors bg-transparent"
                    >
                      Brochure
                    </button>
                  )}
                </div>
                <GetQuoteButton
                  label={requestQuote ? "Request a quote" : "Get a quote"}
                  size="md"
                  className="w-fit"
                />
              </div>

              {descriptionBody ? (
                <section className="pt-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Description
                  </h2>
                  <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
                    {descriptionBody}
                  </p>
                </section>
              ) : null}
            </div>
          </div>
        </div>
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
            <ProductDocumentPanel
              documentUrl={String(product.brochureUrl)}
              documentName={product.brochureName ? String(product.brochureName) : undefined}
              productName={title}
              heading="Product brochure"
              description="View the brochure below or download a copy for offline reading."
            />
          </div>
        </div>
      )}

      {manualOpen && hasUserManual && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setManualOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">User manual</h2>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ProductDocumentPanel
              documentUrl={String(product.userManualUrl)}
              documentName={product.userManualName ? String(product.userManualName) : undefined}
              productName={title}
              heading="User manual"
              description="Read the user manual below or download it for offline reference."
            />
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h2 className="text-lg font-semibold text-neutral-900 mb-5">Related products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {related.map((r: Record<string, unknown>) => {
              const rThumb = getProductImageList(r)[0] ?? null
              const rCat = String(r.category ?? "")
              const rDisplay = getProductDisplayName({
                name: String(r.name ?? ""),
                model: r.model != null ? String(r.model) : undefined,
              })
              return (
                <Link
                  key={String(r.id)}
                  href={`/products/${r.id}`}
                  className="group flex flex-col bg-white rounded-xl border border-neutral-200 overflow-hidden hover:border-[#1a9f9a]/30 hover:shadow-md transition-all"
                >
                  <div className="relative w-full aspect-[4/3] bg-neutral-50">
                    <ProductThumbnail
                      src={rThumb}
                      alt={rDisplay.title}
                      fill
                      imgClassName="p-4 group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4 space-y-1">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border w-fit ${
                        categoryColors[rCat] ||
                        categoryColors[getMainCategory(rCat)] ||
                        "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {getCategoryDisplayLabel(rCat)}
                    </span>
                    <p className="font-semibold text-sm text-neutral-900">{rDisplay.title}</p>
                    {rDisplay.model ? (
                      <p className="text-xs font-mono text-neutral-500">{rDisplay.model}</p>
                    ) : null}
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
        productName={title}
        termsDisplay={termsDisplay}
      />

      <ProductSpecsModal
        open={specsOpen}
        onClose={() => setSpecsOpen(false)}
        product={{
          name: model ? `${title} · ${model}` : title,
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
