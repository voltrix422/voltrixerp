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
  Home,
  Truck,
} from "lucide-react"
import { WarrantyQrScanner } from "@/components/warranty/warranty-qr-scanner"

export type WarrantyStartPreview = {
  serialNumber: string
  productName: string
  invoiceNumber?: string | null
  customerName?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  installLocation?: string | null
  requiresHolderName?: boolean
}

export type WarrantyStartFormData = {
  customerName: string
  customerPhone: string
  customerAddress: string
  installLocation: string
  invoiceDocumentUrl: string | null
}

type Step = "scan" | "details" | "invoice"

type Props = {
  scannerKey: number
  busy: boolean
  onBack: () => void
  onComplete: (scan: string, form: WarrantyStartFormData) => Promise<void>
}

export function WarrantyStartWizard({ scannerKey, busy, onBack, onComplete }: Props) {
  const [step, setStep] = useState<Step>("scan")
  const [scanning, setScanning] = useState(false)
  const [scanPayload, setScanPayload] = useState("")
  const [preview, setPreview] = useState<WarrantyStartPreview | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [invoiceFileName, setInvoiceFileName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [installLocation, setInstallLocation] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleScan(payload: string) {
    setError("")
    setScanning(true)
    setScanPayload(payload)

    try {
      const res = await fetch(`/api/warranty/preview?scan=${encodeURIComponent(payload)}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "This product could not be found.")
        return
      }

      if (data.status === "already_active") {
        await onComplete(payload, {
          customerName: data.warranty?.customerName || "",
          customerPhone: data.warranty?.customerPhone || "",
          customerAddress: data.warranty?.customerAddress || "",
          installLocation: data.warranty?.installLocation || "",
          invoiceDocumentUrl: data.warranty?.invoiceDocumentUrl || null,
        })
        return
      }

      if (data.status === "delivered_pending") {
        setPreview({
          serialNumber: data.serialNumber || "",
          productName: data.productName || "Product",
          invoiceNumber: data.invoiceNumber,
          customerName: null,
          customerPhone: data.customerPhone,
          customerAddress: data.customerAddress,
          installLocation: data.installLocation,
          requiresHolderName: Boolean(data.requiresHolderName),
        })
        setCustomerName("")
        if (data.customerPhone) setCustomerPhone(String(data.customerPhone))
        if (data.customerAddress) setCustomerAddress(String(data.customerAddress))
        if (data.installLocation) setInstallLocation(String(data.installLocation))
        setStep("details")
        return
      }

      setError(data.message || "Could not verify this product.")
    } catch {
      setError("Could not verify product. Please try again.")
    } finally {
      setScanning(false)
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

  function goToInvoiceStep() {
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim() || !installLocation.trim()) {
      setError("Please enter your name, phone, address, and install location.")
      return
    }
    setError("")
    setStep("invoice")
  }

  async function submitStart(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim() || !installLocation.trim()) {
      setError("Please enter your name, phone, address, and install location.")
      return
    }
    setError("")
    await onComplete(scanPayload, {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      installLocation: installLocation.trim(),
      invoiceDocumentUrl: invoiceUrl,
    })
  }

  const stepIndex = step === "scan" ? 1 : step === "details" ? 2 : 3

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
                n <= stepIndex ? "bg-[#1a9f9a] text-white" : "bg-gray-200 text-gray-500"
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
            busy={scanning || busy}
            autoStart
            hideStartButton
          />
        </>
      )}

      {step === "details" && preview && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Truck className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Product found — delivered</p>
                <p className="text-xs text-emerald-800 mt-1 capitalize">{preview.productName}</p>
                <p className="font-mono text-xs text-emerald-700 mt-0.5">SN: {preview.serialNumber}</p>
                {preview.invoiceNumber && (
                  <p className="text-xs text-emerald-700 mt-1">Order: {preview.invoiceNumber}</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#1a9f9a]/10 border border-[#1a9f9a]/20 px-4 py-3 text-sm text-gray-700 text-center">
            {preview.requiresHolderName
              ? "Step 2: Type the warranty name given by your dealer, then your contact details"
              : "Step 2: Enter your information to start warranty"}
          </div>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <User className="h-3.5 w-3.5" />{" "}
                {preview.requiresHolderName
                  ? "Warranty name (person or company) *"
                  : "Name (Naam) *"}
              </span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                placeholder={
                  preview.requiresHolderName
                    ? "Type the name exactly as given by your dealer"
                    : "Full name"
                }
                autoComplete="off"
                className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
              />
              {preview.requiresHolderName && (
                <span className="text-[11px] text-gray-500">
                  This name will appear on the warranty after it is started.
                </span>
              )}
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
                rows={2}
                placeholder="House, street, city"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] resize-none"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <Home className="h-3.5 w-3.5" /> Install location *
              </span>
              <input
                value={installLocation}
                onChange={(e) => setInstallLocation(e.target.value)}
                required
                placeholder="e.g. Home – Lahore, Shop – Faisalabad"
                className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={goToInvoiceStep}
            className="w-full py-4 rounded-xl bg-[#1a9f9a] text-white text-base font-semibold hover:bg-[#158a85] flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setStep("scan")}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Scan a different product
          </button>
        </div>
      )}

      {step === "invoice" && preview && (
        <form onSubmit={(e) => void submitStart(e)} className="space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Ready to start warranty</p>
            <p className="font-semibold text-gray-900 capitalize mt-1">{preview.productName}</p>
            <p className="font-mono text-xs text-gray-600 mt-1">SN: {preview.serialNumber}</p>
            <p className="text-xs text-gray-600 mt-2 capitalize">
              {preview.requiresHolderName ? "Warranty name" : "Naam"}: {customerName}
            </p>
          </div>

          <div className="rounded-xl bg-[#1a9f9a]/10 border border-[#1a9f9a]/20 px-4 py-3 text-sm text-gray-700 text-center">
            Step 3: Upload purchase invoice (optional)
          </div>

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
              className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-[#1a9f9a]/40 bg-white hover:bg-[#1a9f9a]/5 transition-colors"
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 text-[#1a9f9a] animate-spin" />
              ) : (
                <Upload className="h-8 w-8 text-[#1a9f9a]" />
              )}
              <span className="text-sm font-medium text-gray-700">
                {uploading ? "Uploading…" : "Tap to upload invoice (PDF or image)"}
              </span>
            </button>
          )}

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
            onClick={() => setStep("details")}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Back to your details
          </button>
        </form>
      )}
    </div>
  )
}
