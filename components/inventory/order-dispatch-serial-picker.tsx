"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, ListChecks, ScanLine } from "lucide-react"
import { DispatchSerialScanPanel } from "@/components/inventory/dispatch-serial-scan-panel"
import {
  getInventorySerialUnits,
  type InventorySerialUnit,
} from "@/lib/inventory-serial-units"
import {
  inStockUnitsForOrderLine,
  orderLinesRequiringSerials,
  validateSerialSelections,
} from "@/lib/order-fulfillment-serials"
import { type Order, resolveOrderItemModel } from "@/lib/orders"

type Props = {
  order: Order
  value: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  disabled?: boolean
  onValidationChange?: (valid: boolean, errors: string[]) => void
}

export function OrderDispatchSerialPicker({
  order,
  value,
  onChange,
  disabled,
  onValidationChange,
}: Props) {
  const [units, setUnits] = useState<InventorySerialUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<"scan" | "pick">("scan")

  const lines = useMemo(() => orderLinesRequiringSerials(order), [order])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await getInventorySerialUnits()
        if (!cancelled) setUnits(data)
      } catch {
        if (!cancelled) setLoadError("Could not load serial numbers from warehouse.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const validation = useMemo(
    () => validateSerialSelections(order, value, units),
    [order, value, units],
  )

  useEffect(() => {
    onValidationChange?.(validation.valid, validation.errors)
  }, [validation.valid, validation.errors, onValidationChange])

  if (lines.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--muted-foreground))] rounded-lg border px-3 py-2 bg-[hsl(var(--muted))]/30">
        No warehouse models on this order — serial selection not required.
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading available serial numbers…
      </div>
    )
  }

  if (loadError) {
    return <p className="text-xs text-red-600 dark:text-red-400">{loadError}</p>
  }

  function toggleUnit(orderItemId: string, unitId: string, maxQty: number) {
    const current = value[orderItemId] ?? []
    if (current.includes(unitId)) {
      onChange({
        ...value,
        [orderItemId]: current.filter((id) => id !== unitId),
      })
      return
    }
    if (current.length >= maxQty) return
    onChange({
      ...value,
      [orderItemId]: [...current, unitId],
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-lg border bg-[hsl(var(--muted))]/20 w-fit">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("scan")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
            mode === "scan"
              ? "bg-[hsl(var(--background))] shadow-sm text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <ScanLine className="h-3.5 w-3.5" />
          Scan to dispatch
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("pick")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
            mode === "pick"
              ? "bg-[hsl(var(--background))] shadow-sm text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <ListChecks className="h-3.5 w-3.5" />
          Pick from list
        </button>
      </div>

      {mode === "scan" && (
        <DispatchSerialScanPanel
          lines={lines}
          value={value}
          onChange={onChange}
          units={units}
          onUnitsChange={setUnits}
          disabled={disabled}
        />
      )}

      <div className="rounded-lg border border-[#1faca6]/30 bg-[#1faca6]/5 px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">
          Order items — serial numbers
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {mode === "scan"
            ? "Use the scanner above, or switch to pick from list. Each unit needs one SN before dispatch."
            : "Pick one serial number per unit ordered. SNs are marked delivered and linked to this order."}
        </p>
      </div>

      <div className="rounded-lg border overflow-hidden text-xs">
        <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-[hsl(var(--muted))]/40 font-semibold uppercase tracking-wide text-[10px] text-[hsl(var(--muted-foreground))]">
          <span>Model</span>
          <span className="text-center">Qty ordered</span>
          <span className="text-right">To select</span>
        </div>
        {lines.map((item) => {
          const model = resolveOrderItemModel(item)!
          const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
          const selected = (value[item.id] ?? []).length
          return (
            <div
              key={`summary-${item.id}`}
              className="grid grid-cols-3 gap-2 px-3 py-2 border-t items-center"
            >
              <span className="font-semibold tabular-nums truncate">{model}</span>
              <span className="text-center tabular-nums">{needQty}</span>
              <span
                className={`text-right tabular-nums font-medium ${
                  selected === needQty
                    ? "text-green-700 dark:text-green-400"
                    : "text-amber-700 dark:text-amber-300"
                }`}
              >
                {selected}/{needQty}
              </span>
            </div>
          )
        })}
      </div>

      {mode === "pick" &&
        lines.map((item) => {
        const model = resolveOrderItemModel(item)!
        const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
        const available = inStockUnitsForOrderLine(units, item)
        const selected = value[item.id] ?? []

        return (
          <div
            key={item.id}
            className="rounded-lg border bg-[hsl(var(--background))] overflow-hidden"
          >
            <div className="px-3 py-2.5 border-b bg-[hsl(var(--muted))]/25 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums">{model}</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                  {item.description}
                </p>
              </div>
              <p className="text-xs font-medium shrink-0">
                <span
                  className={
                    selected.length === needQty
                      ? "text-green-700 dark:text-green-400"
                      : "text-amber-700 dark:text-amber-300"
                  }
                >
                  {selected.length}/{needQty}
                </span>
                <span className="text-[hsl(var(--muted-foreground))] ml-1">selected</span>
                <span className="text-[hsl(var(--muted-foreground))] mx-1">·</span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {available.length} in stock
                </span>
              </p>
            </div>

            {available.length === 0 ? (
              <p className="px-3 py-3 text-xs text-amber-800 dark:text-amber-200">
                No in-stock serials for this model. Scan units into inventory first.
              </p>
            ) : (
              <ul className="max-h-40 overflow-y-auto divide-y">
                {available.map((unit) => {
                  const checked = selected.includes(unit.id)
                  const atMax = selected.length >= needQty && !checked
                  return (
                    <li key={unit.id}>
                      <label
                        className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-[hsl(var(--muted))]/20 ${
                          disabled || atMax ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border"
                          checked={checked}
                          disabled={disabled || (atMax && !checked)}
                          onChange={() => toggleUnit(item.id, unit.id, needQty)}
                        />
                        <span className="font-mono text-xs font-semibold flex-1">
                          {unit.serialNumber}
                        </span>
                        <span className="text-[10px] text-green-700 dark:text-green-400 shrink-0">
                          In stock
                        </span>
                        {unit.warrantyId && (
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 hidden sm:inline">
                            {unit.warrantyId}
                          </span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}

      {mode === "scan" && (
        <div className="rounded-lg border overflow-hidden text-xs divide-y">
          {lines.map((item) => {
            const model = resolveOrderItemModel(item)!
            const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
            const selectedIds = value[item.id] ?? []
            const selectedUnits = selectedIds
              .map((id) => units.find((u) => u.id === id))
              .filter(Boolean) as InventorySerialUnit[]
            return (
              <div key={`scan-summary-${item.id}`} className="px-3 py-2.5">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold truncate">{item.description}</span>
                  <span
                    className={
                      selectedUnits.length === needQty
                        ? "text-green-700 dark:text-green-400 shrink-0"
                        : "text-amber-700 dark:text-amber-300 shrink-0"
                    }
                  >
                    {selectedUnits.length}/{needQty}
                  </span>
                </div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums">{model}</p>
                {selectedUnits.length > 0 ? (
                  <p className="mt-1 font-mono text-[11px]">
                    {selectedUnits.map((u) => u.serialNumber).join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">No SNs scanned yet</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!validation.valid && validation.errors.length > 0 && (
        <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 list-disc pl-4">
          {validation.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
