"use client"

import { forwardRef } from "react"
import {
  Shield,
  CheckCircle,
  AlertCircle,
  User,
  Phone,
  MapPin,
  Home,
  FileText,
  Package,
  Calendar,
  ExternalLink,
} from "lucide-react"

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

function StatusBadge({
  remaining,
}: {
  remaining: ReturnType<typeof calculateRemainingWarranty>
}) {
  const cls =
    remaining.status === "active"
      ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/30"
      : remaining.status === "expiring"
        ? "bg-amber-500/20 text-amber-100 border-amber-400/30"
        : "bg-red-500/20 text-red-100 border-red-400/30"
  const label =
    remaining.status === "expired"
      ? `Expired ${remaining.days}d ago`
      : remaining.status === "expiring"
        ? `${remaining.days}d left`
        : `${remaining.days} days left`

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cls}`}>
      {remaining.status === "active" && <CheckCircle className="h-3.5 w-3.5" />}
      {remaining.status !== "active" && <AlertCircle className="h-3.5 w-3.5" />}
      {label}
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-lg bg-[#1a9f9a]/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-[#1a9f9a]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</p>
        <p className={`text-sm text-gray-900 mt-0.5 break-words ${mono ? "font-mono text-xs" : "capitalize"}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

export const WarrantyPublicCardView = forwardRef<
  HTMLDivElement,
  { warranty: PublicWarrantyCardData; showCustomer?: boolean }
>(function WarrantyPublicCardView({ warranty, showCustomer = true }, ref) {
  const remaining = calculateRemainingWarranty(warranty.warrantyEndDate)
  const invoiceIsPdf = warranty.invoiceDocumentUrl?.toLowerCase().endsWith(".pdf")

  return (
    <div
      ref={ref}
      className="rounded-2xl overflow-hidden shadow-xl border border-gray-200/80 bg-white"
    >
      <div className="relative bg-gradient-to-br from-[#1a9f9a] via-[#179690] to-[#0f6f6b] px-6 py-6 text-white overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -left-4 bottom-0 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 border border-white/20">
              <Shield className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-white/70 font-medium">
                Voltrix Warranty Certificate
              </p>
              <h2 className="text-xl font-bold capitalize truncate leading-tight mt-0.5">
                {warranty.productName}
              </h2>
            </div>
          </div>
          <StatusBadge remaining={remaining} />
        </div>
      </div>

      <div className="p-5 space-y-5 bg-gradient-to-b from-gray-50/80 to-white">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Sold", value: formatWarrantyDate(warranty.soldDate) },
            { label: "Started", value: formatWarrantyDate(warranty.warrantyStartDate) },
            { label: "Valid until", value: formatWarrantyDate(warranty.warrantyEndDate) },
          ].map((d) => (
            <div
              key={d.label}
              className="text-center rounded-xl border border-gray-100 bg-white py-3 px-1 shadow-sm"
            >
              <Calendar className="h-3.5 w-3.5 text-[#1a9f9a] mx-auto mb-1" />
              <p className="text-[9px] uppercase tracking-wide text-gray-500">{d.label}</p>
              <p className="text-[11px] font-bold text-gray-900 mt-0.5 leading-tight">{d.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-800 flex items-center gap-2">
            <Package className="h-4 w-4 text-[#1a9f9a]" />
            Product & invoice
          </p>
          {warranty.serialNumber && (
            <DetailRow icon={Package} label="Serial number" value={warranty.serialNumber} mono />
          )}
          {warranty.invoiceNumber && (
            <DetailRow icon={FileText} label="Invoice / order" value={warranty.invoiceNumber} />
          )}
          {warranty.invoiceDocumentUrl && (
            <a
              href={warranty.invoiceDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-[#1a9f9a]/30 bg-[#1a9f9a]/5 text-[#158a85] text-sm font-medium hover:bg-[#1a9f9a]/10 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View uploaded invoice{invoiceIsPdf ? " (PDF)" : ""}
            </a>
          )}
        </div>

        {showCustomer &&
          (warranty.customerName ||
            warranty.customerPhone ||
            warranty.customerAddress ||
            warranty.installLocation) && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm">
              <p className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                <User className="h-4 w-4 text-[#1a9f9a]" />
                Customer (Naam)
              </p>
              {warranty.customerName && (
                <DetailRow icon={User} label="Name" value={warranty.customerName} />
              )}
              {warranty.customerPhone && (
                <DetailRow icon={Phone} label="Phone" value={warranty.customerPhone} />
              )}
              {warranty.customerAddress && (
                <DetailRow icon={MapPin} label="Address" value={warranty.customerAddress} />
              )}
              {warranty.installLocation && (
                <DetailRow icon={Home} label="Install location" value={warranty.installLocation} />
              )}
            </div>
          )}

        <div className="text-center pt-1 border-t border-dashed border-gray-200">
          <p className="text-[10px] text-gray-400 tracking-wide">
            voltrixbatteries.com · 5-year product warranty
          </p>
        </div>
      </div>
    </div>
  )
})
