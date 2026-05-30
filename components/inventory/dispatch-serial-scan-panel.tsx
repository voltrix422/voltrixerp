"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Barcode, CheckCircle2, Loader2, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  findInventorySerialByNumber,
  getInventorySerialUnits,
  saveInventorySerialUnit,
  type InventorySerialUnit,
} from "@/lib/inventory-serial-units"
import { inStockUnitsForOrderLine, modelKey, type ManualDispatchMeta } from "@/lib/order-fulfillment-serials"
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [scanValue, setScanValue] = useState("")
  const [activeLineId, setActiveLineId] = useState<string>(() => lines[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [recent, setRecent] = useState<Array<{ sn: string; lineId: string }>>([])

  const activeLine = useMemo(
    () => lines.find((l) => l.id === activeLineId) ?? lines[0],
    [lines, activeLineId],
  )

  const lineProgress = useMemo(() => {
    return lines.map((item) => {
      const need = Math.max(0, Math.floor(Number(item.qty) || 0))
      const selected = (value[item.id] ?? []).length
      return { item, need, selected, done: selected >= need && need > 0 }
    })
  }, [lines, value])

  const applyScan = useCallback(
    async (raw: string) => {
      if (!activeLine || disabled) return
      const serialRaw = extractSerialFromScan(raw)
      if (!serialRaw) {
        setMessage({ type: "err", text: "Enter or scan a serial number." })
        return
      }

      const model = resolveOrderItemModel(activeLine)
      if (!model) {
        setMessage({ type: "err", text: "This line has no model code." })
        return
      }

      const needQty = Math.max(0, Math.floor(Number(activeLine.qty) || 0))
      const selected = value[activeLine.id] ?? []
      if (selected.length >= needQty) {
        setMessage({ type: "err", text: `Already selected ${needQty} serial(s) for this line.` })
        return
      }

      const isManual = isManualDispatchLine(activeLine)
      const manualInfo = manualMeta[modelKey(model)]
      if (isManual && manualInfo !== undefined && selected.length >= manualInfo.availableQty) {
        setMessage({
          type: "err",
          text: `Manual stock exhausted (${manualInfo.availableQty} available).`,
        })
        return
      }

      setBusy(true)
      setMessage(null)
      try {
        let unit = await findInventorySerialByNumber(serialRaw)

        if (!unit) {
          unit = await saveInventorySerialUnit({
            serialNumber: serialRaw,
            productName: activeLine.description,
            model,
            assignedName: activeLine.description,
            inventoryStockId: manualInfo?.inventoryStockId ?? undefined,
            notes: manualInfo?.manualId
              ? `manual:${manualInfo.manualId}`
              : `Registered at dispatch scan`,
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

        const expectedModelKey = modelKey(model)
        if (modelKey(unit.model || "") !== expectedModelKey) {
          setMessage({
            type: "err",
            text: `${unit.serialNumber} is model "${unit.model}" — expected "${model}".`,
          })
          return
        }

        if (selected.includes(unit.id)) {
          setMessage({ type: "err", text: `${unit.serialNumber} already selected for this line.` })
          return
        }

        const usedElsewhere = Object.entries(value).some(
          ([lineId, ids]) => lineId !== activeLine.id && ids.includes(unit!.id),
        )
        if (usedElsewhere) {
          setMessage({ type: "err", text: `${unit.serialNumber} is already assigned to another line.` })
          return
        }

        onChange({
          ...value,
          [activeLine.id]: [...selected, unit.id],
        })
        setRecent((prev) => [{ sn: unit!.serialNumber, lineId: activeLine.id }, ...prev].slice(0, 8))
        setMessage({ type: "ok", text: `Added ${unit.serialNumber} → ${model}` })
        setScanValue("")

        const nextLine = lineProgress.find(
          (p) => !p.done && p.item.id !== activeLine.id,
        )?.item
        if (selected.length + 1 >= needQty && nextLine) {
          setActiveLineId(nextLine.id)
        }
      } catch (e) {
        setMessage({
          type: "err",
          text: e instanceof Error ? e.message : "Scan failed",
        })
      } finally {
        setBusy(false)
        inputRef.current?.focus()
      }
    },
    [activeLine, disabled, lineProgress, manualMeta, onChange, onUnitsChange, units, value],
  )

  if (lines.length === 0) return null

  return (
    <div className="space-y-4 rounded-lg border border-[#1faca6]/40 bg-[#1faca6]/5 p-4">
      <div className="flex items-start gap-3">
        <ScanLine className="h-5 w-5 text-[#1faca6] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Scan to dispatch</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Scan each unit&apos;s barcode or QR. Serial numbers are linked to this order and removed from stock.
            {lines.some(isManualDispatchLine)
              ? " Manual stock items: scan one SN per unit at dispatch — they are registered automatically."
              : " Unknown SNs for this model are registered automatically."}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Assign scans to line
        </label>
        <div className="flex flex-wrap gap-2">
          {lineProgress.map(({ item, need, selected, done }) => {
            const model = resolveOrderItemModel(item)
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => setActiveLineId(item.id)}
                className={`text-left rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer ${
                  activeLineId === item.id
                    ? "border-[#1faca6] bg-[#1faca6]/15"
                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30"
                }`}
              >
                <span className="font-semibold block truncate max-w-[200px]">
                  {item.description || model}
                </span>
                <span
                  className={
                    done
                      ? "text-green-700 dark:text-green-400"
                      : "text-amber-700 dark:text-amber-300"
                  }
                >
                  {selected}/{need} SN
                  {done && " ✓"}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void applyScan(scanValue)
        }}
      >
        <div className="relative flex-1">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            ref={inputRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder="Scan or type serial number, then Enter"
            className="w-full h-10 rounded-md border bg-[hsl(var(--background))] pl-9 pr-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            disabled={disabled || busy}
            autoComplete="off"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={disabled || busy || !scanValue.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </form>

      {message && (
        <p
          className={`text-xs flex items-center gap-1.5 ${
            message.type === "ok"
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {message.type === "ok" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
          {message.text}
        </p>
      )}

      {activeLine && (() => {
        const model = resolveOrderItemModel(activeLine)
        const isManual = isManualDispatchLine(activeLine)
        const manualInfo = model ? manualMeta[modelKey(model)] : undefined
        const serialCount = inStockUnitsForOrderLine(units, activeLine).length
        if (isManual && manualInfo !== undefined) {
          return (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Manual stock:{" "}
              <span className="font-medium text-[hsl(var(--foreground))]">
                {manualInfo.availableQty} {activeLine.unit || "pcs"}
              </span>
              {serialCount > 0 && (
                <>
                  {" "}
                  · <span className="font-medium">{serialCount}</span> pre-registered serial(s)
                </>
              )}
            </p>
          )
        }
        return (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            In stock for this model:{" "}
            <span className="font-medium text-[hsl(var(--foreground))]">{serialCount}</span>
          </p>
        )
      })()}

      {recent.length > 0 && (
        <div className="text-xs">
          <p className="font-semibold text-[hsl(var(--muted-foreground))] mb-1">Recent scans</p>
          <ul className="space-y-0.5 font-mono">
            {recent.map((r, i) => (
              <li key={`${r.sn}-${i}`}>{r.sn}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
