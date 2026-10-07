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
const ANIM_MS = 280

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
  const ctaHref = "/products"
  const ctaLabel = multi ? "Grab this bundle" : "View offer"

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-banner-title"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-neutral-950/55 backdrop-blur-[3px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={close}
        aria-label="Close deal popup"
      />

      <div
        className={`relative w-full max-w-[400px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.96] translate-y-4"
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.28)] ring-1 ring-black/5">
          <div className="h-1 w-full bg-gradient-to-r from-[#0d7370] via-[#1a9f9a] to-[#0d7370]" />

          <div className="relative px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <button
              type="button"
              onClick={close}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start justify-between gap-2 pr-7">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1a9f9a]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0d7370]">
                  <Sparkles className="h-3 w-3" />
                  {dealLabel}
                </div>
                <h2
                  id="home-banner-title"
                  className="mt-2 text-base font-bold leading-snug text-neutral-900 sm:text-lg"
                >
                  {headline || (multi ? "Bundle offer" : "Special offer")}
                </h2>
              </div>
              <Image
                src="/logo.png"
                alt="Voltrix"
                width={80}
                height={24}
                className="h-5 w-auto shrink-0 opacity-90"
                priority
              />
            </div>

            {/* Product thumbnails row */}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {products.map((p, index) => {
                const display = getProductDisplayName({ name: p.name, model: p.model })
                const images = getProductImageList(p)
                const img = images[0] ?? PRODUCT_IMAGE_FALLBACK
                return (
                  <div
                    key={p.id}
                    className="flex w-[calc(50%-4px)] min-w-[140px] max-w-[48%] items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50/80 p-1.5 sm:w-auto sm:max-w-[170px]"
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-black/5">
                      <Image
                        src={img}
                        alt={display.title || "Product"}
                        fill
                        className="object-contain p-0.5"
                        sizes="44px"
                        priority={index === 0}
                        unoptimized={img.startsWith("/uploads/")}
                      />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight text-neutral-800">
                      {display.title}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* One bundle price */}
            <div className="mt-4 rounded-xl border border-[#1a9f9a]/20 bg-gradient-to-b from-[#1a9f9a]/5 to-white px-4 py-3 text-center">
              {bundlePctOff != null && bundlePctOff > 0 && (
                <span className="mb-1 inline-block rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  Save {bundlePctOff}%
                </span>
              )}
              <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0">
                {bundleWasTotal != null && bundleWasTotal > 0 && (
                  <span className="text-base text-neutral-400 line-through decoration-neutral-400/90">
                    {formatProductPrice(bundleWasTotal)}
                  </span>
                )}
                <span className="text-2xl font-bold tracking-tight text-[#0d7370] sm:text-3xl">
                  {formatProductPrice(bundleDealPrice)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">
                {multi
                  ? `All ${products.length} items · one bundle price`
                  : "Homepage deal price"}
              </p>
            </div>

            <Link
              href={ctaHref}
              onClick={close}
              className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9f9a] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#1a9f9a]/20 transition hover:bg-[#158a86] active:scale-[0.98]"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
