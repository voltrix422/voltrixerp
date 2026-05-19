"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react"
import { Html5Qrcode } from "html5-qrcode"
import { mergeLabelScan } from "@/lib/merge-label-scan"
import type { ParsedProductQr } from "@/lib/parse-product-qr"
import { parseProductQrPayload } from "@/lib/parse-product-qr"
import { formatGstPercent, formatRetailPricePkr } from "@/lib/format-inventory-price"
import { runLabelOcrOnImageFile } from "@/lib/label-ocr-browser"
import { playScanRejectBeep, playScanSuccessBeep, prepareScanAudio } from "@/lib/scan-beep"
import {
  getInventorySerialUnits,
  normalizeInventorySerialNumber,
  saveInventorySerialUnitsBatch,
  serialNumberKey,
  type InventorySerialUnit,
} from "@/lib/inventory-serial-units"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/ui/toast"
import {
  Camera,
  QrCode,
  Loader2,
  ImageUp,
  CheckCircle2,
  Trash2,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

type SessionScan = {
  tempId: string
  serialNumber: string
  model: string
  itemNo: string
  internalRef: string
  manufacturedDate: string
  rawPayload: string
  productId: string
  inventoryStockId: string
  productName: string
  specs: string
  notes: string
  retailPrice?: number | null
  gstPercent?: number | null
  scannedAt: string
}

type Props = {
  existingSerialNumbers?: string[]
  onSaved?: (savedCount: number) => void
  compact?: boolean
  /** When "pos", saving also increases POS register stock quantities. */
  receiveTarget?: "inventory" | "pos"
}

function formatDisplayDate(iso?: string) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("en-PK")
  } catch {
    return iso
  }
}

function sessionNotes(scan: SessionScan, receiveDate: string) {
  const parts = [
    receiveDate ? `Received ${receiveDate}` : "",
    scan.manufacturedDate ? `Mfg ${scan.manufacturedDate}` : "",
    scan.itemNo ? `Item ${scan.itemNo}` : "",
    scan.internalRef ? `Ref ${scan.internalRef}` : "",
  ].filter(Boolean)
  return parts.join(" · ")
}

