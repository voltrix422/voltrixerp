"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

type PartyBit = {
  id: number
  left: string
  delay: string
  duration: string
  size: number
  rotate: number
  color: string
  kind: "rect" | "circle" | "ribbon"
}

function makePartyBits(side: "left" | "right", count: number): PartyBit[] {
  const colors = ["#ffffff", "#86efac", "#01411C", "#bbf7d0", "#fef08a", "#fde68a"]
  return Array.from({ length: count }, (_, i) => {
    const spread = side === "left" ? 8 + (i % 7) * 7 : 100 - (8 + (i % 7) * 7)
    return {
      id: i,
      left: `${spread}%`,
      delay: `${80 + i * 28}ms`,
      duration: `${1100 + (i % 5) * 180}ms`,
      size: 5 + (i % 4) * 2,
      rotate: (side === "left" ? -1 : 1) * (20 + (i % 8) * 18),
      color: colors[i % colors.length],
      kind: (["rect", "circle", "ribbon"] as const)[i % 3],
    }
  })
}

function PartyBurst({ side, active }: { side: "left" | "right"; active: boolean }) {
  const bits = useMemo(() => makePartyBits(side, 20), [side])
  const origin = side === "left" ? "-left-8 -bottom-6" : "-right-8 -bottom-6"
  const dir = side === "left" ? 1 : -1

  return (
    <div
      className={`pointer-events-none absolute ${origin} z-[5] h-56 w-56 overflow-visible`}
      aria-hidden
    >
      {/* Party popper body */}
      <div
        className={`absolute bottom-8 transition-all duration-500 ${
          side === "left" ? "left-6" : "right-6"
        } ${
          active
            ? `opacity-100 translate-y-0 ${side === "left" ? "rotate-[-22deg]" : "rotate-[22deg]"}`
            : "opacity-0 translate-y-5 rotate-0"
        }`}
      >
        <div className="relative h-11 w-8">
          <div className="absolute inset-x-0 bottom-0 h-8 rounded-b-md bg-gradient-to-b from-[#016b2f] to-[#013a18] shadow-lg ring-1 ring-white/20" />
          <div className="absolute left-1/2 top-0 h-4 w-9 -translate-x-1/2 rounded-t-[10px] bg-white shadow-sm" />
          <div className="absolute left-1/2 top-3.5 h-1.5 w-5 -translate-x-1/2 rounded-sm bg-emerald-300" />
          <div className="absolute left-1/2 top-[18px] h-px w-3 -translate-x-1/2 bg-white/50" />
        </div>
      </div>

      {/* Confetti + ribbons */}
      {bits.map((b) => {
        const angle = ((b.id % 10) - 4.5) * 11 * dir
        const dist = 70 + (b.id % 6) * 16
        const dx = Math.sin((angle * Math.PI) / 180) * dist
        const dy = -Math.cos((angle * Math.PI) / 180) * dist - 20
        return (
          <span
            key={b.id}
            className="absolute bottom-14 block"
            style={{
              left: side === "left" ? "28%" : "auto",
              right: side === "right" ? "28%" : "auto",
              width: b.kind === "ribbon" ? 3 : b.size,
              height: b.kind === "ribbon" ? b.size * 2.6 : b.kind === "circle" ? b.size : b.size * 0.65,
              borderRadius: b.kind === "circle" ? "999px" : "2px",
              backgroundColor: b.color,
              opacity: active ? 1 : 0,
              transform: active
                ? `translate(${dx}px, ${dy}px) rotate(${b.rotate}deg)`
                : "translate(0px, 0px) rotate(0deg) scale(0.35)",
              transition: `transform ${b.duration} cubic-bezier(0.16, 1, 0.3, 1) ${b.delay}, opacity 240ms ease ${b.delay}`,
              boxShadow: b.color === "#ffffff" ? "0 0 10px rgba(255,255,255,0.5)" : undefined,
            }}
          />
        )
      })}
    </div>
  )
}

function PopupFlares({ active }: { active: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-visible" aria-hidden>
      {/* Soft radial glow behind card */}
      <div
        className={`absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(134,239,172,0.28)_0%,rgba(1,65,28,0.12)_42%,transparent_70%)] transition-opacity duration-700 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Diagonal light flares */}
      <div
        className={`absolute left-1/2 top-1/2 h-[2px] w-[140%] -translate-x-1/2 -translate-y-1/2 rotate-[28deg] bg-gradient-to-r from-transparent via-white/55 to-transparent blur-[1px] transition-all duration-700 ${
          active ? "opacity-70 scale-x-100" : "opacity-0 scale-x-50"
        }`}
      />
      <div
        className={`absolute left-1/2 top-1/2 h-[2px] w-[120%] -translate-x-1/2 -translate-y-1/2 -rotate-[32deg] bg-gradient-to-r from-transparent via-emerald-200/50 to-transparent blur-[1px] transition-all duration-700 delay-100 ${
          active ? "opacity-60 scale-x-100" : "opacity-0 scale-x-50"
        }`}
      />
      <div
        className={`absolute left-1/2 top-1/2 h-[1px] w-[90%] -translate-x-1/2 -translate-y-1/2 rotate-[8deg] bg-gradient-to-r from-transparent via-white/35 to-transparent transition-all duration-700 delay-150 ${
          active ? "opacity-50 scale-x-100" : "opacity-0 scale-x-40"
        }`}
      />

      {/* Corner spark bursts */}
      {[
        "left-[8%] top-[18%]",
        "right-[10%] top-[16%]",
        "left-[12%] bottom-[22%]",
        "right-[11%] bottom-[20%]",
      ].map((pos, i) => (
        <span
          key={pos}
          className={`absolute ${pos} h-2 w-2 rounded-full bg-white shadow-[0_0_18px_6px_rgba(255,255,255,0.55)] transition-all duration-500 ${
            active ? "opacity-80 scale-100" : "opacity-0 scale-0"
          }`}
          style={{ transitionDelay: `${180 + i * 90}ms` }}
        />
      ))}
    </div>
  )
}

export default function HomeProductBanner() {
  const [product, setProduct] = useState<BannerProduct | null>(null)
  const [mounted, setMounted] = useState(false)
  const [animPhase, setAnimPhase] = useState<AnimPhase>("enter")
  const [fxOn, setFxOn] = useState(false)
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
    setFxOn(false)
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
      requestAnimationFrame(() => {
        setAnimPhase("open")
        const reduce =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (!reduce) setFxOn(true)
      })
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
        className={`relative w-full max-w-[420px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.94] translate-y-5"
        }`}
      >
        <PopupFlares active={fxOn} />
        <PartyBurst side="left" active={fxOn} />
        <PartyBurst side="right" active={fxOn} />

        <div className="relative z-10 overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/15">
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

          {/* Inner shimmer flare */}
          <div
            className={`pointer-events-none absolute -left-1/3 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 ${
              fxOn ? "translate-x-[220%]" : "translate-x-0"
            }`}
          />

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
    </div>
  )
}
