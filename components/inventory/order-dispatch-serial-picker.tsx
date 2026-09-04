"use client"

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { Loader2 } from "lucide-react"
import { DispatchSerialScanPanel } from "@/components/inventory/dispatch-serial-scan-panel"
import { getManualInventoryItems } from "@/lib/manual-inventory"
import { getPosStockProducts } from "@/lib/pos"
import {
  branchManualMetaFromProducts,
  branchStockByModelFromProducts,
  manualDispatchMetaByModel,
  orderLinesRequiringSerials,
  validateSerialSelections,
  warehouseStockByModelFromRows,
  type ValidateSerialOptions,
} from "@/lib/order-fulfillment-serials"
import { type Order } from "@/lib/orders"

type Props = {
  order: Order
  value: Record<string, string[]>
  onChange: Dispatch<SetStateAction<Record<string, string[]>>>
  disabled?: boolean
  allowFocus?: boolean
  dispatchableQtyByLineId?: Record<string, number>
  partialDispatch?: boolean
  onValidationChange?: (valid: boolean, errors: string[]) => void
  /** Branch POS: validate against this branch's stock instead of the warehouse. */
  branchId?: string
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
  allowFocus = true,
  dispatchableQtyByLineId,
  partialDispatch = false,
  onValidationChange,
  branchId,
}: Props) {
  const [manualMeta, setManualMeta] = useState(manualDispatchMetaByModel([]))
  const [warehouseStockByModel, setWarehouseStockByModel] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const lines = useMemo(() => orderLinesRequiringSerials(order), [order])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        if (branchId) {
          const products = await getPosStockProducts(true, branchId)
          if (!cancelled) {
            setManualMeta(branchManualMetaFromProducts(products))
            setWarehouseStockByModel(branchStockByModelFromProducts(products))
          }
        } else {
          const [manualItems, stockRes] = await Promise.all([
            getManualInventoryItems().catch(() => []),
            fetch("/api/db/inventory-stock", { cache: "no-store" }),
          ])
          const stockRows = stockRes.ok ? await stockRes.json() : []
          if (!cancelled) {
            setManualMeta(manualDispatchMetaByModel(manualItems))
            setWarehouseStockByModel(warehouseStockByModelFromRows(stockRows))
          }
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
  }, [branchId])

  const validationOptions: ValidateSerialOptions = useMemo(
    () => ({
      partialDispatch,
      dispatchableQtyByLineId,
    }),
    [partialDispatch, dispatchableQtyByLineId],
  )

  const validation = useMemo(
    () => validateSerialSelections(order, value, manualMeta, warehouseStockByModel, validationOptions),
    [order, value, manualMeta, warehouseStockByModel, validationOptions],
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
      <p className="text-xs text-[hsl(var(--muted-foreground))] rounded-lg border px-3 py-2">
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
        manualMeta={manualMeta}
        warehouseStockByModel={warehouseStockByModel}
        dispatchableQtyByLineId={dispatchableQtyByLineId}
        orderId={order.id}
        orderNumber={order.orderNumber}
        disabled={disabled}
        allowFocus={allowFocus}
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
