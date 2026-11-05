"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/** Compact macOS-style label on hover — below (navbar) or to the right (collapsed sidebar). */
export function NavTooltip({
  label,
  children,
  className,
  side = "bottom",
}: {
  label: string
  children: React.ReactNode
  className?: string
  side?: "bottom" | "right"
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  function place() {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (side === "right") {
      setPos({ top: r.top + r.height / 2, left: r.right + 10 })
    } else {
      setPos({ top: r.bottom + 8, left: r.left + r.width / 2 })
    }
  }

  const tip =
    show &&
    (side === "right" && mounted ? (
      createPortal(
        <div
          className="pointer-events-none fixed z-[80] -translate-y-1/2 whitespace-nowrap rounded-[8px] bg-[#1d1d1f] px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em] text-white shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {label}
          <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-[#1d1d1f]" />
        </div>,
        document.body,
      )
    ) : side === "bottom" ? (
      <div
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[60] -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-[#1d1d1f] px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em] text-white shadow-lg"
      >
        {label}
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#1d1d1f]" />
      </div>
    ) : null)

  return (
    <div
      ref={wrapRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => {
        place()
        setShow(true)
      }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {tip}
    </div>
  )
}
