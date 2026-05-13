"use client"

import { Download, ExternalLink, FileText } from "lucide-react"

type Props = {
  brochureUrl: string
  brochureName?: string
  productName: string
}

export default function ProductBrochurePanel({ brochureUrl, brochureName, productName }: Props) {
  const title = brochureName?.trim() || `${productName} brochure`
  const fileName = brochureUrl.split("/").pop() || "brochure.pdf"

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-3xl border border-[#1a9f9a]/15 bg-gradient-to-br from-[#1a9f9a]/8 via-white to-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1a9f9a]/10 text-[#1a9f9a]">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1a9f9a]">Product brochure</p>
            <h3 className="mt-1 text-xl font-bold text-neutral-900">{title}</h3>
            <p className="mt-1 text-sm text-neutral-500">View the brochure below or download a copy for offline reading.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={brochureUrl}
            download={fileName}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1a9f9a] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1a9f9a]/20 transition hover:bg-[#158a85]"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <a
            href={brochureUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[#1a9f9a] hover:text-[#1a9f9a]"
          >
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 shadow-sm">
        <iframe
          src={`${brochureUrl}#toolbar=1&navpanes=0`}
          title={title}
          className="h-[min(78vh,920px)] w-full bg-white"
        />
      </div>
    </div>
  )
}
