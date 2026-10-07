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
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 md:p-8"
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
        className={`relative w-full max-w-5xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.97] translate-y-6"
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.35)] ring-1 ring-black/5 sm:rounded-3xl">
          {/* Banner accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0d7370] via-[#1a9f9a] to-[#0d7370]" />

          <div className="relative px-4 pb-5 pt-4 sm:px-8 sm:pb-8 sm:pt-6 md:px-10">
            <button
              type="button"
              onClick={close}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800 sm:right-5 sm:top-5"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header row */}
            <div className="flex flex-col items-center gap-3 pr-10 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#1a9f9a]/12 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#0d7370]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {dealLabel}
                </div>
                <h2
                  id="home-banner-title"
                  className="mt-3 text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl md:text-4xl"
                >
                  {headline || (multi ? "Bundle Offer" : "Special Offer")}
                </h2>
              </div>
              <Image
                src="/logo.png"
                alt="Voltrix"
                width={140}
                height={42}
                className="hidden h-8 w-auto shrink-0 opacity-95 sm:mt-1 sm:block md:h-10"
                priority
              />
            </div>

            {/* Large product cards */}
            <div
              className={`mt-6 grid gap-4 sm:mt-8 sm:gap-5 ${
                count === 1
                  ? "mx-auto max-w-md grid-cols-1"
                  : count === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : count === 3
                      ? "grid-cols-1 sm:grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-4"
              }`}
            >
              {products.map((p, index) => {
                const display = getProductDisplayName({ name: p.name, model: p.model })
                const images = getProductImageList(p)
                const img = images[0] ?? PRODUCT_IMAGE_FALLBACK
                return (
                  <div
                    key={p.id}
                    className="flex flex-col items-center rounded-2xl border border-neutral-100 bg-gradient-to-b from-neutral-50 to-white p-4 sm:p-5"
                  >
                    <div
                      className={`relative w-full overflow-hidden rounded-xl bg-white ${
                        count <= 2 ? "aspect-square max-h-[220px] sm:max-h-[260px]" : "aspect-square max-h-[160px] sm:max-h-[180px]"
                      }`}
                    >
                      <Image
                        src={img}
                        alt={display.title || "Product"}
                        fill
                        className="object-contain p-3 sm:p-4"
                        sizes={count <= 2 ? "(max-width: 640px) 90vw, 420px" : "(max-width: 640px) 45vw, 220px"}
                        priority={index < 2}
                        unoptimized={img.startsWith("/uploads/")}
                      />
                    </div>
                    <p
                      className={`mt-4 w-full text-center font-bold leading-snug text-neutral-900 ${
                        count <= 2
                          ? "text-lg sm:text-xl md:text-2xl"
                          : "text-sm sm:text-base md:text-lg"
                      }`}
                    >
                      {display.title}
                    </p>
                    {display.model ? (
                      <p className="mt-1 truncate font-mono text-xs text-neutral-400 sm:text-sm">
                        {display.model}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {/* Big price strip */}
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-[#1a9f9a]/25 bg-gradient-to-r from-[#1a9f9a]/[0.07] via-white to-[#1a9f9a]/[0.07] px-4 py-5 sm:mt-8 sm:flex-row sm:justify-between sm:px-8 sm:py-6">
              <div className="text-center sm:text-left">
                {bundlePctOff != null && bundlePctOff > 0 && (
                  <span className="mb-2 inline-block rounded-full bg-rose-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white sm:text-sm">
                    Save {bundlePctOff}%
                  </span>
                )}
                <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 sm:justify-start">
                  {bundleWasTotal != null && bundleWasTotal > 0 && (
                    <span className="text-xl text-neutral-400 line-through decoration-2 sm:text-2xl md:text-3xl">
                      {formatProductPrice(bundleWasTotal)}
                    </span>
                  )}
                  <span className="text-3xl font-bold tracking-tight text-[#0d7370] sm:text-4xl md:text-5xl">
                    {formatProductPrice(bundleDealPrice)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-neutral-500 sm:text-base">
                  {multi
                    ? `All ${products.length} items · one bundle price`
                    : "Homepage deal price"}
                </p>
              </div>

              <Link
                href={ctaHref}
                onClick={close}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#1a9f9a] px-8 py-4 text-base font-bold text-white shadow-lg shadow-[#1a9f9a]/30 transition hover:bg-[#158a86] active:scale-[0.98] sm:w-auto sm:text-lg"
              >
                {ctaLabel}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
