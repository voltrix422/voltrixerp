"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Sparkles } from "lucide-react"
import Image from "next/image"
import ProductSpecsModal from "@/components/products/product-specs-modal"
import {
  findFeaturedFusionProduct,
  fusionProductToSpecsPayload,
} from "@/lib/featured-fusion-product"
import { getProductDisplayName } from "@/lib/product-display-name"
import { getProductImageList, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-image"

const FEATURED_FALLBACK_DESC =
  "A high-capacity, heavy-duty 51.2V 305Ah Lithium Iron Phosphate battery system engineered for high-demand residential or commercial solar storage, delivering a powerful 15.6 kWh of energy with over 8,000 cycles at 90 % depth of discharge."

export default function FeaturedProduct() {
  const [specsOpen, setSpecsOpen] = useState(false)
  const [featuredProduct, setFeaturedProduct] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setFeaturedProduct(findFeaturedFusionProduct(list))
      })
      .catch(() => setFeaturedProduct(null))
  }, [])

  if (!featuredProduct) return null

  const display = getProductDisplayName({
    name: String(featuredProduct.name ?? ""),
    model: featuredProduct.model != null ? String(featuredProduct.model) : undefined,
  })
  const category = String(featuredProduct.category ?? "Energy Storage Battery").trim()
  const images = getProductImageList(featuredProduct)
  const heroImage = images[0] ?? PRODUCT_IMAGE_FALLBACK
  const specRows = Array.isArray(featuredProduct.specs)
    ? featuredProduct.specs
        .filter((s): s is { label?: unknown; value?: unknown } => s && typeof s === "object")
        .slice(0, 4)
    : []
  const description =
    String(featuredProduct.full_desc || featuredProduct.description || "").trim() ||
    FEATURED_FALLBACK_DESC

  return (
    <section className="py-20 px-4 bg-white text-neutral-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="w-4 h-4 text-[#1a9f9a]" />
          <span className="text-xs font-medium text-[#1a9f9a] tracking-widest uppercase">
            Featured Lithium Battery
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-neutral-50 rounded-2xl border border-neutral-200 p-6 lg:p-8">
          <div className="lg:col-span-5">
            <div className="relative aspect-square max-w-sm mx-auto rounded-xl overflow-hidden bg-white border border-neutral-200">
              <Image
                src={heroImage}
                alt={display.title || "15 kWh Energy Storage Battery"}
                fill
                className="object-contain p-4"
                unoptimized={heroImage.startsWith("/uploads/")}
              />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs text-neutral-500 mb-1">
                {category || "Energy Storage Battery"} · Lithium Battery
              </p>
              <h3 className="text-3xl font-bold text-neutral-900 mb-2">
                {display.title || "15 kWh Energy Storage Battery"}
              </h3>
              <p className="text-neutral-600 text-sm leading-relaxed max-w-md">{description}</p>
              {display.model ? (
                <p className="mt-2 text-xs font-mono text-neutral-500">{display.model}</p>
              ) : (
                <p className="mt-2 text-xs font-mono text-neutral-500">HS-LD15KW-A</p>
              )}
            </div>

            {specRows.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {specRows.map((s) => (
                  <div
                    key={String(s.label)}
                    className="p-3 rounded-lg bg-white border border-neutral-200"
                  >
                    <p className="text-sm font-semibold text-neutral-900">{String(s.value ?? "")}</p>
                    <p className="text-xs text-neutral-500">{String(s.label ?? "")}</p>
                  </div>
                ))}
              </div>
            ) : null}

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
        product={fusionProductToSpecsPayload(featuredProduct)}
      />
    </section>
  )
}
