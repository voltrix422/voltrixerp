"use client"

import type { CrmPriceTier } from "@/lib/crm-product-prices"
import { CRM_PRICE_TIER_LABELS } from "@/lib/crm-product-prices"

const TIERS: CrmPriceTier[] = ["retail", "wholesale", "dealership"]

export function CrmPriceTierSelect({
  value,
  onChange,
  className = "",
}: {
  value: CrmPriceTier
  onChange: (tier: CrmPriceTier) => void
  className?: string
}) {
  return (
    <div
      className={`inline-flex items-center rounded-full bg-black/[0.06] dark:bg-white/10 p-0.5 ${className}`}
      role="group"
      aria-label="Price list"
    >
      {TIERS.map((tier) => (
        <button
          key={tier}
          type="button"
          onClick={() => onChange(tier)}
          className={`h-7 px-3 rounded-full text-[11px] font-semibold tracking-tight transition-colors cursor-pointer ${
            value === tier
              ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-[#1d1d1f] dark:text-white"
              : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
          }`}
        >
          {CRM_PRICE_TIER_LABELS[tier]}
        </button>
      ))}
    </div>
  )
}
