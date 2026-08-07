"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  FileText,
  ScrollText,
  Shield,
  Sparkles,
  Tag,
  X,
} from "lucide-react"
import ProductSpecsModal from "@/components/products/product-specs-modal"
import ProductTermsModal from "@/components/products/product-terms-modal"
import { ProductPriceDisplay } from "@/components/products/product-price-display"
import { getCategoryDisplayLabel } from "@/lib/product-categories"
import { getProductDisplayName } from "@/lib/product-display-name"
import { cutPricePercentOff, hasCutPrice, shouldRequestQuote } from "@/lib/product-display"
import { getProductImageList, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-image"
import { parseProductTermsContent } from "@/lib/parse-product-terms"
import { hasProductSpecs, normalizeSpecRows } from "@/lib/product-specs"
import { resolveStoredProductTermsContent } from "@/lib/resolve-stored-product-terms"

type BannerProduct = Record<string, unknown>

const SESSION_KEY_PREFIX = "voltrix-home-banner-dismissed"
const ANIM_MS = 320

type AnimPhase = "enter" | "open" | "exit"

function stockLabel(stock: unknown): { text: string; cls: string } {
  const n = Number(stock)
  if (Number.isFinite(n)) {
    if (n > 0) return { text: "In stock", cls: "text-emerald-700 bg-emerald-50 border-emerald-100" }
    if (n === 0) return { text: "Low stock", cls: "text-amber-700 bg-amber-50 border-amber-100" }
    return { text: "Out of stock", cls: "text-neutral-600 bg-neutral-100 border-neutral-200" }
  }
  const s = String(stock || "").toLowerCase()
  if (s === "in") return { text: "In stock", cls: "text-emerald-700 bg-emerald-50 border-emerald-100" }
  if (s === "low") return { text: "Low stock", cls: "text-amber-700 bg-amber-50 border-amber-100" }
  return { text: "Out of stock", cls: "text-neutral-600 bg-neutral-100 border-neutral-200" }
}

export default function HomeProductBanner() {
  const [product, setProduct] = useState<BannerProduct | null>(null)
  const [mounted, setMounted] = useState(false)
  const [animPhase, setAnimPhase] = useState<AnimPhase>("enter")
  const [specsOpen, setSpecsOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const closingRef = useRef(false)

  useEffect(() => {
    fetch("/api/site/home-banner", { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        if (!data?.enabled || !data?.product) return
        const p = data.product as BannerProduct
        const id = String(p.id ?? "")
        if (!id) return
        const dismissed = sessionStorage.getItem(`${SESSION_KEY_PREFIX}-${id}`)
        if (dismissed === "1") return
        setProduct(p)
        setMounted(true)
      })
      .catch(() => {})
  }, [])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnimPhase("exit")
    if (product?.id) {
      sessionStorage.setItem(`${SESSION_KEY_PREFIX}-${String(product.id)}`, "1")
    }
    window.setTimeout(() => {
      setMounted(false)
      setProduct(null)
    }, ANIM_MS)
  }, [product?.id])

  useEffect(() => {
    if (!mounted) return
    const enter = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimPhase("open"))
    })
    return () => cancelAnimationFrame(enter)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [mounted, close])

  if (!mounted || !product) return null

  const isOpen = animPhase === "open"

  const display = getProductDisplayName({
    name: String(product.name ?? ""),
    model: product.model != null ? String(product.model) : undefined,
  })
  const images = getProductImageList(product)
  const heroImage = images[0] ?? PRODUCT_IMAGE_FALLBACK
  const category = getCategoryDisplayLabel(String(product.category ?? ""))
  const specRows = normalizeSpecRows(product.specs)
  const warranty = String(product.warranty ?? "").trim()
  const shortDesc = String(product.description ?? "").trim()
  const fullDesc = String(product.full_desc ?? "").trim()
  const description = fullDesc || shortDesc || "Explore this Voltrix product — engineered for reliable home and solar energy storage."
  const specification = String(product.specification ?? "").trim()
  const stock = stockLabel(product.stock)
  const unit = String(product.unit ?? "pcs").trim()
  const quoteMode = shouldRequestQuote({
    quoteMode: Boolean(product.quoteMode),
    price: product.price as number | string | null,
  })
  const productId = String(product.id)
  const specSheetUrl = product.specSheetUrl ? String(product.specSheetUrl) : ""
  const brochureUrl = product.brochureUrl ? String(product.brochureUrl) : ""
  const userManualUrl = product.userManualUrl ? String(product.userManualUrl) : ""
  const cutPct = hasCutPrice(product) ? cutPricePercentOff(product) : null

  const termsContent = resolveStoredProductTermsContent(
    product.terms as string | null | undefined,
    product.termsUseCustom as boolean | null | undefined,
  )
  const termsDisplay = { content: termsContent, fileUrl: null as string | null }
  const parsedTerms = parseProductTermsContent(termsContent)
  const termsPreview = parsedTerms.bullets.slice(0, 5)

  const specsPayload = {
    name: display.title,
    category: String(product.category ?? ""),
    description: shortDesc,
    full_desc: fullDesc,
    warranty,
    specification,
    specSheetUrl: specSheetUrl || undefined,
    specs: product.specs,
    images,
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-banner-title"
      >
        {/* Backdrop */}
        <button
          type="button"
          className={`absolute inset-0 bg-neutral-950/75 backdrop-blur-[6px] transition-opacity duration-300 ease-out ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={close}
          aria-label="Close featured product banner"
        />

        {/* Panel */}
        <div
          className={`relative flex w-full max-w-6xl max-h-[min(94vh,880px)] flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-white shadow-2xl shadow-neutral-900/40 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.94] translate-y-6"
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#1a9f9a] via-teal-400 to-emerald-400" />

          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-600 shadow-md transition hover:scale-105 hover:bg-neutral-50 hover:text-neutral-900 active:scale-95"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
            {/* Left — hero image */}
            <div className="relative flex min-h-[220px] shrink-0 flex-col items-center justify-center bg-gradient-to-br from-neutral-50 via-white to-teal-50/50 p-5 sm:p-6 lg:col-span-4 lg:min-h-0">
              <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-[#1a9f9a]/25 bg-white/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#1a9f9a] shadow-sm">
                <Sparkles className="h-3 w-3" />
                Featured offer
              </div>
              {cutPct != null && cutPct > 0 && (
                <div className="absolute right-4 top-4 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-md">
                  −{cutPct}% OFF
                </div>
              )}
              <div className="relative aspect-square w-full max-w-[280px] sm:max-w-[320px]">
                <Image
                  src={heroImage}
                  alt={display.title || "Featured product"}
                  fill
                  className="object-contain p-2 drop-shadow-xl"
                  priority
                  unoptimized={heroImage.startsWith("/uploads/")}
                />
              </div>
              {images.length > 1 && (
                <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 max-w-full px-1">
                  {images.slice(0, 4).map((img, i) => (
                    <div
                      key={img}
                      className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-white ${
                        i === 0 ? "border-[#1a9f9a] ring-1 ring-[#1a9f9a]/30" : "border-neutral-200"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="h-full w-full object-contain p-0.5" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right — scrollable details */}
            <div className="flex min-h-0 flex-col lg:col-span-8">
              <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 lg:p-7 space-y-4">
                {/* Header */}
                <div className="space-y-2 pr-8">
                  {category ? (
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#1a9f9a]">
                      {category}
                    </p>
                  ) : null}
                  <h2 id="home-banner-title" className="text-2xl sm:text-[1.65rem] font-bold text-neutral-900 leading-tight">
                    {display.title}
                  </h2>
                  {display.model ? (
                    <p className="font-mono text-xs text-neutral-500">{display.model}</p>
                  ) : null}
                  <p className="text-sm text-neutral-600 leading-relaxed">{description}</p>
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${stock.cls}`}>
                    {stock.text}
                  </span>
                  {warranty ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border border-neutral-200 bg-neutral-50 text-neutral-600">
                      <Shield className="h-3 w-3 text-[#1a9f9a]" />
                      {warranty}
                    </span>
                  ) : null}
                  {unit ? (
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-neutral-200 bg-white text-neutral-500">
                      Unit: {unit}
                    </span>
                  ) : null}
                </div>

                {/* Pricing */}
                <div className="rounded-xl border border-neutral-100 bg-gradient-to-r from-neutral-50 to-teal-50/30 p-4">
                  {quoteMode ? (
                    <p className="text-sm font-semibold text-neutral-700">Request a quote for pricing</p>
                  ) : (
                    <ProductPriceDisplay product={product} size="lg" />
                  )}
                </div>

                {/* Spec rows */}
                {specRows.length > 0 && (
                  <section className="rounded-xl border border-neutral-100 p-4">
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      <Tag className="h-3.5 w-3.5" />
                      Specifications
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {specRows.map((row, i) => (
                        <div
                          key={`${row.label}-${i}`}
                          className="rounded-lg border border-neutral-100 bg-white px-2.5 py-2 min-w-0 flex gap-2"
                        >
                          {row.imageUrl ? (
                            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
                            </div>
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-[10px] text-neutral-400 truncate">{row.label}</p>
                            <p className="text-xs font-semibold text-neutral-800 truncate">{row.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {specification && (
                  <section className="rounded-xl border border-neutral-100 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                      Technical details
                    </p>
                    <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-line max-h-28 overflow-y-auto">
                      {specification}
                    </p>
                  </section>
                )}

                {/* Spec sheet short preview */}
                {specSheetUrl && (
                  <section className="rounded-xl border border-[#1a9f9a]/20 bg-teal-50/30 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                        <FileText className="h-3.5 w-3.5 text-[#1a9f9a]" />
                        Specification sheet
                      </p>
                      <button
                        type="button"
                        onClick={() => setSpecsOpen(true)}
                        className="text-[10px] font-semibold text-[#1a9f9a] hover:underline"
                      >
                        Open full sheet
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSpecsOpen(true)}
                      className="group relative w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-left transition hover:border-[#1a9f9a]/40"
                    >
                      <div className="relative h-[110px] sm:h-[130px] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={specSheetUrl}
                          alt="Specification sheet preview"
                          className="w-full h-auto min-h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/80 to-transparent" />
                      </div>
                      <p className="px-3 py-2 text-[10px] text-neutral-500 border-t border-neutral-100">
                        Tap to view the full specification sheet
                      </p>
                    </button>
                  </section>
                )}

                {/* Terms preview */}
                <section className="rounded-xl border border-neutral-100 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                      <ScrollText className="h-3.5 w-3.5 text-[#1a9f9a]" />
                      Terms & conditions
                    </p>
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      className="text-[10px] font-semibold text-[#1a9f9a] hover:underline"
                    >
                      Read all
                    </button>
                  </div>
                  <p className="text-xs font-bold text-neutral-800 mb-1">{parsedTerms.title}</p>
                  {parsedTerms.intro.length > 0 && (
                    <p className="text-[11px] text-neutral-500 leading-relaxed mb-2 line-clamp-2">
                      {parsedTerms.intro[0]}
                    </p>
                  )}
                  <ul className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {termsPreview.map((bullet, i) => (
                      <li key={i} className="flex gap-2 text-[11px] text-neutral-600 leading-snug">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#1a9f9a]" />
                        <span>{bullet.replace(/^[➤•*-]\s*/, "")}</span>
                      </li>
                    ))}
                  </ul>
                  {parsedTerms.bullets.length > termsPreview.length && (
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      className="mt-2 text-[10px] font-medium text-neutral-500 hover:text-[#1a9f9a]"
                    >
                      + {parsedTerms.bullets.length - termsPreview.length} more terms
                    </button>
                  )}
                </section>

                {/* Documents */}
                {(brochureUrl || userManualUrl || hasProductSpecs(product)) && (
                  <section className="flex flex-wrap gap-2">
                    {hasProductSpecs(product) && !specSheetUrl && (
                      <button
                        type="button"
                        onClick={() => setSpecsOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-medium text-neutral-700 transition hover:border-[#1a9f9a]/40 hover:text-[#1a9f9a]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Full specifications
                      </button>
                    )}
                    {brochureUrl && (
                      <a
                        href={brochureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-medium text-neutral-700 transition hover:border-[#1a9f9a]/40 hover:text-[#1a9f9a]"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Brochure
                      </a>
                    )}
                    {userManualUrl && (
                      <a
                        href={userManualUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-medium text-neutral-700 transition hover:border-[#1a9f9a]/40 hover:text-[#1a9f9a]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        User manual
                      </a>
                    )}
                  </section>
                )}
              </div>

              {/* Sticky footer actions */}
              <div className="shrink-0 border-t border-neutral-100 bg-white/95 px-5 py-4 sm:px-6 flex flex-wrap items-center gap-3 backdrop-blur-sm">
                <Link
                  href={`/products/${productId}`}
                  onClick={close}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:opacity-95 active:scale-[0.98]"
                  style={{ backgroundColor: "#1a9f9a" }}
                >
                  View product details
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 active:scale-[0.98]"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProductSpecsModal
        open={specsOpen}
        onClose={() => setSpecsOpen(false)}
        product={specsPayload}
        focusSpecSheet={Boolean(specSheetUrl)}
      />

      <ProductTermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        productName={display.title}
        termsDisplay={termsDisplay}
      />
    </>
  )
}
