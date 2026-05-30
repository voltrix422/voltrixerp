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
import { Camera, CheckCircle2, Loader2, ScanLine, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WarrantyQrScanner } from "@/components/warranty/warranty-qr-scanner"
import {
  findInventorySerialByNumber,
  getInventorySerialUnits,
  saveInventorySerialUnit,
  type InventorySerialUnit,
} from "@/lib/inventory-serial-units"
import { modelKey, type ManualDispatchMeta } from "@/lib/order-fulfillment-serials"
import { parseProductQrPayload } from "@/lib/parse-product-qr"
import { playScanRejectBeep, playScanSuccessBeep, prepareScanAudio } from "@/lib/scan-beep"
import { type OrderItem, isManualDispatchLine, resolveOrderItemModel } from "@/lib/orders"

type ScanRecord = {
  unitId: string
  serialNumber: string
  model: string
  productName: string
}

type Props = {
  lines: OrderItem[]
  value: Record<string, string[]>
  onChange: Dispatch<SetStateAction<Record<string, string[]>>>
  units: InventorySerialUnit[]
  onUnitsChange: (units: InventorySerialUnit[]) => void
  manualMeta?: Record<string, ManualDispatchMeta>
  disabled?: boolean
}

function extractSerialFromScan(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const parsed = parseProductQrPayload(trimmed)
    if (parsed.serialNumber?.trim()) return parsed.serialNumber.trim()
  } catch {
    // plain barcode
  }
  return trimmed.split(/[\s,;]+/)[0]?.trim() ?? trimmed
}

function parseScanDetails(raw: string, fallbackModel: string, fallbackName: string) {
  try {
    const parsed = parseProductQrPayload(raw)
    return {
      serialNumber: parsed.serialNumber?.trim() || extractSerialFromScan(raw),
      model: parsed.model?.trim() || fallbackModel,
      productName: parsed.productName?.trim() || fallbackName,
    }
  } catch {
    return {
      serialNumber: extractSerialFromScan(raw),
      model: fallbackModel,
      productName: fallbackName,
    }
  }
}

