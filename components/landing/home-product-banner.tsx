"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  FileText,
  Shield,
  Sparkles,
  Tag,
  X,
} from "lucide-react"
import ProductSpecsModal from "@/components/products/product-specs-modal"
import { ProductPriceDisplay } from "@/components/products/product-price-display"
import { getCategoryDisplayLabel } from "@/lib/product-categories"
import { getProductDisplayName } from "@/lib/product-display-name"
import { shouldRequestQuote } from "@/lib/product-display"
import { getProductImageList, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-image"
import { hasProductSpecs, normalizeSpecRows } from "@/lib/product-specs"

type BannerProduct = Record<string, unknown>

const SESSION_KEY_PREFIX = "voltrix-home-banner-dismissed"

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
  const [visible, setVisible] = useState(false)
  const [specsOpen, setSpecsOpen] = useState(false)

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
        setVisible(true)
      })
      .catch(() => {})
  }, [])

  const close = () => {
    if (product?.id) {
      sessionStorage.setItem(`${SESSION_KEY_PREFIX}-${String(product.id)}`, "1")
    }
    setVisible(false)
  }

  if (!visible || !product) return null

  const display = getProductDisplayName({
    name: String(product.name ?? ""),
    model: product.model != null ? String(product.model) : undefined,
  })
  const images = getProductImageList(product)
  const heroImage = images[0] ?? PRODUCT_IMAGE_FALLBACK
  const category = getCategoryDisplayLabel(String(product.category ?? ""))
  const specRows = normalizeSpecRows(product.specs)
  const warranty = String(product.warranty ?? "").trim()
  const description =
    String(product.full_desc || product.description || "").trim() ||
    "Explore this Voltrix product — engineered for reliable home and solar energy storage."
  const specification = String(product.specification ?? "").trim()
  const stock = stockLabel(product.stock)
  const quoteMode = shouldRequestQuote({
    quoteMode: Boolean(product.quoteMode),
    price: product.price as number | string | null,
  })
  const productId = String(product.id)
  const specsPayload = {
    name: display.title,
    category: String(product.category ?? ""),
    description: String(product.description ?? ""),
    full_desc: String(product.full_desc ?? ""),
    warranty,
    specification,
    specSheetUrl: product.specSheetUrl ? String(product.specSheetUrl) : undefined,
    specs: product.specs,
    images,
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-banner-title"
      >
        <button
          type="button"
          className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm"
          onClick={close}
          aria-label="Close featured product banner"
        />

        <div className="relative w-full max-w-5xl max-h-[min(92vh,820px)] overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-white shadow-2xl shadow-neutral-900/30 animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1a9f9a] via-teal-400 to-emerald-400" />

          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-600 shadow-sm transition hover:bg-neutral-50 hover:text-neutral-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="grid max-h-[min(92vh,820px)] grid-cols-1 overflow-y-auto lg:grid-cols-12 lg:overflow-hidden">
            {/* Product image */}
            <div className="relative lg:col-span-5 bg-gradient-to-br from-neutral-50 via-white to-teal-50/40 p-5 sm:p-6 lg:p-8 flex items-center justify-center min-h-[240px] lg:min-h-0">
              <div className="absolute left-5 top-5 flex items-center gap-1.5 rounded-full border border-[#1a9f9a]/20 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#1a9f9a]">
                <Sparkles className="h-3 w-3" />
                Featured offer
              </div>
              <div className="relative aspect-square w-full max-w-[340px]">
                <Image
                  src={heroImage}
                  alt={display.title || "Featured product"}
                  fill
                  className="object-contain p-2 drop-shadow-lg"
                  priority
                  unoptimized={heroImage.startsWith("/uploads/")}
                />
              </div>
            </div>

            {/* Details */}
            <div className="lg:col-span-7 flex flex-col p-5 sm:p-6 lg:p-8 lg:overflow-y-auto">
              <div className="space-y-3">
                {category ? (
                  <p className="text-[11px] font-medium uppercase tracking-widest text-[#1a9f9a]">
                    {category}
                  </p>
                ) : null}

                <div>
                  <h2 id="home-banner-title" className="text-2xl sm:text-3xl font-bold text-neutral-900 leading-tight">
                    {display.title}
                  </h2>
                  {display.model ? (
                    <p className="mt-1 font-mono text-xs text-neutral-500">{display.model}</p>
                  ) : null}
                </div>

                <p className="text-sm text-neutral-600 leading-relaxed line-clamp-3">{description}</p>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${stock.cls}`}>
                    {stock.text}
                  </span>
                  {warranty ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border border-neutral-200 bg-neutral-50 text-neutral-600">
                      <Shield className="h-3 w-3" />
                      {warranty}
                    </span>
                  ) : null}
                </div>

                <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 p-4">
                  {quoteMode ? (
                    <p className="text-sm font-semibold text-neutral-700">Request a quote for pricing</p>
                  ) : (
                    <ProductPriceDisplay product={product} size="lg" />
                  )}
                </div>
              </div>

              {/* Spec rows */}
              {specRows.length > 0 ? (
                <div className="mt-4 rounded-xl border border-neutral-100 p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    <Tag className="h-3.5 w-3.5" />
                    Key specifications
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {specRows.map((row, i) => (
                      <div
                        key={`${row.label}-${i}`}
                        className="rounded-lg border border-neutral-100 bg-white px-2.5 py-2 min-w-0"
                      >
                        <p className="text-[10px] text-neutral-400 truncate">{row.label}</p>
                        <p className="text-xs font-semibold text-neutral-800 truncate">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : specification ? (
                <div className="mt-4 rounded-xl border border-neutral-100 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    Specifications
                  </p>
                  <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-line">{specification}</p>
                </div>
              ) : null}

              {/* Spec sheet preview */}
              {product.specSheetUrl ? (
                <button
                  type="button"
                  onClick={() => setSpecsOpen(true)}
                  className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-[#1a9f9a]/30 bg-teal-50/40 p-3 text-left transition hover:border-[#1a9f9a]/50 hover:bg-teal-50/70 w-full"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={String(product.specSheetUrl)}
                      alt="Spec sheet preview"
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                      <FileText className="h-3.5 w-3.5 text-[#1a9f9a]" />
                      View full spec sheet
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Tap to open detailed specifications</p>
                  </div>
                </button>
              ) : hasProductSpecs(product) ? (
                <button
                  type="button"
                  onClick={() => setSpecsOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a9f9a] hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View specifications
                </button>
              ) : null}

              {/* Actions */}
              <div className="mt-5 flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={`/products/${productId}`}
                  onClick={close}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/10 transition hover:opacity-95"
                  style={{ backgroundColor: "#1a9f9a" }}
                >
                  View product details
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
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
        focusSpecSheet={Boolean(product.specSheetUrl)}
      />
    </>
  )
}
