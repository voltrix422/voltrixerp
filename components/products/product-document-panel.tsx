"use client"

import { Download, ExternalLink, FileText } from "lucide-react"

type Props = {
  documentUrl: string
  documentName?: string
  productName: string
  heading: string
  description: string
}

export default function ProductDocumentPanel({
  documentUrl,
  documentName,
  productName,
  heading,
  description,
}: Props) {
  const title = documentName?.trim() || `${productName} ${heading.toLowerCase()}`
  const fileName = documentUrl.split("/").pop() || "document.pdf"

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1a9f9a]">{heading}</p>
            <h3 className="mt-1 text-sm font-semibold text-neutral-900 truncate">{title}</h3>
            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          </div>
          <FileText className="h-5 w-5 text-[#1a9f9a] shrink-0" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href={documentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#1a9f9a]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#1a9f9a] hover:bg-[#1a9f9a]/5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in new tab
          </a>
          <a
            href={documentUrl}
            download={fileName}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <iframe
          src={`${documentUrl}#toolbar=1&navpanes=0`}
          title={title}
          className="h-[70vh] w-full"
        />
      </div>
    </div>
  )
}
