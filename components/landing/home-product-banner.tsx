"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Sparkles, X } from "lucide-react"
import { getProductDisplayName } from "@/lib/product-display-name"
import { formatProductPrice, shouldRequestQuote } from "@/lib/product-display"
import { getProductImageList, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-image"

type BannerDealProduct = {
  id: string
  name: string
  model?: string
  price?: number | string | null
  compareAtPrice?: number | string | null
  quoteMode?: boolean
  images?: string[]
  dealPrice: number | null
  wasPrice: number | null
  publicPath: string
}

const SESSION_KEY = "voltrix-home-deal-dismissed"
const ANIM_MS = 280

type AnimPhase = "enter" | "open" | "exit"

function dealSignature(products: BannerDealProduct[]) {
  return products
    .map((p) => `${p.id}:${p.dealPrice ?? ""}`)
    .join("|")
}

function pctOff(was: number, deal: number) {
  if (!(was > 0) || !(deal > 0) || deal >= was) return null
  return Math.round(((was - deal) / was) * 100)
}

export default function HomeProductBanner() {
  const [products, setProducts] = useState<BannerDealProduct[]>([])
  const [dealLabel, setDealLabel] = useState("Deal")
  const [headline, setHeadline] = useState("")
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
        const sig = dealSignature(list)
        if (sessionStorage.getItem(`${SESSION_KEY}:${sig}`) === "1") return
        signatureRef.current = sig
        setProducts(list)
        setDealLabel(String(data.dealLabel || "Deal"))
        setHeadline(String(data.headline || ""))
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

  if (!mounted || products.length === 0) return null

  const isOpen = animPhase === "open"
  const multi = products.length > 1
  const primaryHref = products[0]?.publicPath?.startsWith("/products/")
    ? products[0].publicPath
    : "/products"
  const ctaHref = multi ? "/products" : primaryHref
  const ctaLabel = multi ? "Shop this deal" : "View offer"

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
        className={`relative w-full max-w-[440px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.96] translate-y-4"
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.28)] ring-1 ring-black/5">
          {/* Accent strip */}
          <div className="h-1 w-full bg-gradient-to-r from-[#0d7370] via-[#1a9f9a] to-[#0d7370]" />

          <div className="relative px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4">
            <button
              type="button"
              onClick={close}
              className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 flex items-start justify-between gap-3 pr-8">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1a9f9a]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0d7370]">
                  <Sparkles className="h-3 w-3" />
                  {dealLabel}
                </div>
                <h2
                  id="home-banner-title"
                  className="mt-2 text-[1.15rem] font-bold leading-snug tracking-tight text-neutral-900 sm:text-xl"
                >
                  {headline || (multi ? `${dealLabel} — save more together` : "Limited-time offer")}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {multi
                    ? `${products.length} products · deal prices while stocks last`
                    : "Special homepage price"}
                </p>
              </div>
              <Image
                src="/logo.png"
                alt="Voltrix"
                width={88}
                height={26}
                className="mt-0.5 h-6 w-auto shrink-0 opacity-90"
                priority
              />
            </div>

            <ul className="space-y-2.5">
              {products.map((p, index) => {
                const display = getProductDisplayName({
                  name: p.name,
                  model: p.model,
                })
                const images = getProductImageList(p)
                const img = images[0] ?? PRODUCT_IMAGE_FALLBACK
                const quote = shouldRequestQuote({
                  quoteMode: Boolean(p.quoteMode),
                  price: p.dealPrice ?? p.price,
                })
                const deal = p.dealPrice
                const was = p.wasPrice
                const off = deal != null && was != null ? pctOff(was, deal) : null
                const href = p.publicPath?.startsWith("/products/") ? p.publicPath : "/products"

                return (
                  <li key={p.id}>
                    <Link
                      href={href}
                      onClick={close}
                      className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-2.5 transition hover:border-[#1a9f9a]/35 hover:bg-[#1a9f9a]/[0.04]"
                    >
                      <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
                        <Image
                          src={img}
                          alt={display.title || "Product"}
                          fill
                          className="object-contain p-1.5 transition duration-300 group-hover:scale-[1.04]"
                          sizes="68px"
                          priority={index === 0}
                          unoptimized={img.startsWith("/uploads/")}
                        />
                        {off != null && off > 0 && (
                          <span className="absolute left-1 top-1 rounded bg-rose-500 px-1 py-0.5 text-[9px] font-bold text-white shadow-sm">
                            −{off}%
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {display.title}
                        </p>
                        {display.model ? (
                          <p className="truncate font-mono text-[10px] text-neutral-400">
                            {display.model}
                          </p>
                        ) : null}

                        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {quote ? (
                            <span className="text-sm font-semibold text-neutral-600">
                              Request quote
                            </span>
                          ) : deal != null ? (
                            <>
                              {was != null && (
                                <span className="text-xs text-neutral-400 line-through decoration-neutral-400/80">
                                  {formatProductPrice(was)}
                                </span>
                              )}
                              <span className="text-lg font-bold tracking-tight text-[#0d7370] sm:text-xl">
                                {formatProductPrice(deal)}
                              </span>
                            </>
                          ) : (
                            <span className="text-lg font-bold tracking-tight text-neutral-900 sm:text-xl">
                              {formatProductPrice(p.price) || "—"}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <Link
              href={ctaHref}
              onClick={close}
              className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9f9a] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#1a9f9a]/25 transition hover:bg-[#158a86] active:scale-[0.98]"
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
