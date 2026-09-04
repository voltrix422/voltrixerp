"use client"

import { useMemo, useState } from "react"
import { Loader2, Shield, Truck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OrderDispatchSerialPicker } from "@/components/inventory/order-dispatch-serial-picker"
import { useToast } from "@/components/ui/toast"
import {
  buildAllocationsFromSelections,
  orderLinesRequiringSerials,
} from "@/lib/order-fulfillment-serials"
import { saveOrder, type Order } from "@/lib/orders"

function posScanOrder(order: Order): Order {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      model: item.model?.trim() || item.description?.trim() || item.model,
    })),
  }
}

export function PosDeliverScanDialog({
  order,
  userName,
  onClose,
  onDelivered,
}: {
  order: Order
  userName: string
  onClose: () => void
  onDelivered: (order: Order) => void
}) {
  const { toast } = useToast()
  const scanOrder = useMemo(() => posScanOrder(order), [order])
  const lines = useMemo(() => orderLinesRequiringSerials(scanOrder), [scanOrder])
  const [serialSelections, setSerialSelections] = useState<Record<string, string[]>>({})
  const [scansValid, setScansValid] = useState(lines.length === 0)
  const [warrantyHolderName, setWarrantyHolderName] = useState(order.warrantyHolderName || order.clientName || "")
  const [saving, setSaving] = useState(false)

  async function deliver(startWarranty: boolean) {
    if (saving) return
    if (lines.length > 0 && !scansValid) {
      toast({ type: "error", title: "Scan every unit", message: "Scan the same number of serials as the order qty." })
      return
    }
    const holder = warrantyHolderName.trim()
    if (startWarranty && !holder) {
      toast({ type: "error", title: "Warranty name required", message: "Type the name that will start this warranty." })
      return
    }
    setSaving(true)
    try {
      const allocations = buildAllocationsFromSelections(scanOrder, serialSelections)
      const saved = await saveOrder({
        ...order,
        status: "delivered",
        warrantyHolderName: holder,
        fulfillmentSerialAllocations: allocations,
        fulfillmentDate: new Date().toISOString(),
        fulfillmentDispatcher: userName,
      })
      let warrantyNote = ""
      if (startWarranty && allocations.length > 0) {
        const res = await fetch("/api/db/orders/start-warranties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: saved.id,
            confirm: true,
            activatedBy: userName || "Branch POS",
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          warrantyNote = (data as { error?: string }).error || "Warranty start failed — you can start it from the order."
        } else {
          const started = Number((data as { started?: number }).started) || 0
          const already = Number((data as { alreadyActive?: number }).alreadyActive) || 0
          warrantyNote = `${started} warranty${started === 1 ? "" : "ies"} started${already ? ` · ${already} already started` : ""}`
        }
      }
      toast({
        type: warrantyNote && warrantyNote.toLowerCase().includes("fail") ? "error" : "success",
        title: `${order.orderNumber} delivered`,
        message: warrantyNote || "Branch stock deducted · serials saved in Stock history",
      })
      onDelivered(saved)
    } catch (err) {
      toast({
        type: "error",
        title: "Could not deliver",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b sticky top-0 bg-[hsl(var(--card))] z-10">
          <div>
            <p className="text-sm font-semibold">Deliver {order.orderNumber}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Scan each unit like warehouse dispatch. Serials go to Stock history. Start warranty now or after.
            </p>
          </div>
          <button type="button" className="h-8 w-8 rounded-md hover:bg-[hsl(var(--muted))]/40 inline-flex items-center justify-center" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-lg border p-3 space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-[#1faca6]" />
              Warranty name
            </label>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Person or company who owns the product — they type this name when scanning to start warranty.
            </p>
            <input
              value={warrantyHolderName}
              onChange={(e) => setWarrantyHolderName(e.target.value)}
              placeholder="e.g. Ali Khan or the client name"
              className="w-full h-9 rounded-md border px-3 text-sm"
              disabled={saving}
            />
          </div>

          {lines.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] rounded-lg border px-3 py-2">
              No serial items on this order — stock will still be deducted on deliver.
            </p>
          ) : (
            <OrderDispatchSerialPicker
              order={scanOrder}
              value={serialSelections}
              onChange={setSerialSelections}
              branchId={order.branchId}
              disabled={saving}
              onValidationChange={(valid) => setScansValid(valid)}
            />
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-4 py-3 border-t">
          <Button type="button" variant="outline" className="h-9 text-xs" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 text-xs border-[#1faca6] text-[#1faca6]"
            disabled={saving || (lines.length > 0 && !scansValid)}
            onClick={() => void deliver(false)}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
            Deliver
          </Button>
          <Button
            type="button"
            className="h-9 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white"
            disabled={saving || (lines.length > 0 && !scansValid)}
            onClick={() => void deliver(true)}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
            Deliver & start warranty
          </Button>
        </div>
      </div>
    </div>
  )
}
