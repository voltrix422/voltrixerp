"use client"
import { useState } from "react"
import { Shield, Search, AlertCircle, CheckCircle, Calendar, User, Mail, Phone } from "lucide-react"

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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1a9f9a]/10 mb-4">
            <Shield className="h-8 w-8 text-[#1a9f9a]" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Warranty Lookup</h1>
          <p className="text-gray-600">Enter your warranty ID to check product warranty status</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={warrantyId}
                onChange={e => setWarrantyId(e.target.value)}
                placeholder="Enter warranty ID (e.g., vol-12345)"
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 h-12 rounded-xl bg-[#1a9f9a] text-white font-medium hover:bg-[#158a85] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Warranty Result */}
        {warranty && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1a9f9a] to-[#158a85] p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{warranty.productName.charAt(0).toUpperCase() + warranty.productName.slice(1)}</h2>
                  <p className="text-white/80 text-sm">Warranty ID: {warranty.warrantyId}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Warranty Status */}
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Warranty Status</p>
                {(() => {
                  const remaining = calculateRemainingWarranty(warranty.warrantyEndDate)
                  return (
                    <div className="flex items-center gap-2">
                      {remaining.status === "active" && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {remaining.status === "expiring" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                      {remaining.status === "expired" && <AlertCircle className="h-5 w-5 text-red-500" />}
                      <span className={`font-semibold ${
                        remaining.status === "active" ? "text-green-600" :
                        remaining.status === "expiring" ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {remaining.status === "expired" ? `Expired ${remaining.days} days ago` :
                         remaining.status === "expiring" ? `Expiring in ${remaining.days} days` :
                         `${remaining.days} days remaining`}
                      </span>
                    </div>
                  )
                })()}
              </div>

              {/* Warranty Period */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Sold Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(warranty.soldDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Start Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(warranty.warrantyStartDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">End Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(warranty.warrantyEndDate)}</p>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer Information</h3>
                <div className="space-y-3">
                  {warranty.customerName && (
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-gray-400" />
                      <p className="text-sm text-gray-700">{warranty.customerName.charAt(0).toUpperCase() + warranty.customerName.slice(1)}</p>
                    </div>
                  )}
                  {warranty.customerEmail && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <p className="text-sm text-gray-700">{warranty.customerEmail}</p>
                    </div>
                  )}
                  {warranty.customerPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <p className="text-sm text-gray-700">{warranty.customerPhone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {warranty.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{warranty.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
