"use client"

import { useEffect, useState } from "react"
import { Zap, Battery, Layers, Shield, ArrowRight, Sparkles } from "lucide-react"
import Image from "next/image"
import ProductSpecsModal from "@/components/products/product-specs-modal"
import {
  FALLBACK_FUSION_PRODUCT,
  findFeaturedFusionProduct,
  fusionProductToSpecsPayload,
  resolveFeaturedFusionProduct,
} from "@/lib/featured-fusion-product"
import { getProductDisplayName } from "@/lib/product-display-name"

const specs = [
  { icon: Zap, label: "4200W", desc: "Rated Output Power" },
  { icon: Battery, label: "8038.4Wh", desc: "Battery Capacity" },
  { icon: Layers, label: "Stackable", desc: "Modular Design" },
  { icon: Shield, label: "LiFePO4", desc: "Advanced Technology" },
]

export default function FeaturedProduct() {
  const [specsOpen, setSpecsOpen] = useState(false)
  const [fusionProduct, setFusionProduct] = useState<Record<string, unknown>>(
    () => ({ ...FALLBACK_FUSION_PRODUCT })
  )

  useEffect(() => {
    fetch("/api/products")
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        const found = findFeaturedFusionProduct(list)
        setFusionProduct(resolveFeaturedFusionProduct(found))
      })
      .catch(() => setFusionProduct({ ...FALLBACK_FUSION_PRODUCT }))
  }, [])

  const display = getProductDisplayName({
    name: String(fusionProduct.name ?? ""),
    model: fusionProduct.model != null ? String(fusionProduct.model) : undefined,
  })

  return (
    <section className="py-20 px-4 bg-white text-neutral-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="w-4 h-4 text-[#1a9f9a]" />
          <span className="text-xs font-medium text-[#1a9f9a] tracking-widest uppercase">
            Innovative Technology
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-neutral-50 rounded-2xl border border-neutral-200 p-6 lg:p-8">
          <div className="lg:col-span-5">
            <div className="relative aspect-square max-w-sm mx-auto rounded-xl overflow-hidden bg-white border border-neutral-200">
              <Image
                src="/voltrix-fusion.png"
                alt="Voltrix Fusion"
                fill
                className="object-contain p-4"
              />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs text-neutral-500 mb-1">Stackable Energy Storage System</p>
              <h3 className="text-3xl font-bold text-neutral-900 mb-2">Voltrix Fusion</h3>
              <p className="text-neutral-600 text-sm leading-relaxed max-w-md">
                Stackable energy storage battery with off-grid inverter. Features 4200W rated
                output power, 8038.4Wh battery capacity, and advanced LiFePO4 technology.
              </p>
              {display.model ? (
                <p className="mt-2 text-xs font-mono text-neutral-500">{display.model}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {specs.map(s => (
                <div key={s.label} className="p-3 rounded-lg bg-white border border-neutral-200">
                  <s.icon className="w-4 h-4 text-[#1a9f9a] mb-2" />
                  <p className="text-sm font-semibold text-neutral-900">{s.label}</p>
                  <p className="text-xs text-neutral-500">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="#products"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-neutral-950 bg-[#1a9f9a] hover:bg-[#158a85] transition-colors cursor-pointer"
              >
                View All Products <ArrowRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setSpecsOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-neutral-600 border border-neutral-300 hover:text-neutral-900 hover:border-[#1a9f9a]/50 transition-colors cursor-pointer"
              >
                Get Technical Specs
              </button>
            </div>
          </div>
        </div>
      </div>

      <ProductSpecsModal
        open={specsOpen}
        onClose={() => setSpecsOpen(false)}
        focusSpecSheet
        product={fusionProductToSpecsPayload(fusionProduct)}
      />
    </section>
  )
}
