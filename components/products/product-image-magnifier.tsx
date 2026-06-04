"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ZoomIn } from "lucide-react"
import { ProductThumbnail } from "@/components/products/product-thumbnail"

const ZOOM = 2.75
const LENS_SIZE = 140

type Props = {
  src: string
  alt: string
  onOpenLightbox?: () => void
}

export function ProductImageMagnifier({ src, alt, onOpenLightbox }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [active, setActive] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [failed, setFailed] = useState(false)

  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setSize({ w: el.clientWidth, h: el.clientHeight })
  }, [])

  useEffect(() => {
    measure()
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, src])

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = clientX - r.left
    const y = clientY - r.top
    setPos({ x, y })
  }

  const handleMove = (e: React.MouseEvent) => {
    updateFromClient(e.clientX, e.clientY)
  }

  const handleTouch = (e: React.TouchEvent) => {
    const t = e.touches[0]
    if (t) updateFromClient(t.clientX, t.clientY)
  }

  const lensHalf = LENS_SIZE / 2
  const lensLeft = Math.max(0, Math.min(size.w - LENS_SIZE, pos.x - lensHalf))
  const lensTop = Math.max(0, Math.min(size.h - LENS_SIZE, pos.y - lensHalf))

  const bgW = size.w * ZOOM
  const bgH = size.h * ZOOM
  const bgPosX = -(pos.x * ZOOM - lensHalf)
  const bgPosY = -(pos.y * ZOOM - lensHalf)

  if (failed) {
    return (
      <div className="relative aspect-square w-full max-w-[360px] mx-auto md:mx-0 rounded-2xl bg-neutral-50 border border-neutral-200/80 overflow-hidden">
        <ProductThumbnail src={null} alt={alt} fill />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full max-w-[360px] mx-auto md:mx-0 rounded-2xl bg-gradient-to-br from-white to-neutral-50 border border-neutral-200/80 overflow-hidden shadow-sm cursor-crosshair touch-none"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onMouseMove={handleMove}
      onTouchStart={e => {
        setActive(true)
        handleTouch(e)
      }}
      onTouchMove={handleTouch}
      onTouchEnd={() => setActive(false)}
      onClick={onOpenLightbox}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") onOpenLightbox?.()
      }}
      aria-label={`${alt}. Move pointer to magnify. Click for full size.`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-contain p-5 pointer-events-none select-none"
        draggable={false}
        onError={() => setFailed(true)}
      />

      {active && size.w > 0 && (
        <div
          className="pointer-events-none absolute z-[2] rounded-full border-[3px] border-white shadow-[0_8px_32px_rgba(0,0,0,0.22)] ring-2 ring-[#1a9f9a]/40 overflow-hidden"
          style={{
            width: LENS_SIZE,
            height: LENS_SIZE,
            left: lensLeft,
            top: lensTop,
          }}
        >
          <div
            className="w-full h-full bg-no-repeat bg-white"
            style={{
              backgroundImage: `url(${src})`,
              backgroundSize: `${bgW}px ${bgH}px`,
              backgroundPosition: `${bgPosX}px ${bgPosY}px`,
            }}
          />
        </div>
      )}

      <span
        className={`absolute bottom-3 right-3 z-[3] flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-md border border-neutral-100 transition-opacity pointer-events-none ${
          active ? "opacity-0" : "opacity-100"
        }`}
      >
        <ZoomIn className="w-3.5 h-3.5 text-[#1a9f9a]" />
        Move to magnify · Click to enlarge
      </span>
    </div>
  )
}
