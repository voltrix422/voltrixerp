"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Sparkles, X } from "lucide-react"
import { getProductDisplayName } from "@/lib/product-display-name"
import { formatProductPrice } from "@/lib/product-display"
import { getProductImageList, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-image"

type BannerDealProduct = {
  id: string
  name: string
  model?: string
  images?: string[]
  catalogPrice: number | null
  publicPath: string
}

const SESSION_KEY = "voltrix-home-deal-dismissed"
const ANIM_MS = 320

type AnimPhase = "enter" | "open" | "exit"

function dealSignature(productIds: string[], bundleDealPrice: number | null) {
  return `${productIds.join(",")}:${bundleDealPrice ?? ""}`
}

export default function HomeProductBanner() {
  const [products, setProducts] = useState<BannerDealProduct[]>([])
  const [dealLabel, setDealLabel] = useState("Deal")
  const [headline, setHeadline] = useState("")
  const [bundleWasTotal, setBundleWasTotal] = useState<number | null>(null)
  const [bundleDealPrice, setBundleDealPrice] = useState<number | null>(null)
  const [bundlePctOff, setBundlePctOff] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [animPhase, setAnimPhase] = useState<AnimPhase>("enter")
  const closingRef = useRef(false)
  const signatureRef = useRef("")

  useEffect(() => {
    fetch("/api/site/home-banner", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.enabled) return
        const list = Array.isArray(data.products) ? (data.products as BannerDealProduct[]) : []
        if (list.length === 0) return
        const deal = data.bundleDealPrice != null ? Number(data.bundleDealPrice) : null
        if (deal == null || !(deal > 0)) return
        const sig = dealSignature(
          list.map((p) => p.id),
          deal,
        )
        if (sessionStorage.getItem(`${SESSION_KEY}:${sig}`) === "1") return
        signatureRef.current = sig
        setProducts(list)
        setDealLabel(String(data.dealLabel || "Deal"))
        setHeadline(String(data.headline || ""))
        setBundleWasTotal(data.bundleWasTotal != null ? Number(data.bundleWasTotal) : null)
        setBundleDealPrice(deal)
        setBundlePctOff(data.bundlePctOff != null ? Number(data.bundlePctOff) : null)
        setMounted(true)
      })
      .catch(() => {})
  }, [])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnimPhase("exit")
    if (signatureRef.current) {
      sessionStorage.setItem(`${SESSION_KEY}:${signatureRef.current}`, "1")
    }
    window.setTimeout(() => {
      setMounted(false)
      setProducts([])
    }, ANIM_MS)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const r1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimPhase("open"))
    })
    return () => cancelAnimationFrame(r1)
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

  if (!mounted || products.length === 0 || bundleDealPrice == null) return null

  const isOpen = animPhase === "open"
  const multi = products.length > 1
  const count = products.length
  const ctaHref = "/products"
  const ctaLabel = multi ? "Grab this bundle" : "View offer"

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-banner-title"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-neutral-950/60 backdrop-blur-[4px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={close}
        aria-label="Close deal popup"
      />

      <div
        className={`relative w-full max-w-5xl max-h-[92dvh] sm:max-h-[90vh] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.97] translate-y-6"
        }`}
      >
        <div className="relative flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.35)] ring-1 ring-black/5 sm:max-h-[90vh] sm:rounded-3xl">
          <div className="h-1 w-full shrink-0 bg-gradient-to-r from-[#0d7370] via-[#1a9f9a] to-[#0d7370] sm:h-1.5" />

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-3 sm:px-8 sm:pb-8 sm:pt-6 md:px-10">
            <button
              type="button"
              onClick={close}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800 sm:right-5 sm:top-5 sm:h-10 sm:w-10"
              aria-label="Close"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Header */}
            <div className="flex items-start justify-between gap-3 pr-9 sm:pr-12">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1a9f9a]/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0d7370] sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-xs sm:tracking-[0.14em]">
                  <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {dealLabel}
                </div>
                <h2
                  id="home-banner-title"
                  className="mt-1.5 text-lg font-bold leading-snug tracking-tight text-neutral-900 sm:mt-3 sm:text-3xl md:text-4xl"
                >
                  {headline || (multi ? "Bundle Offer" : "Special Offer")}
                </h2>
              </div>
              <Image
                src="/logo.png"
                alt="Voltrix"
                width={140}
                height={42}
                className="mt-0.5 hidden h-8 w-auto shrink-0 opacity-95 sm:mt-1 sm:block md:h-10"
                priority
              />
            </div>

            {/* Products — compact rows on mobile, cards on desktop */}
            <div
              className={`mt-3 sm:mt-8 ${
                count === 1
                  ? "mx-auto max-w-md"
                  : count === 2
                    ? "grid gap-2 sm:grid-cols-2 sm:gap-5"
                    : count === 3
                      ? "grid gap-2 sm:grid-cols-3 sm:gap-5"
                      : "grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-5"
              }`}
            >
              {products.map((p, index) => {
                const display = getProductDisplayName({ name: p.name, model: p.model })
                const images = getProductImageList(p)
                const img = images[0] ?? PRODUCT_IMAGE_FALLBACK

                // Mobile: horizontal compact row for 1–3 products
                if (count <= 3) {
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/80 p-2 sm:flex-col sm:items-center sm:gap-0 sm:rounded-2xl sm:bg-gradient-to-b sm:from-neutral-50 sm:to-white sm:p-5"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white sm:mb-0 sm:aspect-square sm:h-auto sm:w-full sm:max-h-[220px] sm:rounded-xl">
                        <Image
                          src={img}
                          alt={display.title || "Product"}
                          fill
                          className="object-contain p-1 sm:p-4"
                          sizes={count <= 2 ? "(max-width: 640px) 56px, 420px" : "(max-width: 640px) 56px, 220px"}
                          priority={index < 2}
                          unoptimized={img.startsWith("/uploads/")}
                        />
                      </div>
                      <div className="min-w-0 flex-1 sm:mt-4 sm:w-full sm:text-center">
                        <p className="truncate text-sm font-semibold leading-snug text-neutral-900 sm:whitespace-normal sm:text-lg sm:font-bold md:text-xl">
                          {display.title}
                        </p>
                        {display.model ? (
                          <p className="mt-0.5 truncate font-mono text-[10px] text-neutral-400 sm:mt-1 sm:text-sm">
                            {display.model}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                }

                // 4+ products: small grid tiles on mobile
                return (
                  <div
                    key={p.id}
                    className="flex flex-col items-center rounded-xl border border-neutral-100 bg-neutral-50/80 p-2 sm:rounded-2xl sm:bg-gradient-to-b sm:from-neutral-50 sm:to-white sm:p-5"
                  >
                    <div className="relative aspect-square w-full max-h-[88px] overflow-hidden rounded-lg bg-white sm:max-h-[180px] sm:rounded-xl">
                      <Image
                        src={img}
                        alt={display.title || "Product"}
                        fill
                        className="object-contain p-1.5 sm:p-4"
                        sizes="(max-width: 640px) 45vw, 220px"
                        priority={index < 2}
                        unoptimized={img.startsWith("/uploads/")}
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-2 w-full text-center text-[11px] font-semibold leading-snug text-neutral-900 sm:mt-4 sm:text-base sm:font-bold md:text-lg">
                      {display.title}
                    </p>
                    {display.model ? (
                      <p className="mt-0.5 truncate font-mono text-[9px] text-neutral-400 sm:text-sm">
                        {display.model}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {/* Price + CTA — compact on mobile */}
            <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-[#1a9f9a]/25 bg-gradient-to-r from-[#1a9f9a]/[0.07] via-white to-[#1a9f9a]/[0.07] px-3 py-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:rounded-2xl sm:px-8 sm:py-6">
              <div className="text-center sm:text-left">
                {bundlePctOff != null && bundlePctOff > 0 && (
                  <span className="mb-1 inline-block rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:mb-2 sm:px-3 sm:py-1 sm:text-sm">
                    Save {bundlePctOff}%
                  </span>
                )}
                <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 sm:justify-start sm:gap-x-3">
                  {bundleWasTotal != null && bundleWasTotal > 0 && (
                    <span className="text-sm text-neutral-400 line-through decoration-2 sm:text-2xl md:text-3xl">
                      {formatProductPrice(bundleWasTotal)}
                    </span>
                  )}
                  <span className="text-2xl font-bold tracking-tight text-[#0d7370] sm:text-4xl md:text-5xl">
                    {formatProductPrice(bundleDealPrice)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-500 sm:mt-1.5 sm:text-base">
                  {multi
                    ? `All ${products.length} items · one bundle price`
                    : "Homepage deal price"}
                </p>
              </div>

              <Link
                href={ctaHref}
                onClick={close}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1a9f9a] px-5 py-3 text-sm font-bold text-white shadow-md shadow-[#1a9f9a]/25 transition hover:bg-[#158a86] active:scale-[0.98] sm:w-auto sm:rounded-2xl sm:px-8 sm:py-4 sm:text-lg sm:shadow-lg sm:shadow-[#1a9f9a]/30"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
