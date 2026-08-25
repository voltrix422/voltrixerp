"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { Camera, CheckCircle2, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WarrantyQrScanner } from "@/components/warranty/warranty-qr-scanner"
import { normalizeInventorySerialNumber, serialNumberKey } from "@/lib/inventory-serial-units"
import { looksLikeProductModel } from "@/lib/label-field-utils"
import {
  dispatchScanModelMatches,
  modelKey,
  normalizeDispatchModelKey,
  type ManualDispatchMeta,
} from "@/lib/order-fulfillment-serials"
import { parseProductQrPayload } from "@/lib/parse-product-qr"
import { playScanRejectBeep, playScanSuccessBeep, prepareScanAudio } from "@/lib/scan-beep"
import { type OrderItem, isManualDispatchLine, resolveOrderItemModel } from "@/lib/orders"

type ScanRecord = {
  serialNumber: string
  model: string
  productName: string
}

type Props = {
  lines: OrderItem[]
  value: Record<string, string[]>
  onChange: Dispatch<SetStateAction<Record<string, string[]>>>
  manualMeta?: Record<string, ManualDispatchMeta>
  warehouseStockByModel?: Record<string, number>
  /** Per-line scan target (partial dispatch). Falls back to order qty. */
  dispatchableQtyByLineId?: Record<string, number>
  orderId?: string
  orderNumber?: string
  disabled?: boolean
  /** When false, skip USB wedge auto-focus (e.g. scan tab hidden). */
  allowFocus?: boolean
}

function extractSerialFromScan(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const parsed = parseProductQrPayload(trimmed)
    const serial = parsed.serialNumber?.trim() || ""
    const model = parsed.model?.trim() || ""
    if (serial && serial !== model) return serial
    if (model && (!serial || serial === model)) return ""
  } catch {
    // plain barcode
  }
  const fallback = trimmed.split(/[\s,;]+/)[0]?.trim() ?? trimmed
  if (looksLikeProductModel(fallback)) return ""
  return fallback
}

function parseScanDetails(raw: string, orderModel: string, fallbackName: string) {
  const trimmed = raw.trim()
  try {
    const parsed = parseProductQrPayload(trimmed)
    const parsedModel = parsed.model?.trim() || ""
    const parsedSerial = parsed.serialNumber?.trim() || ""
    const payloadIsProductCode =
      looksLikeProductModel(trimmed) &&
      normalizeDispatchModelKey(trimmed) === normalizeDispatchModelKey(orderModel)

    if (payloadIsProductCode && (!parsedSerial || parsedSerial === parsedModel || parsedSerial === trimmed)) {
      return {
        serialNumber: "",
        model: orderModel,
        productName: fallbackName,
      }
    }

    const serialNumber = parsedSerial && parsedSerial !== parsedModel ? parsedSerial : extractSerialFromScan(raw)
    let model = parsedModel || orderModel
    if (parsedModel && serialNumber && orderModel) {
      const glued = `${parsedModel}-${serialNumber}`
      if (modelKey(glued) === modelKey(orderModel)) {
        model = orderModel
      } else if (normalizeDispatchModelKey(parsedModel) === normalizeDispatchModelKey(orderModel)) {
        model = orderModel
      }
    }
    return {
      serialNumber,
      model,
      productName: parsed.productName?.trim() || fallbackName,
    }
  } catch {
    return {
      serialNumber: extractSerialFromScan(raw),
      model: orderModel,
      productName: fallbackName,
    }
  }
}

