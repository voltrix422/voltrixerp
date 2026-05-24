"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import {
  Shield,
  Search,
  AlertCircle,
  CheckCircle,
  Download,
  PlayCircle,
  ArrowLeft,
} from "lucide-react"
import { toPng } from "html-to-image"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { WarrantyQrScanner } from "@/components/warranty/warranty-qr-scanner"
import {
  WarrantyPublicCardView,
  type PublicWarrantyCardData,
} from "@/components/warranty/warranty-public-card"
import { useSearchParams } from "next/navigation"

type Flow = null | "start" | "check"

type WarrantyData = PublicWarrantyCardData & {
  id?: string
  warrantyId?: string | null
  notes?: string
  activatedAt?: string
}

function toCardData(w: WarrantyData): PublicWarrantyCardData {
  return {
    invoiceNumber: w.invoiceNumber,
    serialNumber: w.serialNumber,
    productName: w.productName,
    soldDate: w.soldDate,
    warrantyStartDate: w.warrantyStartDate,
    warrantyEndDate: w.warrantyEndDate,
    customerName: w.customerName,
    customerEmail: w.customerEmail,
    customerPhone: w.customerPhone,
  }
}

function WarrantyLookupContent() {
  const searchParams = useSearchParams()
  const [flow, setFlow] = useState<Flow>(null)
  const [scannerKey, setScannerKey] = useState(0)
  const [warranty, setWarranty] = useState<WarrantyData | null>(null)
  const [alreadyActive, setAlreadyActive] = useState(false)
  const [justActivated, setJustActivated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const cardRef = useRef<HTMLDivElement>(null)
  const prefilled = useRef(false)

  useEffect(() => {
    if (!searchParams || prefilled.current) return
    const sn =
      searchParams.get("sn") ||
      searchParams.get("serial") ||
      searchParams.get("id")
    if (!sn) return

    prefilled.current = true
    const action = searchParams.get("action")
    if (action === "check") {
      setFlow("check")
      void lookup(sn)
    } else {
      setFlow("start")
      void activate(sn)
    }
  }, [searchParams])

  function resetResults() {
    setWarranty(null)
    setAlreadyActive(false)
    setJustActivated(false)
    setError("")
    setInfo("")
  }

  function openFlow(next: Exclude<Flow, null>) {
    resetResults()
    setFlow(next)
    setScannerKey((k) => k + 1)
  }

  function goBack() {
    resetResults()
    setFlow(null)
    setScannerKey((k) => k + 1)
  }

  async function lookup(id: string) {
    const key = id.trim()
    if (!key) return

    setLoading(true)
    resetResults()

    try {
      const res = await fetch(`/api/warranty/lookup?id=${encodeURIComponent(key)}`)
      const data = await res.json()

      if (res.ok) {
        setWarranty(data)
        return
      }

      if (data.status === "pending_activation") {
        setError(
          "Warranty has not been started yet. Tap Start warranty and scan your product QR.",
        )
        return
      }

      setError(data.error || data.message || "Warranty not found")
    } catch {
      setError("Failed to lookup warranty")
    } finally {
      setLoading(false)
    }
  }

  async function activate(scan: string) {
    const key = scan.trim()
    if (!key) return

    setLoading(true)
    resetResults()

    try {
      const res = await fetch("/api/warranty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan: key, activatedBy: "customer" }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Could not start warranty")
        return
      }

      setWarranty(data.warranty as WarrantyData)
      if (data.alreadyActive) {
        setAlreadyActive(true)
        setInfo("This warranty was already activated. You can view and download your card below.")
      } else {
        setJustActivated(true)
        setInfo("Your 5-year warranty has started today. Save or download your warranty card below.")
      }
    } catch {
      setError("Failed to start warranty. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 2 })
      const link = document.createElement("a")
      link.download = `warranty-${warranty?.invoiceNumber || warranty?.serialNumber || "card"}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Failed to download:", err)
    }
  }

  const showScanner = flow !== null && !warranty

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1a9f9a]/10 mb-3">
          <Shield className="h-7 w-7 text-[#1a9f9a]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Product warranty</h1>
        <p className="text-sm text-gray-600">
          Start your 5-year warranty or check status and download your warranty card
        </p>
      </div>

      {flow === null && !warranty && (
        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={() => openFlow("start")}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1a9f9a] text-white text-base font-semibold hover:bg-[#158a85] shadow-md transition-colors"
          >
            <PlayCircle className="h-5 w-5" />
            Start warranty
          </button>
          <button
            type="button"
            onClick={() => openFlow("check")}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-[#1a9f9a] text-[#1a9f9a] bg-white text-base font-semibold hover:bg-[#1a9f9a]/5 transition-colors"
          >
            <Search className="h-5 w-5" />
            Check warranty
          </button>
        </div>
      )}

      {showScanner && (
        <div className="mb-6 space-y-4">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {flow === "start" ? (
            <div className="rounded-xl bg-[#1a9f9a]/10 border border-[#1a9f9a]/20 px-4 py-3 text-sm text-gray-700 text-center">
              Scan your product QR to <strong>start</strong> your 5-year warranty.
            </div>
          ) : (
            <div className="rounded-xl bg-gray-100 border border-gray-200 px-4 py-3 text-sm text-gray-700 text-center">
              Scan your product QR to <strong>view</strong> your warranty card.
            </div>
          )}

          <WarrantyQrScanner
            key={`${flow}-${scannerKey}`}
            readerId={flow === "start" ? "public-warranty-start-reader" : "public-warranty-check-reader"}
            onScan={(p) => void (flow === "start" ? activate(p) : lookup(p))}
            busy={loading}
            autoStart
            hideStartButton
          />
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {info && (
        <div className="mb-6 p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{info}</p>
        </div>
      )}

      {warranty && (
        <div className="space-y-4">
          {alreadyActive && flow === "start" && (
            <p className="text-sm text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This QR was already scanned â€” warranty is active.
            </p>
          )}
          {justActivated && flow === "start" && (
            <p className="text-sm text-center text-[#1a9f9a] font-semibold">
              Warranty started successfully!
            </p>
          )}
          <WarrantyPublicCardView ref={cardRef} warranty={toCardData(warranty)} />
          <button
            type="button"
            onClick={() => void handleDownload()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#1a9f9a] text-white text-sm font-medium hover:bg-[#158a85]"
          >
            <Download className="h-4 w-4" />
            Download warranty card
          </button>
          <button
            type="button"
            onClick={goBack}
            className="w-full py-2.5 text-sm text-gray-600 hover:text-gray-900"
          >
            Scan another product
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
        <Suspense fallback={<div className="text-center text-sm text-gray-500">Loadingâ€¦</div>}>
          <WarrantyLookupContent />
        </Suspense>
      </div>
      <Footer />
    </div>
  )
}
