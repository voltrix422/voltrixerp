"use client"

import { useMemo, useRef, useState } from "react"
import {
  canReplaceOrderItem,
  rowToOrder,
  type Order,
  type OrderReplacementDisposition,
} from "@/lib/orders"
import { getAllocationsForOrderItem } from "@/lib/order-fulfillment-serials"
import { replaceOrderItem } from "@/lib/order-replacement"
import { getSession } from "@/lib/auth"
import { parseProductQrPayload } from "@/lib/parse-product-qr"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { AlertTriangle, Camera, Loader2, RefreshCw, ScanLine, X } from "lucide-react"
import { WarrantyQrScanner } from "@/components/warranty/warranty-qr-scanner"

function extractSerial(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const parsed = parseProductQrPayload(trimmed)
    if (parsed.serialNumber?.trim()) return parsed.serialNumber.trim()
  } catch {
    // plain text
  }
  return trimmed.split(/[\s,;]+/)[0]?.trim() ?? trimmed
}

export function OrderItemReplacement({
  order,
  onClose,
  onComplete,
}: {
  order: Order
  onClose: () => void
  onComplete: (order: Order) => void
}) {
  const { toast } = useToast()
  const replaceableLines = useMemo(
    () => order.items.filter((item) => !item.isCustom && Math.floor(Number(item.qty) || 0) > 0),
    [order.items],
  )
  const [orderItemId, setOrderItemId] = useState(replaceableLines[0]?.id || "")
  const [oldSerial, setOldSerial] = useState("")
  const [newSerial, setNewSerial] = useState("")
  const [disposition, setDisposition] = useState<OrderReplacementDisposition>("main")
  const [reason, setReason] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showOldScanner, setShowOldScanner] = useState(false)
  const [showNewScanner, setShowNewScanner] = useState(false)
  const oldScanRef = useRef<HTMLInputElement>(null)
  const newScanRef = useRef<HTMLInputElement>(null)

  const selectedLine = replaceableLines.find((item) => item.id === orderItemId)
  const lineAllocations = useMemo(
    () => (orderItemId ? getAllocationsForOrderItem(order, orderItemId) : []),
    [order, orderItemId],
  )
  const requiresSerial = lineAllocations.length > 0

  if (!canReplaceOrderItem(order) || replaceableLines.length === 0) {
    return null
  }

  async function uploadPhotos(): Promise<string[]> {
    if (photos.length === 0) return []
    const fd = new FormData()
    for (const file of photos) fd.append("files", file)
    fd.append("folder", "replacement-evidence")
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Could not upload photos")
    return (data.urls as string[]) || []
  }

  async function handleSubmit() {
    if (!selectedLine) return
    if (requiresSerial) {
      if (!oldSerial.trim()) {
        toast({ title: "Old serial required", message: "Scan or select the item being returned.", type: "error" })
        return
      }
      if (!newSerial.trim()) {
        toast({ title: "New serial required", message: "Scan the replacement unit.", type: "error" })
        return
      }
    }
    // For qty-only lines: newSerial is optional — validated on server if provided
    if (!reason.trim()) {
      toast({ title: "Reason required", message: "Add a short note about why this item is being replaced.", type: "error" })
      return
    }
    if (photos.length === 0) {
      toast({ title: "Photos required", message: "Take at least one photo of the returned item.", type: "error" })
      return
    }

    setSubmitting(true)
    try {
      const photoUrls = await uploadPhotos()
      const updated = await replaceOrderItem({
        orderId: order.id,
        orderItemId: selectedLine.id,
        oldSerialNumber: (requiresSerial || oldSerial.trim()) ? oldSerial.trim() : undefined,
        newSerialNumber: (requiresSerial || newSerial.trim()) ? newSerial.trim() : undefined,
        disposition,
        reason: reason.trim(),
        photoUrls,
        replacedBy: getSession()?.name || "Inventory",
      })
      onComplete(rowToOrder(updated))
      toast({
        title: "Item replaced",
        message:
          requiresSerial
            ? `${oldSerial.trim()} → ${newSerial.trim()} on ${order.orderNumber}`
            : newSerial.trim()
            ? `1 unit replaced · new SN ${newSerial.trim()} linked on ${order.orderNumber}`
            : `1 unit replaced on ${order.orderNumber}`,
        type: "success",
      })
      onClose()
    } catch (err) {
      toast({
        title: "Replacement failed",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
          <div>
            <p className="text-sm font-bold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-[#1faca6]" />
              Replace order item
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{order.orderNumber}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Order line
            </label>
            <select
              value={orderItemId}
              onChange={(e) => {
                setOrderItemId(e.target.value)
                setOldSerial("")
                setNewSerial("")
              }}
              className="mt-1.5 w-full h-10 rounded-lg border bg-[hsl(var(--background))] px-3 text-sm"
            >
              {replaceableLines.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.description} · {item.qty} {item.unit}
                </option>
              ))}
            </select>
          </div>

          {requiresSerial ? (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Old serial (being returned)
                </label>
                {lineAllocations.length > 0 ? (
                  <select
                    value={oldSerial}
                    onChange={(e) => setOldSerial(e.target.value)}
                    className="mt-1.5 w-full h-10 rounded-lg border bg-[hsl(var(--background))] px-3 text-sm font-mono"
                  >
                    <option value="">Select dispatched serial…</option>
                    {lineAllocations.map((a) => (
                      <option key={a.serialNumber} value={a.serialNumber}>
                        {a.serialNumber}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <input
                    ref={oldScanRef}
                    value={oldSerial}
                    onChange={(e) => setOldSerial(extractSerial(e.target.value))}
                    placeholder="Or scan old serial"
                    className="flex-1 h-10 rounded-lg border bg-[hsl(var(--background))] px-3 text-sm font-mono"
                  />
                  <Button type="button" size="sm" variant="outline" className="h-10" onClick={() => setShowOldScanner(true)}>
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  New serial (replacement unit)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    ref={newScanRef}
                    value={newSerial}
                    onChange={(e) => setNewSerial(extractSerial(e.target.value))}
                    placeholder="Scan new serial from stock"
                    className="flex-1 h-10 rounded-lg border bg-[hsl(var(--background))] px-3 text-sm font-mono"
                  />
                  <Button type="button" size="sm" variant="outline" className="h-10" onClick={() => setShowNewScanner(true)}>
                    <ScanLine className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-[#1faca6]/30 bg-[#1faca6]/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-[#17857f]">Manual dispatch — no serials on this order line</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  This order was dispatched by quantity only. You do not need the old serial — just receive the returned
                  unit, take photos, and choose where it goes (main or faulty).
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Step 1 · Old serial
                  <span className="font-normal normal-case tracking-normal text-[hsl(var(--muted-foreground))] ml-1">
                    (optional)
                  </span>
                </label>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                  Scan only if the returned unit has a serial sticker — otherwise skip this.
                </p>
                <div className="mt-1.5 flex gap-2">
                  <input
                    ref={oldScanRef}
                    value={oldSerial}
                    onChange={(e) => setOldSerial(extractSerial(e.target.value))}
                    placeholder="Scan or type old serial…"
                    className="flex-1 h-10 rounded-lg border bg-[hsl(var(--background))] px-3 text-sm font-mono"
                  />
                  <Button type="button" size="sm" variant="outline" className="h-10" onClick={() => setShowOldScanner(true)}>
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border-2 border-dashed border-[#1faca6]/40 bg-[#1faca6]/5 p-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#17857f]">
                  Step 2 · New serial — scan replacement unit
                </label>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                  Scan the new unit you are giving the customer. Leave blank only if this product has no serial numbers.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    ref={newScanRef}
                    value={newSerial}
                    onChange={(e) => setNewSerial(extractSerial(e.target.value))}
                    placeholder="Scan or type new serial…"
                    className="flex-1 h-10 rounded-lg border bg-[hsl(var(--background))] px-3 text-sm font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 bg-[#1faca6] hover:bg-[#17857f] text-white shrink-0"
                    onClick={() => setShowNewScanner(true)}
                  >
                    <ScanLine className="h-4 w-4 mr-1" />
                    Scan
                  </Button>
                </div>
                {newSerial.trim() ? (
                  <p className="text-[11px] text-[#1faca6] mt-2 font-medium">
                    ✓ New unit {newSerial.trim()} will be linked to this order
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700 mt-2">
                    No serial scanned — 1 unit will be deducted from stock by quantity only
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {requiresSerial ? "Return old item to" : "Step 3 · Return old item to"}
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDisposition("main")}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  disposition === "main"
                    ? "border-[#1faca6] bg-[#1faca6]/10"
                    : "hover:bg-[hsl(var(--muted))]/20"
                }`}
              >
                <span className="font-semibold">Main inventory</span>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">Good condition — sellable again</p>
              </button>
              <button
                type="button"
                onClick={() => setDisposition("faulty")}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  disposition === "faulty"
                    ? "border-amber-600 bg-amber-500/10"
                    : "hover:bg-[hsl(var(--muted))]/20"
                }`}
              >
                <span className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  Faulty / damaged
                </span>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">Goes to Faulty tab only</p>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {requiresSerial ? "Photos of returned item" : "Step 4 · Photos of returned item"}
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files || []))}
              className="mt-1.5 w-full text-sm"
            />
            {photos.length > 0 ? (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{photos.length} photo(s) selected</p>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {requiresSerial ? "Reason" : "Step 5 · Reason"}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Battery faulty, customer complaint, physical damage…"
              className="mt-1.5 w-full rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm resize-none"
            />
          </div>

          {(order.replacementLines?.length ?? 0) > 0 ? (
            <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Previous replacements
              </p>
              {order.replacementLines!.slice(-3).map((r) => (
                <p key={r.id} className="text-xs text-[hsl(var(--muted-foreground))]">
                  {r.oldSerialNumber && r.newSerialNumber
                    ? `${r.oldSerialNumber} → ${r.newSerialNumber}`
                    : `${r.qty} ${r.unit || "pcs"}`}{" "}
                  · {r.disposition === "faulty" ? "faulty" : "main"} · {new Date(r.replacedAt).toLocaleDateString()}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-t p-4 flex justify-end gap-2 shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#1faca6] hover:bg-[#17857f] text-white"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm replacement"}
          </Button>
        </div>
      </div>

      {showOldScanner ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowOldScanner(false)}>
          <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Scan old serial</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowOldScanner(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <WarrantyQrScanner autoStart onScan={(raw) => { setOldSerial(extractSerial(raw)); setShowOldScanner(false) }} />
          </div>
        </div>
      ) : null}
      {showNewScanner ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowNewScanner(false)}>
          <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Scan new serial</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewScanner(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <WarrantyQrScanner autoStart onScan={(raw) => { setNewSerial(extractSerial(raw)); setShowNewScanner(false) }} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
