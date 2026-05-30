"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { DispatchSerialScanPanel } from "@/components/inventory/dispatch-serial-scan-panel"
import {
  getInventorySerialUnits,
  type InventorySerialUnit,
} from "@/lib/inventory-serial-units"
import { getManualInventoryItems } from "@/lib/manual-inventory"
import {
  manualDispatchMetaByModel,
  orderLinesRequiringSerials,
  validateSerialSelections,
} from "@/lib/order-fulfillment-serials"
import { type Order } from "@/lib/orders"

type Props = {
  order: Order
  value: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  disabled?: boolean
  onValidationChange?: (valid: boolean, errors: string[]) => void
}

/** Progress hints — not shown as blocking errors in the UI. */
function isProgressHint(error: string): boolean {
  return (
    (error.includes("scan ") && error.includes("serial number")) ||
    (error.includes("select ") && error.includes("serial number"))
  )
}

export function OrderDispatchSerialPicker({
  order,
  value,
  onChange,
  disabled,
  onValidationChange,
}: Props) {
  const [units, setUnits] = useState<InventorySerialUnit[]>([])
  const [manualMeta, setManualMeta] = useState(manualDispatchMetaByModel([]))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const lines = useMemo(() => orderLinesRequiringSerials(order), [order])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const [serialData, manualItems] = await Promise.all([
          getInventorySerialUnits(),
          getManualInventoryItems().catch(() => []),
        ])
        if (!cancelled) {
          setUnits(serialData)
          setManualMeta(manualDispatchMetaByModel(manualItems))
        }
      } catch {
        if (!cancelled) setLoadError("Could not load inventory.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const validation = useMemo(
    () => validateSerialSelections(order, value, units, manualMeta),
    [order, value, units, manualMeta],
  )

  const blockingErrors = useMemo(
    () => validation.errors.filter((e) => !isProgressHint(e)),
    [validation.errors],
  )

  useEffect(() => {
    onValidationChange?.(validation.valid, validation.errors)
  }, [validation.valid, validation.errors, onValidationChange])

  if (lines.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--muted-foreground))] rounded-lg border px-3 py-2 bg-[hsl(var(--muted))]/30">
        No inventory items on this order — scanning not required.
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (loadError) {
    return <p className="text-xs text-red-600 dark:text-red-400">{loadError}</p>
  }

  return (
    <div className="space-y-3">
      <DispatchSerialScanPanel
        lines={lines}
        value={value}
        onChange={onChange}
        units={units}
        onUnitsChange={setUnits}
        manualMeta={manualMeta}
        disabled={disabled}
      />

      {blockingErrors.length > 0 && (
        <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 list-disc pl-4">
          {blockingErrors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
