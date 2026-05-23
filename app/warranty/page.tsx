"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { Shield, Search, AlertCircle, CheckCircle, Calendar, User, Mail, Phone, Download, QrCode } from "lucide-react"
import { toPng } from "html-to-image"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { WarrantyQrScanner } from "@/components/warranty/warranty-qr-scanner"
import { useSearchParams } from "next/navigation"

interface WarrantyData {
  id: string
  warrantyId: string
  serialNumber?: string
  productName: string
  soldDate: string
  warrantyStartDate: string
  warrantyEndDate: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  notes?: string
  activatedAt?: string
}

interface PendingResponse {
  status: "pending_activation"
  serialNumber?: string
  productName?: string
  customerName?: string
  message: string
}

function WarrantyLookupContent() {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<"scan" | "type">("scan")
  const [warrantyId, setWarrantyId] = useState("")
  const [warranty, setWarranty] = useState<WarrantyData | null>(null)
  const [pending, setPending] = useState<PendingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const cardRef = useRef<HTMLDivElement>(null)
  const prefilled = useRef(false)

  useEffect(() => {
    if (!searchParams) return
    const sn = searchParams.get("sn") || searchParams.get("serial") || searchParams.get("id")
    if (sn && !prefilled.current) {
      prefilled.current = true
      void lookup(sn)
    }
  }, [searchParams])

  async function lookup(id: string) {
    const key = id.trim()
    if (!key) return

    setLoading(true)
    setError("")
    setWarranty(null)
    setPending(null)
    setWarrantyId(key)

    try {
      const res = await fetch(`/api/warranty/lookup?id=${encodeURIComponent(key)}`)
      const data = await res.json()

      if (res.ok) {
        setWarranty(data)
        return
      }

      if (data.status === "pending_activation") {
        setPending(data as PendingResponse)
        return
      }

      setError(data.error || data.message || "Warranty not found")
    } catch {
      setError("Failed to lookup warranty")
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    await lookup(warrantyId)
  }

  async function handleDownload() {
    if (!cardRef.current) return
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 2 })
      const link = document.createElement("a")
      link.download = `warranty-${warranty?.warrantyId || "card"}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Failed to download:", err)
    }
  }

  function calculateRemainingWarranty(endDate: string): { days: number; status: "active" | "expiring" | "expired" } {
    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { days: Math.abs(diffDays), status: "expired" }
    if (diffDays <= 30) return { days: diffDays, status: "expiring" }
    return { days: diffDays, status: "active" }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1a9f9a]/10 mb-3">
          <Shield className="h-7 w-7 text-[#1a9f9a]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Check your warranty</h1>
        <p className="text-sm text-gray-600">
          Scan the QR on your product or enter your warranty ID
        </p>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => setMode("scan")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "scan" ? "bg-white shadow text-gray-900" : "text-gray-600"
          }`}
        >
          <QrCode className="h-4 w-4" />
          Scan QR
        </button>
        <button
          type="button"
          onClick={() => setMode("type")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "type" ? "bg-white shadow text-gray-900" : "text-gray-600"
          }`}
        >
          <Search className="h-4 w-4" />
          Enter ID
        </button>
      </div>

      {mode === "scan" ? (
        <div className="mb-6 space-y-3">
          <WarrantyQrScanner
            readerId="public-warranty-reader"
            onScan={(payload) => lookup(payload)}
            busy={loading}
          />
          <p className="text-center text-[11px] text-gray-500">
            New unit? Ask your dealer to <strong>Start warranty</strong> after delivery — then scan here to view your card.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={warrantyId}
                onChange={(e) => setWarrantyId(e.target.value)}
                placeholder="Warranty ID or serial number"
                className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 h-10 rounded-lg bg-[#1a9f9a] text-white text-sm font-medium hover:bg-[#158a85] disabled:opacity-50"
            >
              {loading ? "…" : "Check"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {pending && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Warranty not started yet</p>
          {pending.productName && (
            <p className="text-xs text-amber-800">Product: {pending.productName}</p>
          )}
          {pending.serialNumber && (
            <p className="text-xs font-mono text-amber-800">SN: {pending.serialNumber}</p>
          )}
          <p className="text-xs text-amber-800">{pending.message}</p>
        </div>
      )}

      {warranty && (
        <div className="space-y-4">
          <div
            ref={cardRef}
            className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
            style={{ backgroundImage: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}
          >
            <div className="bg-gradient-to-r from-[#1a9f9a] to-[#158a85] p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold capitalize">{warranty.productName}</h2>
                    <p className="text-white/80 text-xs">ID: {warranty.warrantyId}</p>
                    {warranty.serialNumber && (
                      <p className="text-white/70 text-[10px] font-mono mt-0.5">SN: {warranty.serialNumber}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {(() => {
                    const remaining = calculateRemainingWarranty(warranty.warrantyEndDate)
                    return (
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          remaining.status === "active"
                            ? "bg-green-100 text-green-700"
                            : remaining.status === "expiring"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {remaining.status === "active" && <CheckCircle className="h-3 w-3" />}
                        {remaining.status === "expiring" && <AlertCircle className="h-3 w-3" />}
                        {remaining.status === "expired" && <AlertCircle className="h-3 w-3" />}
                        {remaining.status === "expired"
                          ? `Expired ${remaining.days}d ago`
                          : remaining.status === "expiring"
                            ? `Expiring ${remaining.days}d`
                            : `${remaining.days}d remaining`}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Sold</p>
                  <p className="text-xs font-semibold text-gray-900">{formatDate(warranty.soldDate)}</p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Started</p>
                  <p className="text-xs font-semibold text-gray-900">
                    {formatDate(warranty.warrantyStartDate)}
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Ends</p>
                  <p className="text-xs font-semibold text-gray-900">
                    {formatDate(warranty.warrantyEndDate)}
                  </p>
                </div>
              </div>

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

              <div className="pt-2 border-t border-gray-200 text-center">
                <p className="text-[10px] text-gray-400">Voltrix Batteries — Warranty Certificate</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleDownload()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#1a9f9a] text-white text-sm font-medium hover:bg-[#158a85]"
          >
            <Download className="h-4 w-4" />
            Download warranty card
          </button>
        </div>
      )}
    </div>
  )
}

export default function WarrantyLookupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex flex-col">
      <Navbar />
      <div className="flex-1 pt-24 pb-12 px-4">
        <Suspense fallback={<div className="text-center text-sm text-gray-500">Loading…</div>}>
          <WarrantyLookupContent />
        </Suspense>
      </div>
      <Footer />
    </div>
  )
}
