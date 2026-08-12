"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

function isIndependenceSeason(d = new Date()) {
  return d.getMonth() === 7 && d.getDate() >= 1 && d.getDate() <= 20
}

const MESSAGE =
  "Special discount for 14 August — save on Voltrix LiFePO₄ batteries & inverters!"

export default function PromoMarquee() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(isIndependenceSeason())
  }, [])

  if (!active) return null

  const items = Array.from({ length: 6 }, (_, i) => (
    <span key={i} className="inline-flex items-center gap-2 shrink-0 px-8">
      <Sparkles className="w-3 h-3 text-emerald-200 shrink-0" aria-hidden />
      <span>{MESSAGE}</span>
      <span className="text-white/40" aria-hidden>
        •
      </span>
    </span>
  ))

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] overflow-hidden border-b border-white/10"
      style={{
        background: "linear-gradient(90deg, #01411C 0%, #0a5c2e 50%, #01411C 100%)",
      }}
      role="marquee"
      aria-label={MESSAGE}
    >
      <div className="flex h-7 sm:h-8 items-center">
        <div className="flex animate-promo-marquee whitespace-nowrap text-[11px] sm:text-xs font-semibold text-white tracking-wide">
          {items}
        </div>
      </div>
    </div>
  )
}
