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
import {
  WarrantyStartWizard,
  type WarrantyStartFormData,
} from "@/components/warranty/warranty-start-wizard"
import { useSearchParams } from "next/navigation"

type Flow = null | "start" | "check"

type WarrantyData = PublicWarrantyCardData & {
  id?: string
  warrantyId?: string | null
  installLocation?: string | null
  notes?: string
  activatedAt?: string
}

function toCardData(w: WarrantyData): PublicWarrantyCardData {
  return {
    warrantyId: w.warrantyId,
    invoiceNumber: w.invoiceNumber,
    serialNumber: w.serialNumber,
    productName: w.productName,
    soldDate: w.soldDate,
    warrantyStartDate: w.warrantyStartDate,
    warrantyEndDate: w.warrantyEndDate,
    customerName: w.customerName,
    customerEmail: w.customerEmail,
    customerPhone: w.customerPhone,
    customerAddress: w.customerAddress,
    installLocation: w.installLocation,
    invoiceDocumentUrl: w.invoiceDocumentUrl,
  }
}

function WarrantyLookupContent() {
  const searchParams = useSearchParams()
  const [flow, setFlow] = useState<Flow>(null)
  const [checkMode, setCheckMode] = useState<"scan" | "number">("scan")
  const [warrantyNumberInput, setWarrantyNumberInput] = useState("")
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
      setCheckMode(sn.toLowerCase().startsWith("vol-") ? "number" : "scan")
      if (sn.toLowerCase().startsWith("vol-")) setWarrantyNumberInput(sn)
      void lookup(sn)
    } else {
      setFlow("start")
      setScannerKey((k) => k + 1)
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
    setCheckMode("scan")
    setWarrantyNumberInput("")
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
        setInfo("Your warranty details and certificate are below.")
        return
      }

      setError(data.error || data.message || "No warranty data exists for this product.")
    } catch {
      setError("Failed to lookup warranty")
    } finally {
      setLoading(false)
    }
  }

  async function completeStart(scan: string, form: WarrantyStartFormData) {
    setLoading(true)
    setError("")
    setInfo("")

    try {
      const res = await fetch("/api/warranty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan,
          activatedBy: "customer",
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerAddress: form.customerAddress,
          installLocation: form.installLocation,
          invoiceDocumentUrl: form.invoiceDocumentUrl || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Could not start warranty")
        return
      }

      setWarranty(data.warranty as WarrantyData)
      if (data.alreadyActive) {
        setAlreadyActive(true)
        const wn = (data.warranty as WarrantyData)?.warrantyId
        setInfo(
          wn
            ? `This warranty is already active. Your warranty number is ${wn}.`
            : "This warranty is already active. Your certificate is below.",
        )
      } else {
        setJustActivated(true)
        const wn = (data.warranty as WarrantyData)?.warrantyId
        setInfo(
          wn
            ? `Your 5-year warranty has started. Warranty number: ${wn}. Save this number to check warranty later.`
            : "Your 5-year warranty has started. Download your certificate below.",
        )
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
      link.download = `warranty-${warranty?.warrantyId || warranty?.invoiceNumber || warranty?.serialNumber || "card"}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Failed to download:", err)
    }
  }

  const showCheckScanner = flow === "check" && !warranty
  const showStartWizard = flow === "start" && !warranty

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1a9f9a]/10 mb-3">
          <Shield className="h-7 w-7 text-[#1a9f9a]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Product warranty</h1>
        <p className="text-sm text-gray-600">
          Scan your product, upload invoice, and get your 5-year warranty certificate
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

      {showStartWizard && (
        <WarrantyStartWizard
          scannerKey={scannerKey}
          busy={loading}
          onBack={goBack}
          onComplete={completeStart}
        />
      )}

      {showCheckScanner && (
        <div className="mb-6 space-y-4">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            <button
              type="button"
              onClick={() => setCheckMode("scan")}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                checkMode === "scan"
                  ? "bg-white text-[#1a9f9a] shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Scan QR
            </button>
            <button
              type="button"
              onClick={() => setCheckMode("number")}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                checkMode === "number"
                  ? "bg-white text-[#1a9f9a] shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Warranty number
            </button>
          </div>

          {checkMode === "scan" ? (
            <>
              <div className="rounded-xl bg-gray-100 border border-gray-200 px-4 py-3 text-sm text-gray-700 text-center">
                Scan your product QR to <strong>view</strong> warranty details and certificate
              </div>
              <WarrantyQrScanner
                key={`check-${scannerKey}`}
                readerId="public-warranty-check-reader"
                onScan={(p) => void lookup(p)}
                busy={loading}
                autoStart
                hideStartButton
              />
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-gray-100 border border-gray-200 px-4 py-3 text-sm text-gray-700 text-center">
                Enter your <strong>warranty number</strong> from your certificate (e.g. vol-12345)
              </div>
              <input
                value={warrantyNumberInput}
                onChange={(e) => setWarrantyNumberInput(e.target.value)}
                placeholder="vol-12345"
                className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
              />
              <button
                type="button"
                disabled={loading || !warrantyNumberInput.trim()}
                onClick={() => void lookup(warrantyNumberInput)}
                className="w-full py-3.5 rounded-xl bg-[#1a9f9a] text-white text-sm font-semibold hover:bg-[#158a85] disabled:opacity-50"
              >
                {loading ? "Looking up…" : "Check warranty"}
              </button>
            </div>
          )}
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
              This product warranty was already started.
            </p>
          )}
          {justActivated && flow === "start" && (
            <div className="text-center space-y-1">
              <p className="text-sm text-[#1a9f9a] font-semibold">Warranty started successfully!</p>
              {warranty.warrantyId && (
                <>
                  <p className="text-sm font-mono font-bold text-gray-900">{warranty.warrantyId}</p>
                  <p className="text-xs text-gray-600 px-2">
                    Save this warranty number — use Check warranty → Warranty number anytime.
                  </p>
                </>
              )}
            </div>
          )}
          <WarrantyPublicCardView ref={cardRef} warranty={toCardData(warranty)} />
          <button
            type="button"
            onClick={() => void handleDownload()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1a9f9a] text-white text-sm font-semibold hover:bg-[#158a85] shadow-md"
          >
            <Download className="h-4 w-4" />
            Download warranty card
          </button>
          <button
            type="button"
            onClick={goBack}
            className="w-full py-2.5 text-sm text-gray-600 hover:text-gray-900"
          >
            Back to home
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
