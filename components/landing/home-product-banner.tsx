"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, X } from "lucide-react"
import { ProductPriceDisplay } from "@/components/products/product-price-display"
import { getProductDisplayName } from "@/lib/product-display-name"
import { cutPricePercentOff, hasCutPrice, shouldRequestQuote } from "@/lib/product-display"
import { getProductImageList, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-image"

type BannerProduct = Record<string, unknown>

const SESSION_KEY_PREFIX = "voltrix-home-banner-dismissed"
const ANIM_MS = 320
const PK_FLAG =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Flag_of_Pakistan.svg/960px-Flag_of_Pakistan.svg.png"

type AnimPhase = "enter" | "open" | "exit"

export default function HomeProductBanner() {
  const [product, setProduct] = useState<BannerProduct | null>(null)
  const [mounted, setMounted] = useState(false)
  const [animPhase, setAnimPhase] = useState<AnimPhase>("enter")
  const closingRef = useRef(false)

  useEffect(() => {
    fetch("/api/site/home-banner", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
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
  const quoteMode = shouldRequestQuote({
    quoteMode: Boolean(product.quoteMode),
    price: product.price as number | string | null,
  })
  const productId = String(product.id)
  const cutPct = hasCutPrice(product) ? cutPricePercentOff(product) : null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-banner-title"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-[#001a0d]/70 backdrop-blur-[5px] transition-opacity duration-300 ease-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={close}
        aria-label="Close Independence Day offer"
      />

      <div
        className={`relative w-full max-w-[420px] overflow-hidden rounded-2xl shadow-2xl shadow-black/50 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.94] translate-y-5"
        }`}
      >
        {/* Flag stripe header */}
        <div className="relative flex h-14 items-stretch overflow-hidden">
          <div className="w-[22%] bg-white" />
          <div className="relative flex flex-1 items-center justify-between gap-2 bg-[#01411C] px-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PK_FLAG}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
            />
            <div className="relative flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PK_FLAG}
                alt="Pakistan flag"
                className="h-7 w-auto rounded-[2px] shadow-sm ring-1 ring-white/30"
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                14 August
              </p>
            </div>
            <Image
              src="/logo.png"
              alt="Voltrix"
              width={96}
              height={28}
              className="relative h-6 w-auto brightness-0 invert"
              priority
            />
          </div>
        </div>

        {/* Body */}
        <div className="relative bg-gradient-to-b from-[#01411C] via-[#025a28] to-[#013a18] px-5 pb-5 pt-4 text-white">
          {/* Soft star/crescent glow */}
          <div className="pointer-events-none absolute -right-10 top-8 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 bottom-10 h-28 w-28 rounded-full bg-emerald-300/10 blur-2xl" />

          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white/90 backdrop-blur-sm transition hover:bg-black/35"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="relative mx-auto mt-1 flex aspect-square w-[78%] max-w-[260px] items-center justify-center">
            <div className="absolute inset-3 rounded-full border border-white/10" />
            <div className="absolute inset-0 rounded-full bg-white/5" />
            {cutPct != null && cutPct > 0 && (
              <span className="absolute -right-1 top-2 z-10 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#01411C] shadow-md">
                −{cutPct}%
              </span>
            )}
            <Image
              src={heroImage}
              alt={display.title || "Featured product"}
              fill
              className="object-contain p-3 drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
              priority
              unoptimized={heroImage.startsWith("/uploads/")}
            />
          </div>

          <div className="relative mt-3 space-y-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/90">
                Independence offer
              </p>
              <h2
                id="home-banner-title"
                className="mt-1 text-lg font-bold leading-snug text-white sm:text-xl"
              >
                {display.title}
              </h2>
            </div>

            <div className="mx-auto inline-flex min-w-[70%] flex-col items-center rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-neutral-900 shadow-lg">
              {quoteMode ? (
                <p className="text-sm font-semibold text-neutral-700">Request a quote</p>
              ) : (
                <ProductPriceDisplay product={product} size="lg" className="justify-center" />
              )}
            </div>

            <Link
              href={`/products/${productId}`}
              onClick={close}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#01411C] shadow-md transition hover:bg-emerald-50 active:scale-[0.98]"
            >
              View product
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