export function DispatchSerialScanPanel({
  lines,
  value,
  onChange,
  units,
  onUnitsChange,
  manualMeta = {},
  disabled,
}: Props) {
  const valueRef = useRef(value)
  valueRef.current = value

  const scanLockRef = useRef(false)
  const wedgeRef = useRef<HTMLInputElement>(null)

  const [wedgeBuffer, setWedgeBuffer] = useState("")
  const [scannerOpen, setScannerOpen] = useState(false)
  const [busyLineId, setBusyLineId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  /** Local display cache so scans never disappear while units reload */
  const [scanRecords, setScanRecords] = useState<Record<string, ScanRecord[]>>({})

  const lineStates = useMemo(() => {
    return lines.map((item) => {
      const model = resolveOrderItemModel(item)
      const need = Math.max(0, Math.floor(Number(item.qty) || 0))
      const selectedIds = value[item.id] ?? []
      const records = scanRecords[item.id] ?? []
      const manualInfo = model ? manualMeta[modelKey(model)] : undefined
      return {
        item,
        model,
        need,
        selectedIds,
        records,
        manualInfo,
        done: need > 0 && selectedIds.length >= need,
      }
    })
  }, [lines, manualMeta, scanRecords, value])

  const activeLine = useMemo(
    () => lineStates.find((l) => !l.done) ?? null,
    [lineStates],
  )

  const allRecordsFlat = useMemo(
    () =>
      lineStates.flatMap((l) =>
        l.records.map((record) => ({
          record,
          lineId: l.item.id,
          lineDescription: l.item.description,
          done: l.done,
        })),
      ),
    [lineStates],
  )

  const totalNeed = lineStates.reduce((s, l) => s + l.need, 0)
  const totalScanned = lineStates.reduce((s, l) => s + l.selectedIds.length, 0)
  const allDone = totalNeed > 0 && totalScanned >= totalNeed

  useEffect(() => {
    if (allDone) setScannerOpen(false)
  }, [allDone])

  useEffect(() => {
    if (!disabled && !allDone && !scannerOpen && activeLine) {
      wedgeRef.current?.focus()
    }
  }, [disabled, allDone, scannerOpen, activeLine?.item.id])

  useEffect(() => {
    setScanRecords((prev) => {
      let changed = false
      const next: Record<string, ScanRecord[]> = { ...prev }
      for (const item of lines) {
        const ids = value[item.id] ?? []
        if (ids.length === 0) continue
        const model = resolveOrderItemModel(item) ?? ""
        const merged = [...(prev[item.id] ?? [])]
        for (const id of ids) {
          if (merged.some((r) => r.unitId === id)) continue
          const unit = units.find((u) => u.id === id)
          if (!unit) continue
          merged.push({
            unitId: unit.id,
            serialNumber: unit.serialNumber,
            model: unit.model || model,
            productName: unit.productName || item.description,
          })
          changed = true
        }
        if (changed || merged.length !== (prev[item.id]?.length ?? 0)) {
          next[item.id] = merged
        }
      }
      return changed ? next : prev
    })
  }, [lines, units, value])

  const applyScan = useCallback(
    async (lineId: string, raw: string): Promise<boolean> => {
      if (scanLockRef.current || disabled) return false

      const lineState = lineStates.find((l) => l.item.id === lineId)
      if (!lineState) return false

      const { item, model, need, manualInfo } = lineState
      if (!model) {
        setMessage({ type: "err", text: "This item has no model code." })
        playScanRejectBeep()
        return false
      }

      const currentIds = valueRef.current[lineId] ?? []
      if (currentIds.length >= need) {
        setMessage({ type: "err", text: `Order qty reached (${need}). No more scans.` })
        playScanRejectBeep()
        return false
      }

      const details = parseScanDetails(raw, model, item.description)
      const serialRaw = details.serialNumber
      if (!serialRaw) {
        setMessage({ type: "err", text: "Could not read serial from scan." })
        playScanRejectBeep()
        return false
      }

      const isManual = isManualDispatchLine(item)
      if (isManual && manualInfo !== undefined && currentIds.length >= manualInfo.availableQty) {
        setMessage({
          type: "err",
          text: `Only ${manualInfo.availableQty} unit(s) available in stock.`,
        })
        playScanRejectBeep()
        return false
      }

      scanLockRef.current = true
      setBusyLineId(lineId)
      setMessage(null)

      try {
        let unit = await findInventorySerialByNumber(serialRaw)

        if (!unit) {
          unit = await saveInventorySerialUnit({
            serialNumber: serialRaw,
            productName: details.productName || item.description,
            model,
            assignedName: item.description,
            inventoryStockId: manualInfo?.inventoryStockId ?? undefined,
            notes: manualInfo?.manualId
              ? `manual:${manualInfo.manualId}`
              : "Registered at dispatch scan",
            scannedBy: "inventory-dispatch",
            createWarranty: false,
          })
        }

        const refreshed = await getInventorySerialUnits()
        onUnitsChange(refreshed)

        const latestUnit = refreshed.find((u) => u.id === unit!.id) ?? unit!

        if (latestUnit.status !== "in_stock") {
          setMessage({
            type: "err",
            text: `${latestUnit.serialNumber} is not in stock (${latestUnit.status}).`,
          })
          playScanRejectBeep()
          return false
        }

        if (modelKey(latestUnit.model || "") !== modelKey(model)) {
          setMessage({
            type: "err",
            text: `${latestUnit.serialNumber} is model "${latestUnit.model}" — expected "${model}".`,
          })
          playScanRejectBeep()
          return false
        }

        const latestIds = valueRef.current[lineId] ?? []
        if (latestIds.length >= need) {
          setMessage({ type: "err", text: `Order qty reached (${need}).` })
          playScanRejectBeep()
          return false
        }

        if (latestIds.includes(latestUnit.id)) {
          setMessage({ type: "err", text: `${latestUnit.serialNumber} already scanned.` })
          playScanRejectBeep()
          return false
        }

        const usedElsewhere = Object.entries(valueRef.current).some(
          ([otherLineId, ids]) => otherLineId !== lineId && ids.includes(latestUnit.id),
        )
        if (usedElsewhere) {
          setMessage({ type: "err", text: `${latestUnit.serialNumber} is already on this order.` })
          playScanRejectBeep()
          return false
        }

        const record: ScanRecord = {
          unitId: latestUnit.id,
          serialNumber: latestUnit.serialNumber,
          model: latestUnit.model || model,
          productName: latestUnit.productName || details.productName || item.description,
        }

        onChange((prev) => {
          const cur = prev[lineId] ?? []
          if (cur.length >= need || cur.includes(latestUnit.id)) return prev
          return { ...prev, [lineId]: [...cur, latestUnit.id] }
        })

        setScanRecords((prev) => ({
          ...prev,
          [lineId]: [...(prev[lineId] ?? []), record],
        }))

        setMessage({
          type: "ok",
          text: `Scanned ${latestUnit.serialNumber} (${latestIds.length + 1}/${need})`,
        })
        playScanSuccessBeep()
        return true
      } catch (e) {
        setMessage({
          type: "err",
          text: e instanceof Error ? e.message : "Scan failed",
        })
        playScanRejectBeep()
        return false
      } finally {
        scanLockRef.current = false
        setBusyLineId(null)
        wedgeRef.current?.focus()
      }
    },
    [disabled, lineStates, onChange, onUnitsChange],
  )

  const handleCameraScan = useCallback(
    async (payload: string) => {
      if (!activeLine || busyLineId || scanLockRef.current) return
      const currentIds = valueRef.current[activeLine.item.id] ?? []
      if (currentIds.length >= activeLine.need) return
      prepareScanAudio()
      await applyScan(activeLine.item.id, payload)
    },
    [activeLine, applyScan, busyLineId],
  )

  function handleWedgeSubmit(raw: string) {
    if (!activeLine || busyLineId || scanLockRef.current) return
    const currentIds = valueRef.current[activeLine.item.id] ?? []
    if (currentIds.length >= activeLine.need) return
    prepareScanAudio()
    void applyScan(activeLine.item.id, raw)
    setWedgeBuffer("")
  }

  function removeScan(lineId: string, unitId: string) {
    if (disabled) return
    onChange((prev) => ({
      ...prev,
      [lineId]: (prev[lineId] ?? []).filter((id) => id !== unitId),
    }))
    setScanRecords((prev) => ({
      ...prev,
      [lineId]: (prev[lineId] ?? []).filter((r) => r.unitId !== unitId),
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
            Scan exactly {totalNeed} unit{totalNeed === 1 ? "" : "s"} for this order. Each scan is saved to the list below.
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

      {!allDone && activeLine && (
        <div className="rounded-xl border border-[#1faca6]/30 bg-[hsl(var(--background))] p-4 space-y-4">
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
            </p>
            <p className="text-sm font-bold text-[#1faca6] tabular-nums">
              Unit {activeLine.selectedIds.length + 1} of {activeLine.need}
            </p>
          </div>

          {!scannerOpen ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <Button
                type="button"
                className="h-12 px-8 text-sm bg-[#1faca6] hover:bg-[#17857f] text-white"
                disabled={disabled || !!busyLineId}
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
                disabled={disabled || !activeLine || activeLine.selectedIds.length >= activeLine.need}
                busy={!!busyLineId}
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
                  disabled={!!busyLineId}
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

          {busyLineId && (
            <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving scan…
            </div>
          )}
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

      {/* Live scanned list — all items with code + details */}
      <div className="rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-[hsl(var(--muted))]/25 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Scanned for dispatch
          </p>
          <span
            className={`text-xs font-bold tabular-nums ${
              allDone ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {totalScanned}/{totalNeed}
          </span>
        </div>

        {allRecordsFlat.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6 px-4">
            No scans yet — open scanner and scan {totalNeed} QR code{totalNeed === 1 ? "" : "s"}
          </p>
        ) : (
          <ul className="divide-y">
            {allRecordsFlat.map(({ record, lineId, lineDescription, done }, index) => (
              <li
                key={record.unitId}
                className="flex items-start gap-3 px-4 py-3 hover:bg-[hsl(var(--muted))]/10"
              >
                <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] w-5 pt-0.5 tabular-nums shrink-0">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold break-all">{record.serialNumber}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                    {record.productName}
                  </p>
                  <p className="text-[11px] font-mono text-[#1faca6] mt-0.5">{record.model}</p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <span className="block text-[10px] text-[hsl(var(--muted-foreground))] truncate max-w-[80px]">
                    {lineDescription}
                  </span>
                  {!disabled && !done && (
                    <button
                      type="button"
                      onClick={() => removeScan(lineId, record.unitId)}
                      className="text-[10px] text-red-600 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {allDone && (
          <div className="px-4 py-3 border-t bg-green-500/[0.06] text-center">
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">
              All {totalNeed} unit{totalNeed === 1 ? "" : "s"} scanned. Create the dispatch note.
            </p>
          </div>
        )}
      </div>

      {/* Per-line summary */}
      <div className="space-y-2">
        {lineStates.map(({ item, model, need, selectedIds, manualInfo, done }) => {
          const isManual = isManualDispatchLine(item)
          return (
            <div
              key={item.id}
              className={`rounded-lg border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs ${
                done ? "border-green-500/30 bg-green-500/[0.04]" : "border-[hsl(var(--border))]"
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
              </div>
              <span
                className={`font-bold tabular-nums ${
                  done ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-300"
                }`}
              >
                {selectedIds.length}/{need}
                {done && " ✓"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
