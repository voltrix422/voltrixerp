"use client"

import { forwardRef } from "react"
import { Shield, CheckCircle, AlertCircle } from "lucide-react"

export type PublicWarrantyCardData = {
  invoiceNumber?: string | null
  serialNumber?: string | null
  productName: string
  soldDate: string
  warrantyStartDate: string
  warrantyEndDate: string
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  installLocation?: string | null
  invoiceDocumentUrl?: string | null
}

export const VOLTRIX_WARRANTY_TERMS = [
  "For indoor use only (IP21); keep away from water, moisture, and high humidity.",
  "Install correctly with approved inverters and chargers as per guidelines.",
  "Warranty covers manufacturing defects under normal use with valid proof of purchase.",
  "Warranty excludes water damage, physical damage, misuse, or unauthorized repairs.",
  "Avoid overloading, short-circuiting, or bypassing the BMS; monitor via the mobile app.",
  "Company not liable for indirect damage, losses, or misuse-related issues.",
  "Operate within -10°C to 60°C and rated voltage limits for safe performance.",
  "Modification, tampering, or disassembly voids the warranty immediately.",
  "Claims require lab inspection; non-covered damage voids replacement; confirmed defects serviced per policy.",
] as const

export function calculateRemainingWarranty(endDate: string): {
  days: number
  status: "active" | "expiring" | "expired"
} {
  const end = new Date(endDate)
  const now = new Date()
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { days: Math.abs(diffDays), status: "expired" }
  if (diffDays <= 30) return { days: diffDays, status: "expiring" }
  return { days: diffDays, status: "active" }
}

export function formatWarrantyDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function StatusPill({ remaining }: { remaining: ReturnType<typeof calculateRemainingWarranty> }) {
  const styles =
    remaining.status === "active"
      ? "bg-emerald-400/25 text-white border-emerald-300/40"
      : remaining.status === "expiring"
        ? "bg-amber-400/25 text-white border-amber-300/40"
        : "bg-red-400/25 text-white border-red-300/40"
  const label =
    remaining.status === "expired"
      ? `Expired`
      : remaining.status === "expiring"
        ? `${remaining.days}d left`
        : "Active"

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${styles}`}
    >
      {remaining.status === "active" ? (
        <CheckCircle className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      {label}
    </span>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[8px] uppercase tracking-wide text-gray-400 font-medium leading-none">{label}</p>
      <p className="text-[11px] font-semibold text-gray-900 mt-0.5 leading-snug break-words">{value}</p>
    </div>
  )
}

export const WarrantyPublicCardView = forwardRef<
  HTMLDivElement,
  { warranty: PublicWarrantyCardData; showCustomer?: boolean; showInvoiceLink?: boolean }
>(function WarrantyPublicCardView(
  { warranty, showCustomer = true, showInvoiceLink = true },
  ref,
) {
  const remaining = calculateRemainingWarranty(warranty.warrantyEndDate)
  const invoiceIsPdf = warranty.invoiceDocumentUrl?.toLowerCase().endsWith(".pdf")

  const hasCustomer =
    showCustomer &&
    (warranty.customerName ||
      warranty.customerPhone ||
      warranty.customerAddress ||
      warranty.installLocation)

  return (
    <div
      ref={ref}
      className="rounded-xl overflow-hidden shadow-lg border border-gray-200/90 bg-white max-w-md mx-auto"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a9f9a] to-[#0d7a76] px-4 py-3 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-white/75 font-semibold">
                Voltrix Batteries Pvt. Ltd.
              </p>
              <h2 className="text-base font-bold capitalize leading-tight truncate">
                {warranty.productName}
              </h2>
            </div>
          </div>
          <StatusPill remaining={remaining} />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/90 font-mono">
          {warranty.serialNumber && <span>SN: {warranty.serialNumber}</span>}
          {warranty.invoiceNumber && <span>Inv: {warranty.invoiceNumber}</span>}
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-2.5 bg-white">
        {/* Dates */}
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-gray-50 border border-gray-100 p-2">
          <InfoCell label="Sold" value={formatWarrantyDate(warranty.soldDate)} />
          <InfoCell label="Started" value={formatWarrantyDate(warranty.warrantyStartDate)} />
          <InfoCell label="Valid until" value={formatWarrantyDate(warranty.warrantyEndDate)} />
        </div>

        {/* Customer — compact grid */}
        {hasCustomer && (
          <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-2 grid grid-cols-2 gap-x-2 gap-y-1.5">
            <p className="col-span-2 text-[9px] font-bold uppercase tracking-wide text-[#1a9f9a]">
              Registered owner
            </p>
            {warranty.customerName && (
              <div className="col-span-2">
                <InfoCell label="Naam" value={warranty.customerName} />
              </div>
            )}
            {warranty.customerPhone && <InfoCell label="Phone" value={warranty.customerPhone} />}
            {warranty.installLocation && (
              <InfoCell label="Install at" value={warranty.installLocation} />
            )}
            {warranty.customerAddress && (
              <div className="col-span-2">
                <InfoCell label="Address" value={warranty.customerAddress} />
              </div>
            )}
          </div>
        )}

        {showInvoiceLink && warranty.invoiceDocumentUrl && (
          <a
            href={warranty.invoiceDocumentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[10px] font-medium text-[#1a9f9a] py-1.5 rounded-md border border-[#1a9f9a]/25 bg-[#1a9f9a]/5 hover:bg-[#1a9f9a]/10"
          >
            View uploaded invoice{invoiceIsPdf ? " (PDF)" : ""}
          </a>
        )}

        {/* Terms */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-gray-700 mb-1">
            Terms &amp; Conditions
          </p>
          <ul className="space-y-0.5">
            {VOLTRIX_WARRANTY_TERMS.map((term) => (
              <li
                key={term}
                className="text-[8px] leading-[1.35] text-gray-600 flex gap-1"
              >
                <span className="text-[#1a9f9a] shrink-0 font-bold">➤</span>
                <span>{term}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-[8px] text-gray-400 leading-tight">
          Advanced lithium energy storage · voltrixbatteries.com · 5-year warranty
        </p>
      </div>
    </div>
  )
})
