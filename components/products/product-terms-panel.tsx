"use client"

import { useState } from "react"
import { CheckCircle2, Download, FileText, Loader2, ShieldCheck } from "lucide-react"
import type { ProductTermsDisplay } from "@/lib/product-terms"
import { parseProductTermsContent, splitTermsTitleBadges } from "@/lib/parse-product-terms"
import { downloadProductTermsPDF } from "@/lib/generate-product-terms-pdf"

type Props = {
  productName: string
  termsDisplay: ProductTermsDisplay
}

export default function ProductTermsPanel({ productName, termsDisplay }: Props) {
  const [downloading, setDownloading] = useState(false)
  const parsed = parseProductTermsContent(termsDisplay.content)
  const badges = splitTermsTitleBadges(parsed.title)

  const handleDownload = async () => {
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
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#1a9f9a]/15 bg-gradient-to-br from-[#1a9f9a]/8 via-white to-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1a9f9a]/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1a9f9a]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Warranty coverage
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">{parsed.title}</h3>
              {badges.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-[#1a9f9a]/20 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#158a85]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1a9f9a] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1a9f9a]/20 transition hover:bg-[#158a85] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </button>
            {termsDisplay.fileUrl && (
              <a
                href={termsDisplay.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[#1a9f9a] hover:text-[#1a9f9a]"
              >
                <FileText className="h-4 w-4" />
                Attached document
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {parsed.intro.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-7 text-neutral-600 md:text-[15px]">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1a9f9a]/10 text-[#1a9f9a]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1a9f9a]">Important</p>
            <h4 className="text-lg font-bold text-neutral-900">{parsed.sectionTitle}</h4>
          </div>
        </div>

        <div className="grid gap-3">
          {parsed.bullets.map((bullet, index) => (
            <div
              key={`${index}-${bullet.slice(0, 24)}`}
              className="flex gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/80 px-4 py-4"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1a9f9a]" />
              <p className="text-sm leading-7 text-neutral-700">{bullet}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
