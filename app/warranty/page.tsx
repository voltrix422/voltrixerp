"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import {
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
        setInfo("Certificate ready.")
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
        setInfo(wn ? `Warranty number: ${wn}` : "Certificate ready below.")
      } else {
        setJustActivated(true)
        const wn = (data.warranty as WarrantyData)?.warrantyId
        setInfo(wn ? `Started · ${wn}` : "Warranty started.")
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
  const showLanding = flow === null && !warranty

  return (
    <div className="max-w-lg mx-auto">
      {showLanding && (
        <>
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Warranty</h1>
            <p className="text-sm text-gray-500 mt-1">5-year coverage</p>
          </div>

          <div className="flex flex-col items-center mb-8">
            <div className="w-full max-w-[300px] rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/10 bg-black">
              <video
                className="w-full aspect-[9/16] object-cover"
                controls
                playsInline
                preload="metadata"
              >
                <source src="/warranty.mp4" type="video/mp4" />
              </video>
            </div>
            <a
              href="/warranty.mp4"
              download="voltrix-warranty-guide.mp4"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#1a9f9a] hover:text-[#158a85] transition-colors"
            >
              <Download className="h-4 w-4" />
              Download guide
            </a>
          </div>

          <div className="space-y-3 max-w-sm mx-auto">
            <button
              type="button"
              onClick={() => openFlow("start")}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1a9f9a] text-white text-sm font-semibold hover:bg-[#158a85] shadow-sm transition-colors"
            >
              <PlayCircle className="h-5 w-5" />
              Start warranty
            </button>
            <button
              type="button"
              onClick={() => openFlow("check")}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              <Search className="h-5 w-5 text-[#1a9f9a]" />
              Check warranty
            </button>
          </div>
        </>
      )}

      {!showLanding && (
        <div className="max-w-md mx-auto">
          {(flow !== null || warranty) && !showStartWizard && (
            <button
              type="button"
              onClick={goBack}
              className="mb-5 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
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
          <h2 className="text-lg font-semibold text-gray-900">Check warranty</h2>
          <div className="flex rounded-xl border border-gray-200 p-1 bg-gray-50">
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
            <WarrantyQrScanner
              key={`check-${scannerKey}`}
              readerId="public-warranty-check-reader"
              onScan={(p) => void lookup(p)}
              busy={loading}
              autoStart
              hideStartButton
            />
          ) : (
            <div className="space-y-3">
              <input
                value={warrantyNumberInput}
                onChange={(e) => setWarrantyNumberInput(e.target.value)}
                placeholder="Warranty number · vol-12345"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
              />
              <button
                type="button"
                disabled={loading || !warrantyNumberInput.trim()}
                onClick={() => void lookup(warrantyNumberInput)}
                className="w-full py-3.5 rounded-xl bg-[#1a9f9a] text-white text-sm font-semibold hover:bg-[#158a85] disabled:opacity-50 transition-colors"
              >
                {loading ? "Looking up…" : "Check"}
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
          {justActivated && flow === "start" && warranty.warrantyId && (
            <p className="text-center text-sm font-mono font-bold text-[#1a9f9a]">{warranty.warrantyId}</p>
          )}
          <WarrantyPublicCardView ref={cardRef} warranty={toCardData(warranty)} />
          <button
            type="button"
            onClick={() => void handleDownload()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1a9f9a] text-white text-sm font-semibold hover:bg-[#158a85] shadow-sm transition-colors"
          >
            <Download className="h-4 w-4" />
            Download card
          </button>
        </div>
      )}
        </div>
      )}
    </div>
  )
}

export default function WarrantyLookupPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fa] flex flex-col">
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