export function InventoryQrScanPanel({
  existingSerialNumbers = [],
  onSaved,
  compact,
  receiveTarget = "inventory",
}: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  /** Last successfully accepted SN — used to silence camera re-reads for ~5s */
  const lastAcceptedScanRef = useRef<{ key: string; at: number }>({ key: "", at: 0 })
  const DUPLICATE_BEEP_GRACE_MS = 5000
  const sessionSerialKeysRef = useRef<Set<string>>(new Set())
  const knownSerialKeysRef = useRef<Set<string>>(new Set())
  const pasteRef = useRef<HTMLTextAreaElement | null>(null)

  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedUnits, setSavedUnits] = useState<InventorySerialUnit[]>([])
  const [existingSerials, setExistingSerials] = useState<Set<string>>(new Set())
  const [sessionScans, setSessionScans] = useState<SessionScan[]>([])
  const [scanMessage, setScanMessage] = useState("")
  const [error, setError] = useState("")
  const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showSummary, setShowSummary] = useState(false)
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})
  const [pasteValue, setPasteValue] = useState("")
  const [ocrLoading, setOcrLoading] = useState(false)
  const [lastPreview, setLastPreview] = useState<ParsedProductQr | null>(null)

  function syncKnownSerials(serials: string[]) {
    const keys = new Set(serials.map((s) => serialNumberKey(s)).filter(Boolean))
    knownSerialKeysRef.current = keys
    setExistingSerials(keys)
  }

  useEffect(() => {
    prepareScanAudio()
    if (compact) {
      syncKnownSerials(existingSerialNumbers)
      setLoading(false)
      return
    }
    void loadRecords()
    return () => {
      void stopScanner()
    }
  }, [compact, existingSerialNumbers.join("|")])

  async function loadRecords() {
    setLoading(true)
    try {
      const unitRows = await getInventorySerialUnits()
      setSavedUnits(unitRows)
      syncKnownSerials(unitRows.map((u) => u.serialNumber))
    } catch (loadError) {
      console.error(loadError)
      setError("Failed to load scanned units.")
    } finally {
      setLoading(false)
    }
  }

  const groupedByModel = useMemo(() => {
    const map = new Map<string, SessionScan[]>()
    const seenSn = new Set<string>()
    for (const scan of sessionScans) {
      const snKey = serialNumberKey(scan.serialNumber)
      if (!snKey || seenSn.has(snKey)) continue
      seenSn.add(snKey)
      const modelKey = scan.model || "Unknown model"
      const list = map.get(modelKey) ?? []
      list.push(scan)
      map.set(modelKey, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [sessionScans])

  const sessionTotal = sessionScans.length

  function buildSessionScan(parsed: ParsedProductQr, rawPayload: string): SessionScan | null {
    if (!parsed.serialNumber) {
      setError("No serial number (SN) found. Scan QR, use a label photo, or paste text with model + SN.")
      return null
    }

    const manufacturedDate = parsed.extra.manufacturedDate || ""
    const productId =
      parsed.extra.partNo || parsed.productId || parsed.extra.productId || parsed.extra.poNumber || ""
    const itemNo = parsed.extra.itemNo || parsed.extra.batchRef || ""
    const internalRef = parsed.extra.internalRef || ""

    const serialNumber = normalizeInventorySerialNumber(parsed.serialNumber)
    if (!serialNumber) return null

    return {
      tempId: `${serialNumber}-${Date.now()}`,
      serialNumber,
      model: parsed.model || parsed.productName || "Unknown model",
      itemNo,
      internalRef,
      manufacturedDate,
      rawPayload: rawPayload.trim(),
      productId,
      inventoryStockId: parsed.inventoryStockId || "",
      productName: parsed.productName || parsed.model || "Unknown model",
      specs: parsed.specs || productId || internalRef,
      notes: parsed.notes || "",
      retailPrice: parsed.retailPrice ?? null,
      gstPercent: parsed.gstPercent ?? null,
      scannedAt: new Date().toISOString(),
    }
  }

  function rejectDuplicate(sn: string, reason: string) {
    playScanRejectBeep()
    setScanMessage(`${reason}: ${sn}`)
    setError("")
  }

  function addScanFromMerged(parsed: ParsedProductQr, rawPayload: string) {
    const scan = buildSessionScan(parsed, rawPayload)
    if (!scan) return

    const snKey = serialNumberKey(scan.serialNumber)
    const now = Date.now()
    const withinGrace =
      lastAcceptedScanRef.current.key === snKey &&
      now - lastAcceptedScanRef.current.at < DUPLICATE_BEEP_GRACE_MS

    if (withinGrace) {
      return
    }

    if (sessionSerialKeysRef.current.has(snKey)) {
      rejectDuplicate(scan.serialNumber, "Already scanned this session")
      return
    }

    if (knownSerialKeysRef.current.has(snKey)) {
      rejectDuplicate(scan.serialNumber, "Already in inventory")
      return
    }

    sessionSerialKeysRef.current.add(snKey)
    setSessionScans((prev) => {
      if (prev.some((s) => serialNumberKey(s.serialNumber) === snKey)) {
        return prev
      }
      return [...prev, scan]
    })

    lastAcceptedScanRef.current = { key: snKey, at: now }

    setExpandedModels((prev) => ({ ...prev, [scan.model]: true }))
    playScanSuccessBeep()
    const idHint = scan.productId ? ` · ID ${scan.productId}` : ""
    setScanMessage(`+1 · ${scan.model} · SN ${scan.serialNumber}${idHint}`)
    setLastPreview(parsed)
    setError("")
    setPasteValue("")
  }

  function addScanFromPayload(payload: string) {
    const trimmed = payload.trim()
    if (!trimmed) return

    let qrText = ""
    let ocrText = ""

    if (trimmed.includes("\n---\n")) {
      const parts = trimmed.split(/\n---\n/)
      qrText = parts[0]?.trim() || ""
      ocrText = parts.slice(1).join("\n").trim()
    } else if (trimmed.includes("\n")) {
      ocrText = trimmed
      const firstLine = trimmed.split("\n")[0]?.trim() || ""
      if (/^https?:\/\//i.test(firstLine) || (firstLine.includes("/") && firstLine.length > 20)) {
        qrText = firstLine
      }
    } else if (/^https?:\/\//i.test(trimmed)) {
      qrText = trimmed
    } else {
      const parsed = mergeLabelScan(trimmed, trimmed)
      addScanFromMerged(parsed, trimmed)
      return
    }

    const parsed = mergeLabelScan(qrText, ocrText || trimmed)
    addScanFromMerged(parsed, trimmed)
  }

  function addScanFromLabelImage(qrText: string, ocrText: string) {
    const parsed = mergeLabelScan(qrText, ocrText)
    setLastPreview(parsed)
    if (!parsed.serialNumber) {
      setError(
        ocrText || qrText
          ? "Read label text but could not find SN. Paste or edit text below, then Add."
          : "No QR or readable text on this image.",
      )
      if (ocrText || qrText) {
        setPasteValue([qrText, ocrText].filter(Boolean).join("\n---\n"))
      }
      return
    }
    const raw = [qrText && `QR:${qrText}`, ocrText && `OCR:${ocrText.slice(0, 500)}`].filter(Boolean).join("\n")
    addScanFromMerged(parsed, raw)
  }

  async function waitForScannerMount() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  }

  async function resolveCameraId() {
    try {
      const cameras = await Html5Qrcode.getCameras()
      if (cameras.length === 0) return { facingMode: "environment" as const }
      const preferred = cameras.find((camera) => /back|rear|environment/i.test(camera.label))
      return preferred?.id || cameras[0].id
    } catch {
      return { facingMode: "environment" as const }
    }
  }

  async function startScanner() {
    if (scanning) return
    setError("")
    setScanMessage("Continuous scan on — scan each box QR.")
    setScanning(true)
    prepareScanAudio()
    await waitForScannerMount()

    try {
      const scanner = new Html5Qrcode("inventory-qr-reader", { verbose: false })
      scannerRef.current = scanner
      const cameraId = await resolveCameraId()
      await scanner.start(
        cameraId,
        { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        (decodedText) => {
          addScanFromPayload(decodedText)
        },
        () => undefined,
      )
    } catch (scanError) {
      console.error(scanError)
      setError("Could not open the camera. Paste QR text or upload an image.")
      setScanning(false)
      scannerRef.current = null
    }
  }

  async function stopScanner() {
    const scanner = scannerRef.current
    scannerRef.current = null
    setScanning(false)
    if (!scanner) return
    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
      scanner.clear()
    } catch {
      // Ignore cleanup errors.
    }
  }

  async function handleImageFile(file: File) {
    setError("")
    setOcrLoading(true)
    await stopScanner()
    let qrText = ""
    try {
      const scanner = new Html5Qrcode("inventory-qr-reader", { verbose: false })
      try {
        qrText = await scanner.scanFile(file, false)
      } catch {
        try {
          qrText = await scanner.scanFile(file, true)
        } catch {
          // QR optional when label has printed model/SN
        }
      }
    } catch (scanError) {
      console.error(scanError)
    }

    let ocrText = ""
    try {
      ocrText = await runLabelOcrOnImageFile(file)
    } catch (ocrError) {
      console.error(ocrError)
    } finally {
      setOcrLoading(false)
    }

    if (!qrText && !ocrText.trim()) {
      setError("No QR or readable text on this image.")
      return
    }

    addScanFromLabelImage(qrText, ocrText)
  }

  function handleImageInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) void handleImageFile(file)
  }

  function handlePasteSubmit() {
    if (!pasteValue.trim()) return
    prepareScanAudio()
    addScanFromPayload(pasteValue)
    pasteRef.current?.focus()
  }

  function handlePasteKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handlePasteSubmit()
    }
  }

  function handlePasteArea(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text").trim()
    if (!pasted) return
    event.preventDefault()
    addScanFromPayload(pasted)
  }

  function removeFromSession(tempId: string) {
    setSessionScans((prev) => {
      const removed = prev.find((s) => s.tempId === tempId)
      if (removed) {
        sessionSerialKeysRef.current.delete(serialNumberKey(removed.serialNumber))
      }
      return prev.filter((s) => s.tempId !== tempId)
    })
  }

  function clearSession() {
    if (sessionScans.length > 0 && !confirm("Clear all scans in this session?")) return
    sessionSerialKeysRef.current = new Set()
    setSessionScans([])
    setScanMessage("")
    setShowSummary(false)
  }

  function dedupeSessionScans(scans: SessionScan[]): SessionScan[] {
    const seen = new Set<string>()
    const out: SessionScan[] = []
    for (const scan of scans) {
      const key = serialNumberKey(scan.serialNumber)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(scan)
    }
    return out
  }

  async function completeAndSave() {
    if (sessionScans.length === 0) return
    setShowSummary(true)
  }

  async function confirmSave() {
    setSaving(true)
    setError("")
    const receiveLabel = formatDisplayDate(receiveDate) || receiveDate
    const scannedBy = user?.name || "system"
    const batchLabel = `Bulk receive ${receiveLabel}`

    try {
      const toSave = dedupeSessionScans(sessionScans)

      if (receiveTarget === "pos") {
        const res = await fetch("/api/db/pos/receive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiveDate,
            scannedBy,
            scans: toSave.map((scan) => ({
              serialNumber: scan.serialNumber,
              model: scan.model,
              productName: scan.productName,
              specs: scan.specs,
              productId: scan.productId,
              rawPayload: scan.rawPayload,
              retailPrice: scan.retailPrice,
              gstPercent: scan.gstPercent,
            })),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || "POS receive failed")
        }

        const serialsSaved = Number((data as { serialsSaved?: number }).serialsSaved) || 0
        const serialErrors = ((data as { serialErrors?: { serialNumber: string; error: string }[] }).serialErrors) || []

        for (const scan of toSave) {
          knownSerialKeysRef.current.add(serialNumberKey(scan.serialNumber))
        }
        setExistingSerials(new Set(knownSerialKeysRef.current))
        sessionSerialKeysRef.current = new Set()
        setSessionScans([])
        setShowSummary(false)
        await stopScanner()

        toast({
          title: "Added to POS inventory",
          message: `${serialsSaved} unit(s) ready to sell${serialErrors.length ? ` · ${serialErrors.length} skipped` : ""}.`,
          type: serialsSaved === 0 ? "error" : "success",
        })

        if (serialErrors.length > 0) {
          setError(
            serialErrors
              .slice(0, 5)
              .map((e) => `${e.serialNumber}: ${e.error}`)
              .join(" · "),
          )
        }

        if (serialsSaved > 0) onSaved?.(serialsSaved)
      } else {
        const { saved, errors } = await saveInventorySerialUnitsBatch(
          toSave.map((scan) => ({
            serialNumber: scan.serialNumber,
            assignedName: batchLabel,
            productName: scan.productName,
            model: scan.model,
            specs: scan.specs,
            rawPayload: scan.rawPayload,
            inventoryStockId: scan.inventoryStockId || undefined,
            notes: sessionNotes(scan, receiveLabel),
            retailPrice: scan.retailPrice,
            gstPercent: scan.gstPercent,
            scannedBy,
            createWarranty: true,
          })),
        )

        for (const unit of saved) {
          knownSerialKeysRef.current.add(serialNumberKey(unit.serialNumber))
        }
        setExistingSerials(new Set(knownSerialKeysRef.current))
        setSavedUnits((prev) => [...saved, ...prev])
        sessionSerialKeysRef.current = new Set()
        setSessionScans([])
        setShowSummary(false)
        await stopScanner()

        toast({
          title: "Receiving saved",
          message: `${saved.length} unit(s) registered${errors.length ? ` · ${errors.length} skipped` : ""}.`,
          type: errors.length && saved.length === 0 ? "error" : "success",
        })

        if (errors.length > 0) {
          setError(
            errors
              .slice(0, 5)
              .map((e) => `${e.serialNumber}: ${e.error}`)
              .join(" · ") + (errors.length > 5 ? ` · +${errors.length - 5} more` : ""),
          )
        }

        if (saved.length > 0) onSaved?.(saved.length)
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save receiving batch.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className={compact ? "space-y-4" : "rounded-lg border bg-[hsl(var(--card))] p-4 space-y-4"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[#1faca6]" />
              Bulk QR receiving
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
              {receiveTarget === "pos"
                ? "Scan QR codes or photograph labels. Each unit adds to POS stock by model — then sell from Register."
                : "Scan QR codes or photograph the full label. We read the QR plus OCR (model, SN, product ID / PO) and save each unit. When finished, tap Complete scan to review and save."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Receive date</label>
            <input
              type="date"
              value={receiveDate}
              onChange={(e) => setReceiveDate(e.target.value)}
              className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className={`h-8 text-xs ${scanning ? "bg-red-600 hover:bg-red-700" : "bg-[#1faca6] hover:bg-[#17857f]"} text-white`}
            onClick={scanning ? stopScanner : startScanner}
          >
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            {scanning ? "Stop scanning" : "Start scanning"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageInputChange}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={ocrLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {ocrLoading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <ImageUp className="h-3.5 w-3.5 mr-1.5" />
            )}
            {ocrLoading ? "Reading label…" : "Label photo"}
          </Button>
          {sessionScans.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs text-red-600" onClick={clearSession}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear session
            </Button>
          )}
        </div>

        <div
          id="inventory-qr-reader"
          className={scanning ? "min-h-[260px] overflow-hidden rounded-lg border bg-black/5" : "hidden"}
        />

        <div className="flex gap-2">
          <textarea
            ref={pasteRef}
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            onPaste={handlePasteArea}
            onKeyDown={handlePasteKeyDown}
            rows={1}
            placeholder="Paste QR / label text (model, SN, P/N) and press Enter"
            className="flex-1 rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-xs resize-none"
          />
          <Button size="sm" variant="outline" className="h-9 text-xs shrink-0" onClick={handlePasteSubmit}>
            Add
          </Button>
        </div>

        {scanMessage && <p className="text-xs text-[#17857f]">{scanMessage}</p>}
        {lastPreview?.serialNumber && (
          <div className="rounded-md border bg-[hsl(var(--muted))]/15 px-3 py-2 text-[11px] space-y-0.5">
            <p>
              <span className="text-[hsl(var(--muted-foreground))]">Model:</span>{" "}
              <span className="font-medium">{lastPreview.model || "—"}</span>
            </p>
            <p>
              <span className="text-[hsl(var(--muted-foreground))]">SN:</span>{" "}
              <span className="font-mono font-medium">{lastPreview.serialNumber}</span>
            </p>
            {lastPreview.extra.itemNo && (
              <p>
                <span className="text-[hsl(var(--muted-foreground))]">Item No.:</span>{" "}
                <span className="font-medium">{lastPreview.extra.itemNo}</span>
              </p>
            )}
            {(lastPreview.extra.partNo || lastPreview.productId) && (
              <p>
                <span className="text-[hsl(var(--muted-foreground))]">Part No.:</span>{" "}
                <span className="font-medium">{lastPreview.extra.partNo || lastPreview.productId}</span>
              </p>
            )}
            {lastPreview.retailPrice != null && (
              <p>
                <span className="text-[hsl(var(--muted-foreground))]">Retail:</span>{" "}
                <span className="font-medium">{formatRetailPricePkr(lastPreview.retailPrice)}</span>
              </p>
            )}
            {lastPreview.gstPercent != null && (
              <p>
                <span className="text-[hsl(var(--muted-foreground))]">GST:</span>{" "}
                <span className="font-medium">{formatGstPercent(lastPreview.gstPercent)}</span>
              </p>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-[hsl(var(--muted))]/20 px-3 py-2">
          <div className="flex items-center gap-3 text-xs">
            <span>
              Session: <strong>{sessionTotal}</strong> box{sessionTotal !== 1 ? "es" : ""}
            </span>
            <span>
              Models: <strong>{groupedByModel.length}</strong>
            </span>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white"
            disabled={sessionTotal === 0 || saving}
            onClick={completeAndSave}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Complete scan
          </Button>
        </div>

        {sessionTotal === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-[hsl(var(--muted-foreground))] border border-dashed rounded-lg">
            <Package className="h-8 w-8 opacity-30 mb-2" />
            <p className="text-sm">No boxes scanned yet</p>
            <p className="text-xs mt-1">Start the camera and scan each box QR in the warehouse.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedByModel.map(([modelKey, scans]) => {
              const expanded = expandedModels[modelKey] !== false
              return (
                <div key={modelKey} className="rounded-lg border overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50 text-left"
                    onClick={() => setExpandedModels((prev) => ({ ...prev, [modelKey]: !expanded }))}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{modelKey}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="bg-[#1faca6] text-white text-[10px]">{scans.length} pcs</Badge>
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="divide-y max-h-48 overflow-y-auto">
                      {scans.map((scan) => (
                        <div key={scan.tempId} className="px-3 py-2 flex items-start justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium break-all">SN {scan.serialNumber}</p>
                            <p className="text-[hsl(var(--muted-foreground))] mt-0.5">
                              {scan.manufacturedDate ? `Mfg ${scan.manufacturedDate}` : "—"}
                              {scan.productId ? ` · ID ${scan.productId}` : scan.itemNo ? ` · Item ${scan.itemNo}` : ""}
                            </p>
                            {(scan.retailPrice != null || scan.gstPercent != null) && (
                              <p className="text-[hsl(var(--muted-foreground))] mt-0.5">
                                {scan.retailPrice != null ? formatRetailPricePkr(scan.retailPrice) : ""}
                                {scan.retailPrice != null && scan.gstPercent != null ? " · " : ""}
                                {scan.gstPercent != null ? `GST ${formatGstPercent(scan.gstPercent)}` : ""}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="text-red-600 shrink-0 hover:underline"
                            onClick={() => removeFromSession(scan.tempId)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!compact && (
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-[hsl(var(--muted))]/40 flex items-center justify-between">
          <p className="text-sm font-semibold">Registered units</p>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{savedUnits.length} total</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : savedUnits.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] px-4 py-8">No QR units saved yet.</p>
        ) : (
          <div className="divide-y max-h-64 overflow-y-auto">
            {savedUnits.slice(0, 30).map((unit) => (
              <div key={unit.id} className="px-4 py-2.5 text-xs">
                <p className="font-medium">{unit.model || unit.productName || "—"}</p>
                <p className="text-[hsl(var(--muted-foreground))]">
                  SN {unit.serialNumber} · {formatDisplayDate(unit.scannedAt)}
                  {(unit.retailPrice != null || unit.gstPercent != null) && (
                    <>
                      {" · "}
                      {unit.retailPrice != null ? formatRetailPricePkr(unit.retailPrice) : ""}
                      {unit.retailPrice != null && unit.gstPercent != null ? " · " : ""}
                      {unit.gstPercent != null ? `GST ${formatGstPercent(unit.gstPercent)}` : ""}
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      )}


      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setShowSummary(false)}>
          <div
            className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Complete scan — review & save</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Receive date: <strong>{formatDisplayDate(receiveDate) || receiveDate}</strong> ·{" "}
              <strong>{sessionTotal}</strong> box{sessionTotal !== 1 ? "es" : ""} across{" "}
              <strong>{groupedByModel.length}</strong> model{groupedByModel.length !== 1 ? "s" : ""}
            </p>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[hsl(var(--muted))]/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Model</th>
                    <th className="text-right px-3 py-2 font-medium w-16">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupedByModel.map(([modelKey, scans]) => (
                    <tr key={modelKey}>
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium">{modelKey}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 break-all">
                          {scans.map((s) => s.serialNumber).join(", ")}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold align-top">{scans.length}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[hsl(var(--muted))]/20 font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{sessionTotal}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={saving} onClick={() => setShowSummary(false)}>
                Back to scanning
              </Button>
              <Button
                size="sm"
                className="bg-[#1faca6] hover:bg-[#17857f] text-white"
                disabled={saving}
                onClick={() => void confirmSave()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Save {sessionTotal} to system
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
