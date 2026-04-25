"use client"
import { useState, useRef } from "react"
import { Shield, Search, AlertCircle, CheckCircle, Calendar, User, Mail, Phone, Download } from "lucide-react"
import { toPng } from "html-to-image"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"

interface WarrantyData {
  id: string
  warrantyId: string
  productName: string
  soldDate: string
  warrantyStartDate: string
  warrantyEndDate: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  notes?: string
}

export default function WarrantyLookupPage() {
  const [warrantyId, setWarrantyId] = useState("")
  const [warranty, setWarranty] = useState<WarrantyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const cardRef = useRef<HTMLDivElement>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!warrantyId.trim()) return

    setLoading(true)
    setError("")
    setWarranty(null)

    try {
      const res = await fetch(`/api/warranty/lookup?id=${encodeURIComponent(warrantyId.trim())}`)
      const data = await res.json()

      if (res.ok) {
        setWarranty(data)
      } else {
        setError(data.error || "Warranty not found")
      }
    } catch (err) {
      setError("Failed to lookup warranty")
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 2 })
      const link = document.createElement("a")
      link.download = `warranty-${warranty?.warrantyId}.png`
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

    if (diffDays < 0) {
      return { days: Math.abs(diffDays), status: "expired" }
    } else if (diffDays <= 30) {
      return { days: diffDays, status: "expiring" }
    } else {
      return { days: diffDays, status: "active" }
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex flex-col">
      <Navbar />
      <div className="flex-1 py-12 px-4">
        <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1a9f9a]/10 mb-3">
            <Shield className="h-7 w-7 text-[#1a9f9a]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Warranty Lookup</h1>
          <p className="text-sm text-gray-600">Enter your warranty ID to check status</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={warrantyId}
                onChange={e => setWarrantyId(e.target.value)}
                placeholder="Enter warranty ID (e.g., vol-12345)"
                className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 h-10 rounded-lg bg-[#1a9f9a] text-white text-sm font-medium hover:bg-[#158a85] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "..." : "Search"}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Warranty Card */}
        {warranty && (
          <div className="space-y-4">
            <div
              ref={cardRef}
              className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
              style={{ backgroundImage: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-[#1a9f9a] to-[#158a85] p-5 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">{warranty.productName.charAt(0).toUpperCase() + warranty.productName.slice(1)}</h2>
                      <p className="text-white/80 text-xs">ID: {warranty.warrantyId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const remaining = calculateRemainingWarranty(warranty.warrantyEndDate)
                      return (
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          remaining.status === "active" ? "bg-green-100 text-green-700" :
                          remaining.status === "expiring" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {remaining.status === "active" && <CheckCircle className="h-3 w-3" />}
                          {remaining.status === "expiring" && <AlertCircle className="h-3 w-3" />}
                          {remaining.status === "expired" && <AlertCircle className="h-3 w-3" />}
                          {remaining.status === "expired" ? `Expired ${remaining.days}d ago` :
                           remaining.status === "expiring" ? `Expiring ${remaining.days}d` :
                           `${remaining.days}d remaining`}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-4">
                {/* Dates */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Sold</p>
                    <p className="text-xs font-semibold text-gray-900">{formatDate(warranty.soldDate)}</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Start</p>
                    <p className="text-xs font-semibold text-gray-900">{formatDate(warranty.warrantyStartDate)}</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">End</p>
                    <p className="text-xs font-semibold text-gray-900">{formatDate(warranty.warrantyEndDate)}</p>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-white rounded-lg border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Customer</p>
                  <div className="space-y-1">
                    {warranty.customerName && (
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-gray-400" />
                        <p className="text-xs text-gray-700">{warranty.customerName.charAt(0).toUpperCase() + warranty.customerName.slice(1)}</p>
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

                {/* Notes */}
                {warranty.notes && (
                  <div className="bg-white rounded-lg border border-gray-100 p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-xs text-gray-600">{warranty.notes}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="pt-2 border-t border-gray-200 text-center">
                  <p className="text-[10px] text-gray-400">Voltrix Batteries - Warranty Certificate</p>
                </div>
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#1a9f9a] text-white text-sm font-medium hover:bg-[#158a85] transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Warranty Card
            </button>
          </div>
        )}
      </div>
      </div>
      <Footer />
    </div>
  )
}
