"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import {
  Shield,
  Search,
  AlertCircle,
  CheckCircle,
  Download,
  QrCode,
  PlayCircle,
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

type PageTab = "start" | "check"
type InputMode = "scan" | "type"

type WarrantyData = PublicWarrantyCardData & {
  id?: string
  notes?: string
  activatedAt?: string
}

function toCardData(w: WarrantyData): PublicWarrantyCardData {
  return {
    warrantyId: w.warrantyId,
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

function InputModeToggle({
  inputMode,
  setInputMode,
}: {
  inputMode: InputMode
  setInputMode: (m: InputMode) => void
}) {
  return (
    <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
      <button
        type="button"
        onClick={() => setInputMode("scan")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors ${
          inputMode === "scan" ? "bg-white shadow text-gray-900" : "text-gray-600"
        }`}
      >
        <QrCode className="h-4 w-4" />
        Scan QR
      </button>
      <button
        type="button"
        onClick={() => setInputMode("type")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors ${
          inputMode === "type" ? "bg-white shadow text-gray-900" : "text-gray-600"
        }`}
      >
        <Search className="h-4 w-4" />
        Enter ID
      </button>
    </div>
  )
}

function StartWarrantyPanel({
  inputMode,
  setInputMode,
  loading,
  warrantyId,
  setWarrantyId,
  onScan,
  onManualActivate,
}: {
  inputMode: InputMode
  setInputMode: (m: InputMode) => void
  loading: boolean
  warrantyId: string
  setWarrantyId: (v: string) => void
  onScan: (payload: string) => void
  onManualActivate: () => void
}) {
  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-xl bg-[#1a9f9a]/10 border border-[#1a9f9a]/20 px-4 py-3 text-sm text-gray-700">
        <strong>Scanning this QR starts your warranty.</strong> The 5-year period begins today after
        your product has been delivered. If you scan again, you will see your active warranty card.
      </div>

      <InputModeToggle inputMode={inputMode} setInputMode={setInputMode} />

      {inputMode === "scan" ? (
        <WarrantyQrScanner
          readerId="public-warranty-start-reader"
          onScan={onScan}
          busy={loading}
        />
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={warrantyId}
            onChange={(e) => setWarrantyId(e.target.value)}
            placeholder="Serial number"
            className="flex-1 h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
          />
          <button
            type="button"
            disabled={loading || !warrantyId.trim()}
            onClick={onManualActivate}
            className="px-4 h-10 rounded-lg bg-[#1a9f9a] text-white text-sm font-medium hover:bg-[#158a85] disabled:opacity-50"
          >
            {loading ? "…" : "Start"}
          </button>
        </div>
      )}
    </div>
  )
}

function CheckWarrantyPanel({
  inputMode,
  setInputMode,
  loading,
  warrantyId,
  setWarrantyId,
  onScan,
  onSubmit,
}: {
  inputMode: InputMode
  setInputMode: (m: InputMode) => void
  loading: boolean
  warrantyId: string
  setWarrantyId: (v: string) => void
  onScan: (payload: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div className="mb-6 space-y-4">
      <p className="text-sm text-gray-600 text-center">
        Scan the QR on your product or enter your warranty ID to view dates and download your card.
      </p>

      <InputModeToggle inputMode={inputMode} setInputMode={setInputMode} />

      {inputMode === "scan" ? (
        <WarrantyQrScanner
          readerId="public-warranty-check-reader"
          onScan={onScan}
          busy={loading}
        />
      ) : (
        <form onSubmit={onSubmit} className="flex gap-2">
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
        </form>
      )}
    </div>
  )
}

function WarrantyLookupContent() {
  const searchParams = useSearchParams()
  const [pageTab, setPageTab] = useState<PageTab>("start")
  const [inputMode, setInputMode] = useState<InputMode>("scan")
  const [warrantyId, setWarrantyId] = useState("")
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
      setPageTab("check")
      void lookup(sn)
    } else {
      setPageTab("start")
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

  async function lookup(id: string) {
    const key = id.trim()
    if (!key) return

    setLoading(true)
    resetResults()
    setWarrantyId(key)

    try {
      const res = await fetch(`/api/warranty/lookup?id=${encodeURIComponent(key)}`)
      const data = await res.json()

      if (res.ok) {
        setWarranty(data)
        return
      }

      if (data.status === "pending_activation") {
        setError(
          "Warranty has not been started yet. Switch to Start warranty and scan your product QR.",
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
    setWarrantyId(key)

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

  async function handleCheckSubmit(e: React.FormEvent) {
    e.preventDefault()
    await lookup(warrantyId)
  }

  async function handleDownload() {
    if (!cardRef.current) return
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 2 })
      const link = document.createElement("a")
      link.download = `warranty-${warranty?.warrantyId || warranty?.serialNumber || "card"}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Failed to download:", err)
    }
  }

  function switchTab(tab: PageTab) {
    setPageTab(tab)
    resetResults()
    setWarrantyId("")
  }

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

      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => switchTab("start")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-md transition-colors ${
            pageTab === "start" ? "bg-white shadow text-gray-900" : "text-gray-600"
          }`}
        >
          <PlayCircle className="h-4 w-4" />
          Start warranty
        </button>
        <button
          type="button"
          onClick={() => switchTab("check")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-md transition-colors ${
            pageTab === "check" ? "bg-white shadow text-gray-900" : "text-gray-600"
          }`}
        >
          <Search className="h-4 w-4" />
          Check warranty
        </button>
      </div>

      {pageTab === "start" ? (
        <StartWarrantyPanel
          inputMode={inputMode}
          setInputMode={setInputMode}
          loading={loading}
          warrantyId={warrantyId}
          setWarrantyId={setWarrantyId}
          onScan={(p) => void activate(p)}
          onManualActivate={() => void activate(warrantyId)}
        />
      ) : (
        <CheckWarrantyPanel
          inputMode={inputMode}
          setInputMode={setInputMode}
          loading={loading}
          warrantyId={warrantyId}
          setWarrantyId={setWarrantyId}
          onScan={(p) => void lookup(p)}
          onSubmit={handleCheckSubmit}
        />
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
          {alreadyActive && pageTab === "start" && (
            <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This QR was already scanned — warranty is active.
            </p>
          )}
          {justActivated && pageTab === "start" && (
            <p className="text-xs text-center text-[#1a9f9a] font-medium">
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
