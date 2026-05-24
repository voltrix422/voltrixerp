"use client"

import { forwardRef } from "react"
import { Shield, CheckCircle, AlertCircle, User, Mail, Phone } from "lucide-react"

export type PublicWarrantyCardData = {
  warrantyId?: string | null
  serialNumber?: string | null
  productName: string
  soldDate: string
  warrantyStartDate: string
  warrantyEndDate: string
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
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
      ? "bg-green-100 text-green-700"
      : remaining.status === "expiring"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700"
  const label =
    remaining.status === "expired"
      ? `Expired ${remaining.days}d ago`
      : remaining.status === "expiring"
        ? `Expiring ${remaining.days}d`
        : `${remaining.days}d left`

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 ${cls}`}>
      {remaining.status === "active" && <CheckCircle className="h-3 w-3" />}
      {remaining.status === "expiring" && <AlertCircle className="h-3 w-3" />}
      {remaining.status === "expired" && <AlertCircle className="h-3 w-3" />}
      {label}
    </div>
  )
}

function DateCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xs font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function CustomerBlock({ warranty }: { warranty: PublicWarrantyCardData }) {
  if (!warranty.customerName && !warranty.customerEmail && !warranty.customerPhone) return null

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Customer</p>
      <div className="space-y-1">
        {warranty.customerName && (
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-gray-400" />
            <p className="text-xs text-gray-700 capitalize">{warranty.customerName}</p>
          </div>
        )}
        {warranty.customerEmail && (
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-gray-400" />
            <p className="text-xs text-gray-700">{warranty.customerEmail}</p>
          </div>
        )}
        {warranty.customerPhone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-gray-400" />
            <p className="text-xs text-gray-700">{warranty.customerPhone}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CardHeaderLeft({ warranty }: { warranty: PublicWarrantyCardData }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
        <Shield className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-bold capitalize truncate">{warranty.productName}</h2>
        {warranty.warrantyId && <p className="text-white/80 text-xs">ID: {warranty.warrantyId}</p>}
        {warranty.serialNumber && (
          <p className="text-white/70 text-[10px] font-mono mt-0.5 truncate">SN: {warranty.serialNumber}</p>
        )}
      </div>
    </div>
  )
}

export const WarrantyPublicCardView = forwardRef<HTMLDivElement, { warranty: PublicWarrantyCardData }>(
  function WarrantyPublicCardView({ warranty }, ref) {
    const remaining = calculateRemainingWarranty(warranty.warrantyEndDate)

    return (
      <div
        ref={ref}
        className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
        style={{ backgroundImage: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}
      >
        <div className="bg-gradient-to-r from-[#1a9f9a] to-[#158a85] p-5 text-white">
          <div className="flex items-center justify-between gap-2">
            <CardHeaderLeft warranty={warranty} />
            <StatusBadge remaining={remaining} />
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <DateCell label="Sold" value={formatWarrantyDate(warranty.soldDate)} />
            <DateCell label="Started" value={formatWarrantyDate(warranty.warrantyStartDate)} />
            <DateCell label="Ends" value={formatWarrantyDate(warranty.warrantyEndDate)} />
          </div>
          <CustomerBlock warranty={warranty} />
          <div className="pt-2 border-t border-gray-200 text-center">
            <p className="text-[10px] text-gray-400">Voltrix Batteries — Warranty Certificate</p>
          </div>
        </div>
      </div>
    )
  },
)
