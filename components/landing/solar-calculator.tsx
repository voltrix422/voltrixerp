"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Upload,
  Camera,
  Zap,
  Sun,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileImage,
  RefreshCw,
  Minus,
  Plus,
  Home,
  Receipt,
  AirVent,
  Refrigerator,
  Lightbulb,
  Tv,
  Droplets,
  WashingMachine,
  Wifi,
} from "lucide-react"
import { runLabelOcrOnImageFile } from "@/lib/label-ocr-browser"
import { parseElectricityBillOcr } from "@/lib/parse-electricity-bill-ocr"
import { calculateSolarSizing, resolveMonthlyUnits } from "@/lib/solar-sizing"
import {
  calculateApplianceEstimate,
  HOME_APPLIANCES,
  type ApplianceEstimateResult,
  type ApplianceSelection,
} from "@/lib/solar-appliance-estimate"
import { isProductPublished } from "@/lib/product-published"
import { formatProductPrice, shouldRequestQuote } from "@/lib/product-display"
import { getProductDisplayName } from "@/lib/product-display-name"
import { getProductImageList, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-image"
import { getCategoryDisplayLabel } from "@/lib/product-categories"
import {
  productAvailabilityLabel,
  type CatalogProduct,
  type ProductAvailability,
} from "@/lib/solar-product-specs"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { GetQuoteButton } from "@/components/ui/get-quote-button"
import type { SolarSizingResult, RecommendedProductLine } from "@/lib/solar-sizing"

const CITIES = [
  "Islamabad",
  "Rawalpindi",
  "Lahore",
  "Karachi",
  "Peshawar",
  "Multan",
  "Faisalabad",
  "Quetta",
  "Other",
]

type CalcMode = "bill" | "estimate"

const APPLIANCE_ICONS: Record<string, typeof Home> = {
  cooling: AirVent,
  kitchen: Refrigerator,
  lighting: Lightbulb,
  entertainment: Tv,
  laundry: WashingMachine,
  water: Droplets,
  other: Wifi,
}

function AvailabilityBadge({ status }: { status: ProductAvailability }) {
  const label = productAvailabilityLabel(status)
  const styles =
    status === "in_stock"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "low_stock"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-neutral-100 text-neutral-600 border-neutral-200"

  return (
    <span className={`inline-flex text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${styles}`}>
      {label}
    </span>
  )
}

function ProductLineCard({
  line,
  badge,
  unitLabel,
}: {
  line: RecommendedProductLine
  badge: string
  unitLabel: string
}) {
  const qtyLabel = line.quantity > 1 ? `${line.quantity} × ` : ""
  const capLabel =
    line.unitCapacity > 0
      ? `${qtyLabel}${line.unitCapacity} ${unitLabel} = ${line.totalCapacity} ${unitLabel} total`
      : null
  return (
    <div className="space-y-1">
      {capLabel && (
        <p className="text-[11px] font-medium text-[#1a9f9a]">{capLabel}</p>
      )}
      <ProductCard product={line.product} badge={badge} availability={line.availability} />
    </div>
  )
}

function ProductCard({
  product,
  badge,
  availability,
}: {
  product: CatalogProduct
  badge: string
  availability: ProductAvailability
}) {
  const { title, model } = getProductDisplayName(product)
  const images = getProductImageList(product)
  const price = formatProductPrice(product.price)
  const quote = shouldRequestQuote(product)
  const unavailable = availability === "out_of_stock" || availability === "not_in_catalog"

  return (
    <div className={`rounded-xl border bg-white p-3 flex gap-3 shadow-sm ${unavailable ? "border-neutral-200 opacity-90" : "border-neutral-200"}`}>
      <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-neutral-50 border border-neutral-100">
        <ProductThumbnail
          src={images[0] || PRODUCT_IMAGE_FALLBACK}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1a9f9a]">
            {badge}
          </span>
          <AvailabilityBadge status={availability} />
        </div>
        <p className="font-semibold text-neutral-900 leading-snug">{title}</p>
        {model && <p className="text-xs text-neutral-500">{model}</p>}
        <p className="text-xs text-neutral-500">
          {getCategoryDisplayLabel(product.category || "")}
        </p>
        {price && !quote && !unavailable && (
          <p className="text-sm font-medium text-neutral-800">{price}</p>
        )}
        {product.id && !unavailable && (
          <Link
            href={`/products/${product.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1a9f9a] hover:underline mt-1"
          >
            View product <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  )
}

function ApplianceRow({
  id,
  label,
  category,
  quantity,
  watts,
  onChange,
}: {
  id: string
  label: string
  category: string
  quantity: number
  watts: number
  onChange: (qty: number) => void
}) {
  const Icon = APPLIANCE_ICONS[category] || Home
  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50/50 px-2 py-1.5">
      <div className="w-7 h-7 rounded-md bg-white border border-neutral-100 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#1a9f9a]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-neutral-900 leading-tight truncate">{label}</p>
        <p className="text-[9px] text-neutral-500">{watts}W</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, quantity - 1))}
          disabled={quantity <= 0}
          className="w-6 h-6 rounded border border-neutral-200 bg-white flex items-center justify-center disabled:opacity-40"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-5 text-center text-xs font-semibold tabular-nums">{quantity}</span>
        <button
          type="button"
          onClick={() => onChange(quantity + 1)}
          className="w-6 h-6 rounded border border-[#1a9f9a]/30 bg-[#1a9f9a]/10 text-[#1a9f9a] flex items-center justify-center"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export default function SolarCalculator() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [mode, setMode] = useState<CalcMode>("bill")

  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const [ocrRaw, setOcrRaw] = useState("")
  const [ocrConfidence, setOcrConfidence] = useState<string | null>(null)

  const [monthlyUnits, setMonthlyUnits] = useState("")
  const [billAmount, setBillAmount] = useState("")
  const [tariff, setTariff] = useState("")
  const [city, setCity] = useState("Islamabad")
  const [phase, setPhase] = useState<"single" | "three">("single")
  const [backupHours, setBackupHours] = useState("6")
  const [applianceQty, setApplianceQty] = useState<ApplianceSelection>({})
  const [appliancePreview, setAppliancePreview] = useState<ApplianceEstimateResult | null>(null)

  const [result, setResult] = useState<SolarSizingResult | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setCatalog(list.filter((p) => isProductPublished(p)))
      })
      .catch(() => setCatalog([]))
  }, [])

  const applyOcr = useCallback((text: string) => {
    const parsed = parseElectricityBillOcr(text)
    setOcrConfidence(parsed.confidence)
    if (parsed.monthlyUnits) setMonthlyUnits(String(Math.round(parsed.monthlyUnits)))
    if (parsed.billAmountPkr) setBillAmount(String(Math.round(parsed.billAmountPkr)))
    if (parsed.tariffPerUnit) setTariff(String(parsed.tariffPerUnit))
    if (parsed.city && CITIES.includes(parsed.city)) setCity(parsed.city)
  }, [])

  const handleBillUpload = async (file: File) => {
    setError("")
    setOcrLoading(true)
    setResult(null)
    try {
      const url = URL.createObjectURL(file)
      setOcrPreview(url)
      const text = await runLabelOcrOnImageFile(file)
      setOcrRaw(text)
      applyOcr(text)
    } catch {
      setError("Could not read the bill image. Try a clearer photo or enter values manually.")
    } finally {
      setOcrLoading(false)
    }
  }

  const updateAppliance = (id: string, qty: number) => {
    setApplianceQty((prev) => ({ ...prev, [id]: qty }))
    setResult(null)
  }

  const runEstimatePreview = useCallback(() => {
    const est = calculateApplianceEstimate(applianceQty, Number(backupHours) || 0)
    setAppliancePreview(est)
    return est
  }, [applianceQty, backupHours])

  useEffect(() => {
    if (mode !== "estimate") return
    const est = calculateApplianceEstimate(applianceQty, Number(backupHours) || 0)
    setAppliancePreview(est)
  }, [mode, applianceQty, backupHours])

  const handleCalculateBill = () => {
    setError("")
    const units = resolveMonthlyUnits(
      monthlyUnits ? Number(monthlyUnits) : null,
      billAmount ? Number(billAmount) : null,
      tariff ? Number(tariff) : null,
    )
    if (!units || units <= 0) {
      setError("Enter monthly units or bill amount so we can estimate your consumption.")
      setResult(null)
      return
    }

    const sizing = calculateSolarSizing(
      {
        monthlyUnits: units,
        billAmountPkr: billAmount ? Number(billAmount) : null,
        tariffPerUnit: tariff ? Number(tariff) : null,
        city,
        phase,
        backupHours: Number(backupHours) || 0,
        estimateSource: "bill",
      },
      catalog,
    )
    setResult(sizing)
    if (!sizing) setError("Could not calculate sizing. Check your inputs.")
  }

  const handleCalculateEstimate = () => {
    setError("")
    const est = runEstimatePreview()
    if (!est) {
      setError("Add at least one appliance (AC, fridge, lights, etc.) to estimate your load.")
      setResult(null)
      return
    }

    const sizing = calculateSolarSizing(
      {
        monthlyUnits: est.monthlyUnits,
        city,
        phase,
        backupHours: est.backupHours,
        backupKwhOverride: est.backupKwh,
        estimateSource: "appliances",
      },
      catalog,
    )
    setResult(sizing)
    if (!sizing) setError("Could not calculate sizing. Check your appliances.")
  }

  const resetBill = () => {
    setOcrPreview(null)
    setOcrRaw("")
    setOcrConfidence(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const sharedSettings = (
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="block space-y-1">
        <span className="text-xs text-neutral-500">City</span>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/30 focus:border-[#1a9f9a] bg-white"
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-neutral-500">Phase</span>
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as "single" | "three")}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/30 focus:border-[#1a9f9a] bg-white"
        >
          <option value="single">Single phase</option>
          <option value="three">Three phase</option>
        </select>
      </label>
      <label className="block space-y-1 sm:col-span-2">
        <span className="text-xs text-neutral-500">Backup hours needed (load shedding / night)</span>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={12}
            step={1}
            value={backupHours}
            onChange={(e) => setBackupHours(e.target.value)}
            className="flex-1 accent-[#1a9f9a]"
          />
          <span className="text-sm font-semibold tabular-nums w-16 text-right">
            {backupHours}h
          </span>
        </div>
      </label>
    </div>
  )

  return (
    <section className="pt-24 pb-12 px-4 min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1a9f9a]">
            Smart sizing
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
            Solar System Calculator
          </h1>
          <p className="text-neutral-600 text-sm leading-relaxed">
            Calculate from your electricity bill or estimate from home appliances — we recommend
            Voltrix inverters and batteries from our store catalog.
          </p>
        </div>

        <div className="flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              setMode("bill")
              setResult(null)
              setError("")
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              mode === "bill"
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            <Receipt className="w-4 h-4" />
            From bill
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("estimate")
              setResult(null)
              setError("")
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              mode === "estimate"
                ? "bg-[#1a9f9a] text-white"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            <Home className="w-4 h-4" />
            From home estimate
          </button>
        </div>

        <div className={`grid gap-5 ${mode === "estimate" ? "xl:grid-cols-12" : "lg:grid-cols-2"}`}>
          <div className={`rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm space-y-4 ${mode === "estimate" ? "xl:col-span-7" : ""}`}>
            {mode === "bill" ? (
              <>
                <div className="flex items-center gap-2">
                  <FileImage className="w-5 h-5 text-[#1a9f9a]" />
                  <h2 className="font-semibold text-neutral-900">1. Upload electricity bill</h2>
                </div>

                <div
                  className={`relative rounded-2xl border-2 border-dashed transition-colors ${
                    ocrPreview ? "border-[#1a9f9a]/40 bg-teal-50/30" : "border-neutral-200 hover:border-[#1a9f9a]/50"
                  } p-6 text-center`}
                >
                  {ocrPreview ? (
                    <div className="space-y-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ocrPreview}
                        alt="Bill preview"
                        className="max-h-48 mx-auto rounded-lg object-contain"
                      />
                      <button
                        type="button"
                        onClick={resetBill}
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Upload different bill
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-full bg-[#1a9f9a]/10 flex items-center justify-center mx-auto">
                        <Camera className="w-6 h-6 text-[#1a9f9a]" />
                      </div>
                      <p className="text-sm text-neutral-600">
                        Photo or screenshot of your IESCO, LESCO, MEPCO, or other DISCO bill
                      </p>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a9f9a] text-white text-sm font-medium hover:bg-[#158a86] transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Choose image
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleBillUpload(f)
                    }}
                  />
                </div>

                {ocrLoading && (
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1a9f9a]" />
                    Reading bill with OCR…
                  </div>
                )}

                {ocrConfidence && !ocrLoading && (
                  <div
                    className={`flex items-start gap-2 text-sm rounded-xl p-3 ${
                      ocrConfidence === "high"
                        ? "bg-emerald-50 text-emerald-800"
                        : ocrConfidence === "medium"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {ocrConfidence === "high" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>
                      {ocrConfidence === "high"
                        ? "Bill read successfully — verify the values below."
                        : ocrConfidence === "medium"
                          ? "Partial bill data detected — please confirm units and amount."
                          : "Low confidence — enter bill details manually below."}
                    </span>
                  </div>
                )}

                <div className="space-y-4 pt-2 border-t border-neutral-100">
                  <p className="text-sm font-medium text-neutral-800">2. Confirm or enter manually</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs text-neutral-500">Monthly units (kWh)</span>
                      <input
                        type="number"
                        value={monthlyUnits}
                        onChange={(e) => setMonthlyUnits(e.target.value)}
                        placeholder="e.g. 800"
                        className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/30 focus:border-[#1a9f9a]"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-neutral-500">Bill amount (PKR)</span>
                      <input
                        type="number"
                        value={billAmount}
                        onChange={(e) => setBillAmount(e.target.value)}
                        placeholder="e.g. 25000"
                        className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/30 focus:border-[#1a9f9a]"
                      />
                    </label>
                    <label className="block space-y-1 sm:col-span-2">
                      <span className="text-xs text-neutral-500">Tariff (PKR/unit, optional)</span>
                      <input
                        type="number"
                        value={tariff}
                        onChange={(e) => setTariff(e.target.value)}
                        placeholder="Auto from bill"
                        className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/30 focus:border-[#1a9f9a]"
                      />
                    </label>
                  </div>
                  {sharedSettings}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-[#1a9f9a]" />
                  <h2 className="font-semibold text-neutral-900">What runs in your home?</h2>
                </div>
                <p className="text-xs text-neutral-600">
                  Select appliances and quantities. We estimate load and match Voltrix products.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
                  {HOME_APPLIANCES.map((a) => (
                    <ApplianceRow
                      key={a.id}
                      id={a.id}
                      label={a.label}
                      category={a.category}
                      watts={a.watts}
                      quantity={applianceQty[a.id] || 0}
                      onChange={(qty) => updateAppliance(a.id, qty)}
                    />
                  ))}
                </div>

                {appliancePreview && (
                  <div className="rounded-lg bg-teal-50/80 border border-[#1a9f9a]/20 px-3 py-2 grid grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <p className="text-neutral-500">Daily</p>
                      <p className="font-bold text-neutral-900">{appliancePreview.dailyKwh} kWh</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Monthly</p>
                      <p className="font-bold text-neutral-900">{appliancePreview.monthlyUnits}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Peak</p>
                      <p className="font-bold text-neutral-900">{appliancePreview.peakLoadKw} kW</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Backup</p>
                      <p className="font-bold text-[#1a9f9a]">{appliancePreview.backupKwh} kWh</p>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-neutral-100">
                  <p className="text-xs font-medium text-neutral-800 mb-2">System settings</p>
                  {sharedSettings}
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}

            <button
              type="button"
              onClick={mode === "bill" ? handleCalculateBill : handleCalculateEstimate}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {mode === "bill" ? "Analyze bill & recommend" : "Calculate & recommend Voltrix kit"}
            </button>
          </div>

          <div className={`space-y-3 ${mode === "estimate" ? "xl:col-span-5 xl:sticky xl:top-24 xl:self-start" : ""}`}>
            {!result ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm text-center space-y-3 min-h-[200px] flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-[#1a9f9a]/10 flex items-center justify-center">
                  <Sun className="w-7 h-7 text-[#1a9f9a]" />
                </div>
                <p className="text-neutral-600 text-sm max-w-xs">
                  {mode === "bill"
                    ? "Upload a bill or enter monthly units to size your system."
                    : "Add your appliances and backup hours — we will match Voltrix products only."}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-[#1a9f9a]/20 bg-gradient-to-br from-teal-50/80 to-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#1a9f9a]" />
                    <h2 className="text-sm font-semibold text-neutral-900">Your analysis</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg bg-white/80 border border-neutral-100 p-2">
                      <p className="text-[9px] uppercase tracking-wider text-neutral-500">Daily</p>
                      <p className="text-sm font-bold text-neutral-900">
                        {result.dailyKwh.toFixed(1)} <span className="text-[10px] font-normal text-neutral-500">kWh</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/80 border border-neutral-100 p-2">
                      <p className="text-[9px] uppercase tracking-wider text-neutral-500">System</p>
                      <p className="text-sm font-bold text-[#1a9f9a]">
                        {result.requiredSystemKw} <span className="text-[10px] font-normal text-neutral-500">kW</span>
                      </p>
                    </div>
                    {result.estimatedBillPkr != null && (
                      <div className="rounded-lg bg-white/80 border border-neutral-100 p-2">
                        <p className="text-[9px] uppercase tracking-wider text-neutral-500">Bill</p>
                        <p className="text-sm font-bold text-neutral-900">
                          {result.estimatedBillPkr.toLocaleString()}
                        </p>
                      </div>
                    )}
                    {result.backupKwh > 0 && (
                      <div className="rounded-lg bg-white/80 border border-neutral-100 p-2">
                        <p className="text-[9px] uppercase tracking-wider text-neutral-500">Backup</p>
                        <p className="text-sm font-bold text-neutral-900">~{result.backupKwh} kWh</p>
                      </div>
                    )}
                  </div>

                  {appliancePreview && result.estimateSource === "appliances" && (
                    <div className="rounded-lg border border-neutral-100 bg-white/60 p-2">
                      <p className="text-[10px] font-semibold text-neutral-800 mb-1">Load breakdown</p>
                      <ul className="text-[10px] text-neutral-600 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                        {appliancePreview.breakdown.map((item) => (
                          <li key={item.id} className="flex justify-between gap-2">
                            <span className="truncate">
                              {item.quantity}× {item.label}
                            </span>
                            <span className="tabular-nums shrink-0">{item.dailyKwh} kWh</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <ul className="text-[10px] text-neutral-600 space-y-1">
                    {result.analysisNotes.map((note, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-[#1a9f9a]">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                    <Sun className="w-4 h-4 text-[#1a9f9a]" />
                    Recommended Voltrix kit
                  </h3>

                  <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1a9f9a]">
                        Solar panels
                      </span>
                      <AvailabilityBadge status={result.panelAvailability} />
                    </div>
                    {result.recommendedPanel.fromCatalog && result.recommendedPanel.product ? (
                      <>
                        <p className="font-semibold text-neutral-900">
                          {result.recommendedPanel.quantity} × {result.recommendedPanel.name}
                        </p>
                        <p className="text-sm text-neutral-600">
                          {result.recommendedPanel.wattage}W each — {result.recommendedPanel.totalKw} kW total
                        </p>
                        <Link
                          href={`/products/${result.recommendedPanel.product.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#1a9f9a] hover:underline"
                        >
                          View in catalog <ArrowRight className="w-3 h-3" />
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-neutral-900">
                          ~{result.recommendedPanel.quantity} panels × {result.recommendedPanel.wattage}W
                          <span className="font-normal text-neutral-500"> ({result.recommendedPanel.totalKw} kW)</span>
                        </p>
                        <p className="text-sm text-neutral-600">
                          Sizing reference only — panels not listed in our store right now.
                        </p>
                      </>
                    )}
                  </div>

                  {result.recommendedInverterLines.length > 0 ? (
                    <div className="space-y-2">
                      {result.recommendedInverterLines.length > 1 && (
                        <p className="text-[11px] text-neutral-600 px-1">
                          Combined ~{result.recommendedInverterLines.reduce((s, l) => s + l.totalCapacity, 0).toFixed(1)} kW
                          inverter capacity for ~{result.requiredSystemKw} kW need
                        </p>
                      )}
                      {result.recommendedInverterLines.map((line) => (
                        <ProductLineCard
                          key={String(line.product.id)}
                          line={line}
                          badge={result.kitIsFusionCombo ? "Inverter + Battery (all-in-one)" : "Inverter"}
                          unitLabel="kW"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      No Voltrix inverter combination found for ~{result.requiredSystemKw} kW — not available in
                      store right now. Contact sales for a custom quote.
                    </div>
                  )}

                  {result.backupKwh > 0 && !result.kitIsFusionCombo && (
                    result.recommendedBatteryLines.length > 0 ? (
                      <div className="space-y-2">
                        {result.recommendedBatteryLines.length > 1 && (
                          <p className="text-[11px] text-neutral-600 px-1">
                            Combined ~{result.recommendedBatteryLines.reduce((s, l) => s + l.totalCapacity, 0).toFixed(1)} kWh
                            storage for ~{result.backupKwh} kWh backup need
                          </p>
                        )}
                        {result.recommendedBatteryLines.map((line) => (
                          <ProductLineCard
                            key={String(line.product.id)}
                            line={line}
                            badge="Battery backup"
                            unitLabel="kWh"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        No Voltrix battery combination for ~{result.backupKwh} kWh — not available in store right
                        now. Request a quote for storage.
                      </div>
                    )
                  )}
                </div>

                <div className="rounded-xl bg-neutral-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Ready for a formal quote?</p>
                    <p className="text-sm text-neutral-400">
                      Our team will finalize pricing, structure, and installation.
                    </p>
                  </div>
                  <GetQuoteButton variant="solid" />
                </div>
              </>
            )}
          </div>
        </div>

        {ocrRaw && process.env.NODE_ENV === "development" && (
          <details className="text-xs text-neutral-400">
            <summary>OCR debug</summary>
            <pre className="mt-2 p-3 bg-neutral-100 rounded-lg overflow-auto max-h-40 whitespace-pre-wrap">
              {ocrRaw}
            </pre>
          </details>
        )}
      </div>
    </section>
  )
}
