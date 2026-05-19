"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Download, Loader2, X } from "lucide-react"
import type { ProductTermsDisplay } from "@/lib/product-terms"
import { parseProductTermsContent } from "@/lib/parse-product-terms"
import { downloadProductTermsPDF } from "@/lib/generate-product-terms-pdf"

type Props = {
  open: boolean
  onClose: () => void
  productName: string
  termsDisplay: ProductTermsDisplay
}

export default function ProductTermsModal({ open, onClose, productName, termsDisplay }: Props) {
  const [downloading, setDownloading] = useState(false)
  const parsed = parseProductTermsContent(termsDisplay.content)

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

  if (!open) return null

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadProductTermsPDF(productName, termsDisplay.content)
    } catch (error) {
      console.error("Failed to download terms PDF:", error)
      alert("Could not generate the terms PDF. Please try again.")
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
      aria-labelledby="product-terms-title"
    >
      <div
        className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 px-6 py-5">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1a9f9a]">
              Terms & Conditions
            </p>
            <h2 id="product-terms-title" className="text-xl font-bold text-neutral-900 sm:text-2xl">
              {parsed.title}
            </h2>
            <p className="text-sm text-neutral-500">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {parsed.intro.length > 0 && (
            <div className="space-y-4">
              {parsed.intro.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="text-sm leading-7 text-neutral-600 sm:text-base">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {parsed.bullets.length > 0 && (
            <div>
              <h3 className="mb-4 text-lg font-bold text-neutral-900">{parsed.sectionTitle}</h3>
              <ul className="space-y-3">
                {parsed.bullets.map((bullet, index) => (
                  <li
                    key={`${index}-${bullet.slice(0, 24)}`}
                    className="flex gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1a9f9a]" />
                    <span className="text-sm leading-7 text-neutral-700">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:border-neutral-300"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-full bg-[#1a9f9a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#158a85] disabled:opacity-70"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
