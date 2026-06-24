// @ts-nocheck
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Upload,
  Camera,
  Zap,
  Sun,
  Battery,
  Cpu,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileImage,
  RefreshCw,
} from "lucide-react"
import { runLabelOcrOnImageFile } from "@/lib/label-ocr-browser"
import { parseElectricityBillOcr } from "@/lib/parse-electricity-bill-ocr"
import { calculateSolarSizing, resolveMonthlyUnits } from "@/lib/solar-sizing"
import { isProductPublished } from "@/lib/product-published"
import { formatProductPrice, shouldRequestQuote } from "@/lib/product-display"
import { getProductDisplayName } from "@/lib/product-display-name"
import { getProductImageList, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-image"
import { getCategoryDisplayLabel } from "@/lib/product-categories"
import { getProductKw, getProductKwh } from "@/lib/solar-product-specs"
import { ProductThumbnail } from "@/components/products/product-thumbnail"
import { GetQuoteButton } from "@/components/ui/get-quote-button"

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

function ProductCard({ product, badge }: { product: any; badge: string }) {
  if (!product) return null
  const { title, model } = getProductDisplayName(product)
  const images = getProductImageList(product)
  const price = formatProductPrice(product.price)
  const quote = shouldRequestQuote(product)

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 flex gap-4 shadow-sm">
      <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-neutral-50 border border-neutral-100">
        <ProductThumbnail
          src={images[0] || PRODUCT_IMAGE_FALLBACK}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1a9f9a]">
          {badge}
        </span>
        <p className="font-semibold text-neutral-900 leading-snug">{title}</p>
        {model && <p className="text-xs text-neutral-500">{model}</p>}
        <p className="text-xs text-neutral-500">
          {getCategoryDisplayLabel(product.category || "")}
        </p>
        {price && !quote && (
          <p className="text-sm font-medium text-neutral-800">{price}</p>
        )}
        {product.id && (
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

export default function SolarCalculator() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [catalog, setCatalog] = useState<any[]>([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const [ocrRaw, setOcrRaw] = useState("")
  const [ocrConfidence, setOcrConfidence] = useState<string | null>(null)

  const [monthlyUnits, setMonthlyUnits] = useState("")
  const [billAmount, setBillAmount] = useState("")
  const [tariff, setTariff] = useState("")
  const [city, setCity] = useState("Islamabad")
  const [phase, setPhase] = useState<"single" | "three">("single")
  const [backupHours, setBackupHours] = useState("4")
  const [result, setResult] = useState<ReturnType<typeof calculateSolarSizing> | null>(null)
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

  const handleCalculate = () => {
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
      },
      catalog,
    )
    setResult(sizing)
    if (!sizing) setError("Could not calculate sizing. Check your inputs.")
  }

  const resetBill = () => {
    setOcrPreview(null)
    setOcrRaw("")
    setOcrConfidence(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <section className="pt-28 pb-20 px-4 min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1a9f9a]">
            Smart sizing
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
            Solar System Calculator
          </h1>
          <p className="text-neutral-600 text-sm sm:text-base leading-relaxed">
            Upload your electricity bill — we read units and amount with OCR — then recommend
            Voltrix panels, inverters, and batteries from our catalog.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Bill upload */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5">
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
                <label className="block space-y-1">
                  <span className="text-xs text-neutral-500">Tariff (PKR/unit, optional)</span>
                  <input
                    type="number"
                    value={tariff}
                    onChange={(e) => setTariff(e.target.value)}
                    placeholder="Auto from bill"
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/30 focus:border-[#1a9f9a]"
                  />
                </label>
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
                <label className="block space-y-1">
                  <span className="text-xs text-neutral-500">Backup hours (battery)</span>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={backupHours}
                    onChange={(e) => setBackupHours(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/30 focus:border-[#1a9f9a]"
                  />
                </label>
              </div>

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleCalculate}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Analyze & recommend system
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {!result ? (
              <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm text-center space-y-4 min-h-[320px] flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-[#1a9f9a]/10 flex items-center justify-center">
                  <Sun className="w-7 h-7 text-[#1a9f9a]" />
                </div>
                <p className="text-neutral-600 text-sm max-w-xs">
                  Upload a bill or enter your monthly units, then we&apos;ll size your system and
                  match Voltrix products.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-[#1a9f9a]/20 bg-gradient-to-br from-teal-50/80 to-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#1a9f9a]" />
                    <h2 className="font-semibold text-neutral-900">Your analysis</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/80 border border-neutral-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                        Daily use
                      </p>
                      <p className="text-lg font-bold text-neutral-900">
                        {result.dailyKwh.toFixed(1)}{" "}
                        <span className="text-sm font-normal text-neutral-500">kWh</span>
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-neutral-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                        System size
                      </p>
                      <p className="text-lg font-bold text-[#1a9f9a]">
                        {result.requiredSystemKw}{" "}
                        <span className="text-sm font-normal text-neutral-500">kW</span>
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-neutral-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                        Est. bill
                      </p>
                      <p className="text-lg font-bold text-neutral-900">
                        PKR {result.estimatedBillPkr?.toLocaleString() ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-neutral-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                        Est. saving
                      </p>
                      <p className="text-lg font-bold text-emerald-600">
                        PKR {result.estimatedMonthlySavingPkr?.toLocaleString() ?? "—"}
                        <span className="text-xs font-normal text-neutral-500">/mo</span>
                      </p>
                    </div>
                  </div>
                  <ul className="text-xs text-neutral-600 space-y-1.5">
                    {result.analysisNotes.map((note, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[#1a9f9a]">•</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                    <Sun className="w-4 h-4 text-[#1a9f9a]" />
                    Recommended kit
                  </h3>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1a9f9a]">
                      Solar panels
                    </span>
                    <p className="font-semibold text-neutral-900 mt-1">
                      {result.recommendedPanel.quantity} × {result.recommendedPanel.name}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {result.recommendedPanel.wattage}W each — {result.recommendedPanel.totalKw}{" "}
                      kW total array
                    </p>
                    {result.recommendedPanel.product?.id && (
                      <Link
                        href={`/products/${result.recommendedPanel.product.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#1a9f9a] hover:underline mt-2"
                      >
                        View in catalog <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>

                  {result.recommendedInverter ? (
                    <ProductCard product={result.recommendedInverter} badge="Inverter" />
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      No matching inverter in catalog for {result.requiredSystemKw} kW — contact
                      sales for a custom quote.
                    </div>
                  )}

                  {result.backupKwh > 0 &&
                    (result.recommendedBattery ? (
                      <ProductCard product={result.recommendedBattery} badge="Battery backup" />
                    ) : (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        No battery ≥ {result.backupKwh} kWh in catalog — request a quote for storage.
                      </div>
                    ))}

                  {result.recommendedInverter && (
                    <p className="text-xs text-neutral-500 px-1">
                      Inverter rating: ~{getProductKw(result.recommendedInverter) || "—"} kW
                      {result.recommendedBattery &&
                        ` · Battery: ~${getProductKwh(result.recommendedBattery) || "—"} kWh`}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-neutral-900 text-white p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
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
