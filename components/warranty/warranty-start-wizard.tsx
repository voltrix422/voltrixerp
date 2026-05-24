"use client"

import { useState, useRef } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  User,
  Phone,
  MapPin,
} from "lucide-react"
import { WarrantyQrScanner } from "@/components/warranty/warranty-qr-scanner"

export type WarrantyStartPreview = {
  serialNumber: string
  productName: string
  customerName?: string | null
}

export type WarrantyStartFormData = {
  customerName: string
  customerPhone: string
  customerAddress: string
  invoiceDocumentUrl: string | null
}

type Step = "scan" | "invoice" | "details"

type Props = {
  scannerKey: number
  busy: boolean
  onBack: () => void
  onComplete: (scan: string, form: WarrantyStartFormData) => Promise<void>
}

export function WarrantyStartWizard({ scannerKey, busy, onBack, onComplete }: Props) {
  const [step, setStep] = useState<Step>("scan")
  const [scanPayload, setScanPayload] = useState("")
  const [preview, setPreview] = useState<WarrantyStartPreview | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [invoiceFileName, setInvoiceFileName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleScan(payload: string) {
    setError("")
    setScanPayload(payload)

    try {
      const res = await fetch(`/api/warranty/lookup?id=${encodeURIComponent(payload)}`)
      const data = await res.json()

      if (res.ok) {
        await onComplete(payload, {
          customerName: data.customerName || "",
          customerPhone: data.customerPhone || "",
          customerAddress: data.customerAddress || "",
          invoiceDocumentUrl: data.invoiceDocumentUrl || null,
        })
        return
      }

      if (data.status === "pending_activation") {
        setPreview({
          serialNumber: data.serialNumber || "",
          productName: data.productName || "Product",
          customerName: data.customerName,
        })
        if (data.customerName) setCustomerName(String(data.customerName))
        setStep("invoice")
        return
      }

      setError(data.error || data.message || "This product could not be found.")
    } catch {
      setError("Could not verify product. Please try again.")
    }
  }

  async function handleInvoiceUpload(file: File) {
    setError("")
    setUploading(true)
    try {
      const form = new FormData()
      form.append("files", file)
      form.append("folder", "warranty-invoices")
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Upload failed")
        return
      }
      const url = data.urls?.[0]
      if (!url) {
        setError("Upload failed")
        return
      }
      setInvoiceUrl(url)
      setInvoiceFileName(file.name)
    } catch {
      setError("Failed to upload invoice")
    } finally {
      setUploading(false)
    }
  }

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      setError("Please enter your name, phone number, and address.")
      return
    }
    setError("")
    await onComplete(scanPayload, {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      invoiceDocumentUrl: invoiceUrl,
    })
  }

  const stepIndex = step === "scan" ? 1 : step === "invoice" ? 2 : 3

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold ${
                n <= stepIndex
                  ? "bg-[#1a9f9a] text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {n < stepIndex ? <CheckCircle className="h-4 w-4" /> : n}
            </span>
            {n < 3 && <div className={`w-8 h-0.5 ${n < stepIndex ? "bg-[#1a9f9a]" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {step === "scan" && (
        <>
          <div className="rounded-xl bg-[#1a9f9a]/10 border border-[#1a9f9a]/20 px-4 py-3 text-sm text-gray-700 text-center">
            Step 1: Scan your product QR code
          </div>
          <WarrantyQrScanner
            key={`start-${scannerKey}`}
            readerId="public-warranty-start-reader"
            onScan={(p) => void handleScan(p)}
            busy={busy}
            autoStart
            hideStartButton
          />
        </>
      )}

      {step === "invoice" && preview && (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Product verified</p>
            <p className="font-semibold text-gray-900 capitalize mt-1">{preview.productName}</p>
            <p className="font-mono text-xs text-gray-600 mt-1">SN: {preview.serialNumber}</p>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-800">Step 2: Upload your purchase invoice</p>
            <p className="text-xs text-gray-500">PDF or image (JPG, PNG) from your dealer or receipt</p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleInvoiceUpload(file)
              }}
            />

            {invoiceUrl ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                <FileText className="h-5 w-5 text-green-600 shrink-0" />
                <span className="text-sm text-green-800 truncate flex-1">{invoiceFileName || "Invoice uploaded"}</span>
                <button
                  type="button"
                  className="text-xs text-[#1a9f9a] font-medium"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed border-[#1a9f9a]/40 bg-white hover:bg-[#1a9f9a]/5 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 text-[#1a9f9a] animate-spin" />
                ) : (
                  <Upload className="h-8 w-8 text-[#1a9f9a]" />
                )}
                <span className="text-sm font-medium text-gray-700">
                  {uploading ? "Uploading…" : "Tap to upload invoice"}
                </span>
              </button>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="flex-1 py-3 rounded-xl bg-[#1a9f9a] text-white text-sm font-semibold hover:bg-[#158a85] flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {!invoiceUrl && (
              <button
                type="button"
                onClick={() => setStep("details")}
                className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
              >
                Skip invoice for now
              </button>
            )}
          </div>
        </>
      )}

      {step === "details" && (
        <form onSubmit={(e) => void submitDetails(e)} className="space-y-4">
          <div className="rounded-xl bg-[#1a9f9a]/10 border border-[#1a9f9a]/20 px-4 py-3 text-sm text-gray-700 text-center">
            Step 3: Your details (Naam)
          </div>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> Name (Naam) *
              </span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                placeholder="Full name"
                className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Phone number *
              </span>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
                type="tel"
                placeholder="03XX XXXXXXX"
                className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Address *
              </span>
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                required
                rows={3}
                placeholder="House, street, city"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] resize-none"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 rounded-xl bg-[#1a9f9a] text-white text-base font-semibold hover:bg-[#158a85] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Start warranty & view card
          </button>

          <button
            type="button"
            onClick={() => setStep("invoice")}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Back to invoice upload
          </button>
        </form>
      )}
    </div>
  )
}
