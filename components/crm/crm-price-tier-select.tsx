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
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-semibold">Price list</label>
      <div className="flex flex-wrap gap-2">
        {TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            className={`h-9 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              value === tier
                ? "bg-[#1faca6] text-white border-[#1faca6]"
                : "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:border-[#1faca6]/50"
            }`}
          >
            {CRM_PRICE_TIER_LABELS[tier]}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        Default unit prices come from Product Prices — you can adjust them per line item.
      </p>
    </div>
  )
}
