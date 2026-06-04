"use client"

import { useEffect, useState } from "react"
import { Download, Loader2, X } from "lucide-react"
import {
  hasProductSpecs,
  normalizeSpecRows,
  type ProductSpecsPayload,
} from "@/lib/product-specs"
import { getCategoryDisplayLabel } from "@/lib/product-categories"
import { downloadProductSpecPDF } from "@/lib/generate-product-spec-pdf"
import { getProductImageList } from "@/lib/product-image"

type Props = {
  open: boolean
  onClose: () => void
  product: ProductSpecsPayload
}

export default function ProductSpecsModal({ open, onClose, product }: Props) {
  const [downloading, setDownloading] = useState(false)
  const specs = normalizeSpecRows(product.specs)
  const categoryLabel = getCategoryDisplayLabel(String(product.category ?? ""))
  const thumb = getProductImageList(product)[0]

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open || !hasProductSpecs(product)) return null

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadProductSpecPDF({
        ...product,
        images: getProductImageList(product),
      })
    } catch (error) {
      console.error("Spec PDF failed:", error)
      alert("Could not generate the specifications PDF. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-specs-title"
    >
      <div
        className="flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 bg-gradient-to-r from-[#1a9f9a]/10 to-white px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1a9f9a]">
              Voltrix Batteries
            </p>
            <h2 id="product-specs-title" className="text-xl font-bold text-neutral-900 mt-1">
              {product.name}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              {categoryLabel}
              {product.warranty ? ` · Warranty: ${product.warranty}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {(product.description || product.full_desc) && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">Product details</h3>
              <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
                {String(product.full_desc || product.description)}
              </p>
            </div>
          )}

          {thumb && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Product image</h3>
              <div className="relative max-w-md aspect-[4/3] rounded-xl overflow-hidden bg-neutral-50 border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb} alt={product.name} className="w-full h-full object-contain p-4" />
              </div>
            </div>
          )}

          {specs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Technical specifications</h3>
              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1a9f9a] text-white">
                      <th className="text-left px-4 py-3 font-semibold">Specification</th>
                      <th className="text-left px-4 py-3 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specs.map((s, i) => (
                      <tr
                        key={`${s.label}-${i}`}
                        className={i % 2 === 0 ? "bg-white" : "bg-neutral-50"}
                      >
                        <td className="px-4 py-3 font-medium text-neutral-600 border-t border-neutral-100">
                          {s.label}
                        </td>
                        <td className="px-4 py-3 font-semibold text-neutral-900 border-t border-neutral-100">
                          {s.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {product.specSheetUrl && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Full specification sheet</h3>
              <a
                href={product.specSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50 hover:border-[#1a9f9a]/40 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.specSheetUrl}
                  alt="Full specification sheet"
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              </a>
            </div>
          )}

          {specs.some(s => s.imageUrl) && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-neutral-900">Specification images</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {specs
                  .filter(s => s.imageUrl)
                  .map((s, i) => (
                    <div key={i} className="space-y-2">
                      {s.label && (
                        <p className="text-xs font-medium text-neutral-500">{s.label}</p>
                      )}
                      <a
                        href={s.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl border border-neutral-200 overflow-hidden"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.imageUrl}
                          alt={s.label || "Spec"}
                          className="w-full h-auto object-contain bg-neutral-50"
                        />
                      </a>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4 bg-neutral-50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-sm font-medium border border-neutral-200 hover:bg-white"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-[#1a9f9a] hover:bg-[#158a85] disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
