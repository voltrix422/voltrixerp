"use client"

import { useEffect, useState } from "react"
import { Download, Loader2, X, ExternalLink } from "lucide-react"
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
  /** When true, show only the uploaded spec sheet image (sharp, full width) */
  focusSpecSheet?: boolean
}

/** Renders spec sheet at native resolution — never upscales (avoids blur). */
function SpecSheetImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [src])

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-neutral-200 bg-white p-3 hover:border-[#1a9f9a]/40 transition-colors"
      title="Open full size in new tab"
    >
      <div className="relative flex justify-center overflow-auto max-h-[min(78vh,820px)] min-h-[220px]">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-neutral-50/90">
            <Loader2 className="h-8 w-8 animate-spin text-[#1a9f9a]" aria-hidden />
            <p className="text-xs text-neutral-500">Loading specifications…</p>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          decoding="async"
          className={`block h-auto max-w-full object-contain transition-opacity duration-150 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          style={{ width: "auto", maxHeight: "min(78vh, 820px)" }}
          onLoad={e => {
            const img = e.currentTarget
            const parent = img.parentElement
            const maxW = parent?.clientWidth ?? img.naturalWidth
            // Never scale wider than the file's real pixels (prevents soft upscale blur)
            const displayW = Math.min(img.naturalWidth, maxW)
            if (displayW > 0) {
              img.style.width = `${displayW}px`
            }
            setLoaded(true)
          }}
          onError={() => setLoaded(true)}
        />
      </div>
      <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-neutral-400 group-hover:text-[#1a9f9a]">
        <ExternalLink className="w-3 h-3" />
        View full size
      </p>
    </a>
  )
}

export default function ProductSpecsModal({
  open,
  onClose,
  product,
  focusSpecSheet = false,
}: Props) {
  const [downloading, setDownloading] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  const specs = normalizeSpecRows(product.specs)
  const categoryLabel = getCategoryDisplayLabel(String(product.category ?? ""))
  const specSheet = product.specSheetUrl?.trim()
  const sheetOnly = Boolean(specSheet && focusSpecSheet)

  useEffect(() => {
    if (!open) {
      setContentReady(false)
      return
    }
    setContentReady(false)
    // Let the modal chrome paint with a loader, then reveal content
    const id = window.setTimeout(() => setContentReady(true), 180)
    return () => window.clearTimeout(id)
  }, [open, product.name, product.specSheetUrl])

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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-specs-title"
    >
      <div
        className={`flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl isolate ${
          specSheet ? "max-w-5xl" : "max-w-3xl"
        } max-h-[92vh]`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="product-specs-title" className="text-base font-semibold text-neutral-900 truncate">
              {product.name}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {categoryLabel}
              {product.warranty ? ` · ${product.warranty}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 min-h-[240px]">
          {!contentReady ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-[#1a9f9a]" aria-hidden />
              <p className="text-sm text-neutral-500">Loading specifications…</p>
            </div>
          ) : (
            <>
              {specSheet && (
                <SpecSheetImage src={specSheet} alt={`${product.name} specification sheet`} />
              )}

              {!sheetOnly && specs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                    Technical details
                  </h3>
                  <div className="rounded-lg border border-neutral-200 overflow-hidden text-sm">
                    <table className="w-full">
                      <tbody>
                        {specs.map((s, i) => (
                          <tr
                            key={`${s.label}-${i}`}
                            className={i % 2 === 0 ? "bg-white" : "bg-neutral-50/80"}
                          >
                            <td className="px-3 py-2.5 font-medium text-neutral-600 border-t border-neutral-100 w-[40%]">
                              {s.label || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-neutral-900 border-t border-neutral-100">
                              {s.value || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!sheetOnly && specs.some(s => s.imageUrl) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {specs
                    .filter(s => s.imageUrl)
                    .map((s, i) => (
                      <div key={i}>
                        {s.label && (
                          <p className="text-xs text-neutral-500 mb-1">{s.label}</p>
                        )}
                        <a
                          href={s.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-lg border border-neutral-200 overflow-hidden bg-white p-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.imageUrl}
                            alt={s.label || "Specification"}
                            className="block w-auto max-w-full h-auto max-h-64 mx-auto object-contain"
                            style={{ width: "auto" }}
                          />
                        </a>
                      </div>
                    ))}
                </div>
              )}

              {!specSheet && specs.length === 0 && (
                <p className="text-sm text-neutral-500">No specifications available for this product.</p>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-3 bg-neutral-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-white border border-transparent hover:border-neutral-200"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || !contentReady}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1a9f9a] hover:bg-[#158a85] disabled:opacity-60"
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