export function DispatchSerialScanPanel({
  lines,
  value,
  onChange,
  manualMeta = {},
  warehouseStockByModel = {},
  dispatchableQtyByLineId = {},
  disabled,
  allowFocus = true,
}: Props) {
  const valueRef = useRef(value)
  valueRef.current = value

  const scanLockRef = useRef(false)
  const wedgeRef = useRef<HTMLInputElement>(null)

  const [wedgeBuffer, setWedgeBuffer] = useState("")
  const [scannerOpen, setScannerOpen] = useState(false)
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [scanRecords, setScanRecords] = useState<Record<string, ScanRecord[]>>({})
  /** Line the user picked to scan first; falls back to first unfinished line. */
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)

  const lineStates = useMemo(() => {
    return lines.map((item) => {
      const model = resolveOrderItemModel(item)
      const orderQty = Math.max(0, Math.floor(Number(item.qty) || 0))
      const dispatchable = dispatchableQtyByLineId[item.id]
      const need =
        dispatchable !== undefined
          ? Math.max(0, Math.floor(dispatchable))
          : orderQty
      const selectedSerials = value[item.id] ?? []
      const records = scanRecords[item.id] ?? []
      const manualInfo = model ? manualMeta[modelKey(model)] : undefined
      const stockQty = model ? warehouseStockByModel[modelKey(model)] : undefined
      return {
        item,
        model,
        orderQty,
        need,
        selectedSerials,
        records,
        manualInfo,
        stockQty,
        done: need === 0 || (need > 0 && selectedSerials.length >= need),
        skipped: need === 0 && orderQty > 0,
      }
    })
  }, [lines, manualMeta, scanRecords, value, warehouseStockByModel, dispatchableQtyByLineId])

  const activeLine = useMemo(() => {
    if (selectedLineId) {
      const picked = lineStates.find((l) => l.item.id === selectedLineId)
      if (picked && !picked.done) return picked
    }
    return lineStates.find((l) => !l.done) ?? null
  }, [lineStates, selectedLineId])

  // When the picked line is complete, fall back to auto-advance.
  useEffect(() => {
    if (!selectedLineId) return
    const picked = lineStates.find((l) => l.item.id === selectedLineId)
    if (!picked || picked.done) setSelectedLineId(null)
  }, [lineStates, selectedLineId])

  const totalNeed = lineStates.reduce((s, l) => s + l.need, 0)
  const totalScanned = lineStates.reduce((s, l) => s + l.selectedSerials.length, 0)
  const allDone = lineStates.every((l) => l.done)

  useEffect(() => {
    if (allDone) setScannerOpen(false)
  }, [allDone])

  useEffect(() => {
    if (!allowFocus || disabled || allDone || scannerOpen || !activeLine) return
    wedgeRef.current?.focus()
  }, [allowFocus, disabled, allDone, scannerOpen, activeLine?.item.id])

  useEffect(() => {
    setScanRecords(() => {
      const next: Record<string, ScanRecord[]> = {}
      for (const item of lines) {
        const serials = value[item.id] ?? []
        const model = resolveOrderItemModel(item) ?? ""
        next[item.id] = serials.map((serialNumber) => ({
          serialNumber,
          model,
          productName: item.description,
        }))
      }
      return next
    })
  }, [lines, value])

  const applyScan = useCallback(
    (lineId: string, raw: string): boolean => {
      if (scanLockRef.current || disabled) return false

      const lineState = lineStates.find((l) => l.item.id === lineId)
      if (!lineState) return false

      const { item, model, need, manualInfo, stockQty } = lineState
      if (!model) {
        setMessage({ type: "err", text: "This item has no model code." })
        playScanRejectBeep()
        return false
      }

      const currentSerials = valueRef.current[lineId] ?? []
      if (currentSerials.length >= need) {
        setMessage({ type: "err", text: `Order qty reached (${need}). No more scans.` })
        playScanRejectBeep()
        return false
      }

      const details = parseScanDetails(raw, model, item.description)
      const serialRaw = normalizeInventorySerialNumber(details.serialNumber)
      if (!serialRaw) {
        setMessage({
          type: "err",
          text: `This QR is the product code (${details.model || model}) only — no serial number. Print a QR with model and serial, e.g. ${model}/SN12345.`,
        })
        playScanRejectBeep()
        return false
      }

      const isManual = isManualDispatchLine(item)
      const scannedModel = details.model?.trim()
      if (
        !isManual &&
        scannedModel &&
        !dispatchScanModelMatches(model, scannedModel, serialRaw, raw)
      ) {
        setMessage({
          type: "err",
          text: `QR model "${scannedModel}" does not match order model "${model}".`,
        })
        playScanRejectBeep()
        return false
      }

      const snKey = serialNumberKey(serialRaw)
      const usedOnOrder = Object.entries(valueRef.current).some(([, serials]) =>
        serials.some((sn) => serialNumberKey(sn) === snKey),
      )
      if (usedOnOrder) {
        setMessage({ type: "err", text: `${serialRaw} is already scanned on this order.` })
        playScanRejectBeep()
        return false
      }

      if (isManual && manualInfo !== undefined && currentSerials.length >= manualInfo.availableQty) {
        setMessage({
          type: "err",
          text: `Only ${manualInfo.availableQty} unit(s) available in stock.`,
        })
        playScanRejectBeep()
        return false
      }
      if (!isManual && stockQty !== undefined && currentSerials.length >= stockQty) {
        setMessage({
          type: "err",
          text: `Only ${stockQty} unit(s) available in stock.`,
        })
        playScanRejectBeep()
        return false
      }

      scanLockRef.current = true
      setMessage(null)

      try {
        const record: ScanRecord = {
          serialNumber: serialRaw,
          model,
          productName: details.productName || item.description,
        }

        onChange((prev) => {
          const cur = prev[lineId] ?? []
          if (cur.length >= need || cur.some((sn) => serialNumberKey(sn) === snKey)) return prev
          return { ...prev, [lineId]: [...cur, serialRaw] }
        })

        setScanRecords((prev) => ({
          ...prev,
          [lineId]: [...(prev[lineId] ?? []), record],
        }))

        setMessage({
          type: "ok",
          text: `Scanned ${serialRaw} (${currentSerials.length + 1}/${need})`,
        })
        playScanSuccessBeep()
        return true
      } finally {
        scanLockRef.current = false
        wedgeRef.current?.focus()
      }
    },
    [disabled, lineStates, onChange],
  )

  const handleCameraScan = useCallback(
    (payload: string) => {
      if (scanLockRef.current) return
      if (!activeLine) {
        setMessage({ type: "err", text: "All units already scanned — nothing left to scan." })
        playScanRejectBeep()
        return
      }
      prepareScanAudio()
      applyScan(activeLine.item.id, payload)
    },
    [activeLine, applyScan],
  )

  function handleWedgeSubmit(raw: string) {
    if (scanLockRef.current) return
    if (!activeLine) {
      setMessage({ type: "err", text: "All units already scanned — nothing left to scan." })
      playScanRejectBeep()
      setWedgeBuffer("")
      return
    }
    prepareScanAudio()
    applyScan(activeLine.item.id, raw)
    setWedgeBuffer("")
  }

  function removeScan(lineId: string, serialNumber: string) {
    if (disabled) return
    const snKey = serialNumberKey(serialNumber)
    onChange((prev) => ({
      ...prev,
      [lineId]: (prev[lineId] ?? []).filter((sn) => serialNumberKey(sn) !== snKey),
    }))
    setScanRecords((prev) => ({
      ...prev,
      [lineId]: (prev[lineId] ?? []).filter((r) => serialNumberKey(r.serialNumber) !== snKey),
    }))
    setMessage(null)
    wedgeRef.current?.focus()
  }

  if (lines.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-[#1faca6]/40 bg-[#1faca6]/5 p-4">
        <ScanLine className="h-5 w-5 text-[#1faca6] shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Scan QR codes</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {totalNeed > 0
              ? `Scan ${totalNeed} unit${totalNeed === 1 ? "" : "s"} available in warehouse. Serials register pending warranty; only scanned qty is deducted from inventory.`
              : "No warehouse stock available for inventory lines — dispatch can proceed without scans."}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))]/50 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${allDone ? "bg-green-500" : "bg-[#1faca6]"}`}
                style={{ width: totalNeed > 0 ? `${Math.min(100, (totalScanned / totalNeed) * 100)}%` : "0%" }}
              />
            </div>
            <span
              className={`text-sm font-semibold tabular-nums shrink-0 ${
                allDone ? "text-green-700 dark:text-green-400" : "text-[hsl(var(--foreground))]"
              }`}
            >
              {totalScanned}/{totalNeed}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {!allDone && (
          <p className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-1">
            Select item to scan
          </p>
        )}
        {lineStates.map(({ item, model, need, selectedSerials, records, manualInfo, stockQty, done }) => {
          const isManual = isManualDispatchLine(item)
          const isActive = !done && activeLine?.item.id === item.id
          return (
            <div
              key={item.id}
              className={`rounded-lg border overflow-hidden transition-colors ${
                done
                  ? "border-green-500/30 bg-green-500/[0.04]"
                  : isActive
                    ? "border-[#1faca6] ring-1 ring-[#1faca6]/40"
                    : "border-[hsl(var(--border))]"
              }`}
            >
              <button
                type="button"
                disabled={disabled || done}
                onClick={() => {
                  setSelectedLineId(item.id)
                  setMessage(null)
                  wedgeRef.current?.focus()
                }}
                className={`w-full px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-left ${
                  done
                    ? "cursor-default"
                    : isActive
                      ? "bg-[#1faca6]/10 cursor-pointer"
                      : "hover:bg-[#1faca6]/5 cursor-pointer"
                }`}
              >
                <div className="min-w-0">
                  <span className="font-semibold">{item.description}</span>
                  <span className="text-[hsl(var(--muted-foreground))] font-mono ml-2">{model}</span>
                  {isManual && manualInfo !== undefined && (
                    <span className="text-[hsl(var(--muted-foreground))] ml-1">
                      · {manualInfo.availableQty} in stock
                    </span>
                  )}
                  {!isManual && stockQty !== undefined && (
                    <span className="text-[hsl(var(--muted-foreground))] ml-1">· {stockQty} in stock</span>
                  )}
                </div>
                <span className="flex items-center gap-2 shrink-0">
                  {isActive && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1faca6]">
                      Scanning
                    </span>
                  )}
                  <span
                    className={`font-bold tabular-nums ${
                      done ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {selectedSerials.length}/{need}
                    {done && " ✓"}
                  </span>
                </span>
              </button>

              {records.length > 0 && (
                <ul className="divide-y border-t bg-[hsl(var(--background))]">
                  {records.map((record, index) => (
                    <li
                      key={`${item.id}-${record.serialNumber}`}
                      className="flex items-start gap-3 px-3 py-2 hover:bg-[hsl(var(--muted))]/10"
                    >
                      <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] w-5 pt-0.5 tabular-nums shrink-0">
                        {index + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-semibold break-all">{record.serialNumber}</p>
                        <p className="text-[11px] font-mono text-[#1faca6] mt-0.5">{record.model}</p>
                      </div>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => removeScan(item.id, record.serialNumber)}
                          className="text-[10px] text-red-600 hover:underline cursor-pointer shrink-0 pt-0.5"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {!allDone && activeLine && (
        <div className="rounded-lg border border-[#1faca6]/30 bg-[hsl(var(--background))] p-4 space-y-4">
          <div className="text-center space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Now scanning
            </p>
            <p className="text-sm font-semibold">{activeLine.item.description}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono">
              {activeLine.model}
              {isManualDispatchLine(activeLine.item) && activeLine.manualInfo !== undefined && (
                <span className="font-sans ml-2">· {activeLine.manualInfo.availableQty} in stock</span>
              )}
              {!isManualDispatchLine(activeLine.item) && activeLine.stockQty !== undefined && (
                <span className="font-sans ml-2">· {activeLine.stockQty} in stock</span>
              )}
            </p>
            <p className="text-sm font-bold text-[#1faca6] tabular-nums">
              Unit {activeLine.selectedSerials.length + 1} of {activeLine.need}
            </p>
          </div>

          {!scannerOpen ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <Button
                type="button"
                className="h-12 px-8 text-sm bg-[#1faca6] hover:bg-[#17857f] text-white"
                disabled={disabled}
                onClick={() => {
                  prepareScanAudio()
                  setScannerOpen(true)
                }}
              >
                <Camera className="h-5 w-5 mr-2" />
                Open QR scanner
              </Button>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                USB barcode scanner also works — keep this page focused
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <WarrantyQrScanner
                readerId="dispatch-qr-reader"
                onScan={handleCameraScan}
                disabled={disabled || !activeLine || activeLine.selectedSerials.length >= activeLine.need}
                busy={scanLockRef.current}
                autoStart
                hideStartButton
              />
              <div className="flex justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={() => setScannerOpen(false)}
                >
                  Close camera
                </Button>
              </div>
            </div>
          )}

          <input
            ref={wedgeRef}
            type="text"
            value={wedgeBuffer}
            onChange={(e) => setWedgeBuffer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                const raw = wedgeBuffer.trim()
                if (raw) handleWedgeSubmit(raw)
              }
            }}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            autoComplete="off"
          />
        </div>
      )}

      {message && (
        <p
          className={`text-xs flex items-center gap-1.5 px-1 ${
            message.type === "ok"
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {message.type === "ok" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
          {message.text}
        </p>
      )}

      {allDone && (
        <div className="rounded-lg border border-green-500/30 px-4 py-3 bg-green-500/[0.06] text-center">
          <p className="text-xs text-green-700 dark:text-green-400 font-medium">
            All {totalNeed} unit{totalNeed === 1 ? "" : "s"} scanned. Create the dispatch note.
          </p>
        </div>
      )}
    </div>
  )
}
