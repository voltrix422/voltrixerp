"use client"

import {
  cutPricePercentOff,
  formatProductPrice,
  getCompareAtPrice,
  hasCutPrice,
  type ProductPricing,
} from "@/lib/product-display"

type Size = "sm" | "md" | "lg"

const sizeClass: Record<Size, { sale: string; was: string; badge: string }> = {
  sm: {
    sale: "text-sm font-bold text-neutral-900",
    was: "text-xs text-neutral-400 line-through",
    badge: "text-[9px] px-1.5 py-0.5",
  },
  md: {
    sale: "text-lg font-bold text-neutral-900",
    was: "text-sm text-neutral-400 line-through",
    badge: "text-[10px] px-1.5 py-0.5",
  },
  lg: {
    sale: "text-2xl font-bold text-neutral-900",
    was: "text-base text-neutral-400 line-through",
    badge: "text-xs px-2 py-0.5",
  },
}

/**
 * Shows sale price with optional crossed-out compare-at (cut) price.
 * Example: ~~Rs. 680,000~~  Rs. 63,000  [-91%]
 */
export function ProductPriceDisplay({
  product,
  size = "md",
  className = "",
}: {
  product: ProductPricing
  size?: Size
  className?: string
}) {
  const sale = formatProductPrice(product.price)
  if (!sale) return <span className={className}>—</span>

  const cut = hasCutPrice(product)
  const was = cut ? formatProductPrice(getCompareAtPrice(product)) : null
  const pct = cut ? cutPricePercentOff(product) : null
  const s = sizeClass[size]

  if (!cut || !was) {
    return <p className={`${s.sale} ${className}`.trim()}>{sale}</p>
  }

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`.trim()}>
      <span className={s.was}>{was}</span>
      <span className={s.sale}>{sale}</span>
      {pct != null && pct > 0 && (
        <span
          className={`${s.badge} rounded-full font-semibold bg-rose-50 text-rose-600 border border-rose-100`}
        >
          −{pct}%
        </span>
      )}
    </div>
  )
}
