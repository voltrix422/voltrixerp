"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Barcode, CheckCircle2, Loader2, ScanLine, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  findInventorySerialByNumber,
  getInventorySerialUnits,
  saveInventorySerialUnit,
  type InventorySerialUnit,
} from "@/lib/inventory-serial-units"
import { modelKey, type ManualDispatchMeta } from "@/lib/order-fulfillment-serials"
import { parseProductQrPayload } from "@/lib/parse-product-qr"
import { type OrderItem, isManualDispatchLine, resolveOrderItemModel } from "@/lib/orders"

type Props = {
  lines: OrderItem[]
  value: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
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

export function DispatchSerialScanPanel({
  lines,
  value,
  onChange,
  units,
  onUnitsChange,
  manualMeta = {},
  disabled,
}: Props) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [scanValues, setScanValues] = useState<Record<string, string>>({})
  const [busyLineId, setBusyLineId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const lineStates = useMemo(() => {
    return lines.map((item) => {
      const model = resolveOrderItemModel(item)
      const need = Math.max(0, Math.floor(Number(item.qty) || 0))
      const selectedIds = value[item.id] ?? []
      const selectedUnits = selectedIds
        .map((id) => units.find((u) => u.id === id))
        .filter(Boolean) as InventorySerialUnit[]
      const manualInfo = model ? manualMeta[modelKey(model)] : undefined
      return {
        item,
        model,
        need,
        selectedIds,
        selectedUnits,
        manualInfo,
        done: need > 0 && selectedIds.length >= need,
      }
    })
  }, [lines, manualMeta, units, value])

  const totalNeed = lineStates.reduce((s, l) => s + l.need, 0)
  const totalScanned = lineStates.reduce((s, l) => s + l.selectedIds.length, 0)
  const allDone = totalNeed > 0 && totalScanned >= totalNeed

  const applyScan = useCallback(
    async (lineId: string, raw: string) => {
      const lineState = lineStates.find((l) => l.item.id === lineId)
      if (!lineState || disabled) return

      const { item, model, need, selectedIds, manualInfo } = lineState
      if (!model) {
        setMessage({ type: "err", text: "This item has no model code." })
        return
      }

      const serialRaw = extractSerialFromScan(raw)
      if (!serialRaw) {
        setMessage({ type: "err", text: "Scan or enter a serial number." })
        return
      }

      if (selectedIds.length >= need) {
        setMessage({ type: "err", text: `Already scanned ${need} unit(s) for this item.` })
        return
      }

      const isManual = isManualDispatchLine(item)
      if (isManual && manualInfo !== undefined && selectedIds.length >= manualInfo.availableQty) {
        setMessage({
          type: "err",
          text: `Only ${manualInfo.availableQty} unit(s) available in stock.`,
        })
        return
      }

      setBusyLineId(lineId)
      setMessage(null)
      try {
        let unit = await findInventorySerialByNumber(serialRaw)

        if (!unit) {
          unit = await saveInventorySerialUnit({
            serialNumber: serialRaw,
            productName: item.description,
            model,
            assignedName: item.description,
            inventoryStockId: manualInfo?.inventoryStockId ?? undefined,
            notes: manualInfo?.manualId
              ? `manual:${manualInfo.manualId}`
              : "Registered at dispatch scan",
            scannedBy: "inventory-dispatch",
            createWarranty: false,
          })
          const refreshed = await getInventorySerialUnits()
          onUnitsChange(refreshed)
        } else if (units.every((u) => u.id !== unit!.id)) {
          onUnitsChange([...units, unit])
        }

        if (unit.status !== "in_stock") {
          setMessage({ type: "err", text: `${unit.serialNumber} is not in stock (${unit.status}).` })
          return
        }

        if (modelKey(unit.model || "") !== modelKey(model)) {
          setMessage({
            type: "err",
            text: `${unit.serialNumber} belongs to "${unit.model}", not "${model}".`,
          })
          return
        }

        if (selectedIds.includes(unit.id)) {
          setMessage({ type: "err", text: `${unit.serialNumber} already scanned for this item.` })
          return
        }

        const usedElsewhere = Object.entries(value).some(
          ([otherLineId, ids]) => otherLineId !== lineId && ids.includes(unit!.id),
        )
        if (usedElsewhere) {
          setMessage({ type: "err", text: `${unit.serialNumber} is already on this order.` })
          return
        }

        onChange({
          ...value,
          [lineId]: [...selectedIds, unit.id],
        })
        setScanValues((prev) => ({ ...prev, [lineId]: "" }))
        setMessage({ type: "ok", text: `Scanned ${unit.serialNumber}` })

        const newCount = selectedIds.length + 1
        if (newCount >= need) {
          const next = lineStates.find(
            (l) => l.item.id !== lineId && l.selectedIds.length < l.need,
          )
          if (next) {
            inputRefs.current[next.item.id]?.focus()
          }
        } else {
          inputRefs.current[lineId]?.focus()
        }
      } catch (e) {
        setMessage({
          type: "err",
          text: e instanceof Error ? e.message : "Scan failed",
        })
      } finally {
        setBusyLineId(null)
      }
    },
    [disabled, lineStates, onChange, onUnitsChange, units, value],
  )

  function removeScan(lineId: string, unitId: string) {
    if (disabled) return
    onChange({
      ...value,
      [lineId]: (value[lineId] ?? []).filter((id) => id !== unitId),
    })
    setMessage(null)
    inputRefs.current[lineId]?.focus()
  }

  if (lines.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-[#1faca6]/40 bg-[#1faca6]/5 p-4">
        <ScanLine className="h-5 w-5 text-[#1faca6] shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Scan QR codes</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Scan one barcode per unit ordered. Stop when you reach the order quantity.
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

      <div className="space-y-3">
        {lineStates.map(({ item, model, need, selectedUnits, manualInfo, done }) => {
          const isManual = isManualDispatchLine(item)
          const busy = busyLineId === item.id

          return (
            <div
              key={item.id}
              className={`rounded-xl border overflow-hidden ${
                done ? "border-green-500/40 bg-green-500/[0.04]" : "border-[hsl(var(--border))]"
              }`}
            >
              <div className="px-4 py-3 border-b bg-[hsl(var(--muted))]/20 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{item.description}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono mt-0.5">
                    {model}
                    {isManual && manualInfo !== undefined && (
                      <span className="font-sans ml-2">· {manualInfo.availableQty} in stock</span>
                    )}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold tabular-nums px-2.5 py-1 rounded-full shrink-0 ${
                    done
                      ? "bg-green-500/15 text-green-700 dark:text-green-400"
                      : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  {done ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {selectedUnits.length}/{need}
                    </span>
                  ) : (
                    `${selectedUnits.length}/${need} scanned`
                  )}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {!done && (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void applyScan(item.id, scanValues[item.id] ?? "")
                    }}
                  >
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      <input
                        ref={(el) => {
                          inputRefs.current[item.id] = el
                        }}
                        value={scanValues[item.id] ?? ""}
                        onChange={(e) =>
                          setScanValues((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder={`Scan unit ${selectedUnits.length + 1} of ${need}…`}
                        className="w-full h-11 rounded-lg border bg-[hsl(var(--background))] pl-9 pr-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/50"
                        disabled={disabled || busy}
                        autoComplete="off"
                        autoFocus={lineStates[0]?.item.id === item.id && selectedUnits.length === 0}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="h-11 shrink-0 bg-[#1faca6] hover:bg-[#17857f] text-white"
                      disabled={disabled || busy || !(scanValues[item.id] ?? "").trim()}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                    </Button>
                  </form>
                )}

                {selectedUnits.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">
                      Scanned serial numbers
                    </p>
                    <ul className="space-y-1.5">
                      {selectedUnits.map((unit, index) => (
                        <li
                          key={unit.id}
                          className="flex items-center gap-2 rounded-lg border bg-[hsl(var(--background))] px-3 py-2"
                        >
                          <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] w-5 tabular-nums">
                            {index + 1}.
                          </span>
                          <span className="font-mono text-sm font-medium flex-1 truncate">
                            {unit.serialNumber}
                          </span>
                          {!disabled && !done && (
                            <button
                              type="button"
                              onClick={() => removeScan(item.id, unit.id)}
                              className="shrink-0 p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                              aria-label={`Remove ${unit.serialNumber}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-2">
                    No scans yet — scan {need} QR code{need === 1 ? "" : "s"} for this item
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {allDone && (
        <p className="text-xs text-center text-green-700 dark:text-green-400 font-medium">
          All units scanned. Go back to dispatcher tab and create the dispatch note.
        </p>
      )}
    </div>
  )
}
