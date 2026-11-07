"use client"

import { useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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

const fieldClass =
  "w-full h-10 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-3 text-[13px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"

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

  if (typeof document === "undefined") return null

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
        title: "Replacement submitted",
        message:
          "New unit dispatched. Returned unit is waiting in Inventory → Approvals — stock increases only after inventory receives and approves it.",
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

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xl p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-[20px] sm:rounded-[20px] border border-black/[0.06] bg-white/95 dark:bg-[hsl(var(--card))] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-black/[0.06] dark:border-[hsl(var(--border))] shrink-0 bg-white/70 dark:bg-[hsl(var(--card))]/80">
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-[#0071e3]" />
              Replace order item
            </p>
            <p className="text-[12px] font-semibold tracking-tight text-[#0071e3] mt-0.5">{order.orderNumber}</p>
          </div>
          <button
            type="button"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Order line</label>
            <select
              value={orderItemId}
              onChange={(e) => {
                setOrderItemId(e.target.value)
                setOldSerial("")
                setNewSerial("")
              }}
              className={`mt-1.5 ${fieldClass} cursor-pointer`}
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
                <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">
                  Old serial (being returned)
                </label>
                {lineAllocations.length > 0 ? (
                  <select
                    value={oldSerial}
                    onChange={(e) => setOldSerial(e.target.value)}
                    className={`mt-1.5 ${fieldClass} font-mono cursor-pointer`}
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
                    className={`flex-1 ${fieldClass} font-mono`}
                  />
                  <button
                    type="button"
                    className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full border border-black/[0.08] bg-white cursor-pointer"
                    onClick={() => setShowOldScanner(true)}
                    aria-label="Scan old serial"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">
                  New serial (replacement unit)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    ref={newScanRef}
                    value={newSerial}
                    onChange={(e) => setNewSerial(extractSerial(e.target.value))}
                    placeholder="Scan new serial from stock"
                    className={`flex-1 ${fieldClass} font-mono`}
                  />
                  <button
                    type="button"
                    className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full border border-black/[0.08] bg-white cursor-pointer"
                    onClick={() => setShowNewScanner(true)}
                    aria-label="Scan new serial"
                  >
                    <ScanLine className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-[14px] border border-[#0071e3]/20 bg-[#0071e3]/06 p-3 space-y-1.5">
                <p className="text-[12px] font-semibold tracking-tight text-[#0071e3]">Manual dispatch — no serials on this order line</p>
                <p className="text-[11px] text-[#86868b]">
                  This order was dispatched by quantity only. You do not need the old serial — just receive the returned
                  unit, take photos, and choose where it goes (main or faulty).
                </p>
              </div>

              <div>
                <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">
                  Step 1 · Old serial <span className="font-normal text-[#aeaeb2]">(optional)</span>
                </label>
                <p className="text-[11px] text-[#86868b] mt-1">
                  Scan only if the returned unit has a serial sticker — otherwise skip this.
                </p>
                <div className="mt-1.5 flex gap-2">
                  <input
                    ref={oldScanRef}
                    value={oldSerial}
                    onChange={(e) => setOldSerial(extractSerial(e.target.value))}
                    placeholder="Scan or type old serial…"
                    className={`flex-1 ${fieldClass} font-mono`}
                  />
                  <button
                    type="button"
                    className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full border border-black/[0.08] bg-white cursor-pointer"
                    onClick={() => setShowOldScanner(true)}
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-[14px] border border-dashed border-[#0071e3]/30 bg-[#0071e3]/05 p-3">
                <label className="text-[10px] font-semibold tracking-tight text-[#0071e3]">
                  Step 2 · New serial — scan replacement unit
                </label>
                <p className="text-[11px] text-[#86868b] mt-1">
                  Scan the new unit you are giving the customer. Leave blank only if this product has no serial numbers.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    ref={newScanRef}
                    value={newSerial}
                    onChange={(e) => setNewSerial(extractSerial(e.target.value))}
                    placeholder="Scan or type new serial…"
                    className={`flex-1 ${fieldClass} font-mono`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 rounded-full bg-[#1d1d1f] hover:bg-black text-white shrink-0 px-3"
                    onClick={() => setShowNewScanner(true)}
                  >
                    <ScanLine className="h-4 w-4 mr-1" />
                    Scan
                  </Button>
                </div>
                {newSerial.trim() ? (
                  <p className="text-[11px] text-[#248a3d] mt-2 font-medium">
                    New unit {newSerial.trim()} will be linked to this order
                  </p>
                ) : (
                  <p className="text-[11px] text-[#9a6700] mt-2">
                    No serial scanned — 1 unit will be deducted from stock by quantity only
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">
              {requiresSerial ? "Return old item to" : "Step 3 · Return old item to"}
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDisposition("main")}
                className={`rounded-[14px] border px-3 py-2.5 text-left text-[13px] transition cursor-pointer ${
                  disposition === "main"
                    ? "border-[#0071e3]/40 bg-[#0071e3]/08 ring-1 ring-[#0071e3]/20"
                    : "border-black/[0.08] hover:bg-black/[0.03]"
                }`}
              >
                <span className="font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Main inventory</span>
                <p className="text-[11px] text-[#86868b] mt-0.5">Good condition — sellable again</p>
              </button>
              <button
                type="button"
                onClick={() => setDisposition("faulty")}
                className={`rounded-[14px] border px-3 py-2.5 text-left text-[13px] transition cursor-pointer ${
                  disposition === "faulty"
                    ? "border-[#ff9f0a]/50 bg-[#ff9f0a]/12 ring-1 ring-[#ff9f0a]/25"
                    : "border-black/[0.08] hover:bg-black/[0.03]"
                }`}
              >
                <span className="font-semibold tracking-tight flex items-center gap-1 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#9a6700]" />
                  Faulty / damaged
                </span>
                <p className="text-[11px] text-[#86868b] mt-0.5">Goes to Faulty tab only</p>
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[#9a6700] bg-[#ff9f0a]/12 border border-[#ff9f0a]/25 rounded-[12px] px-2.5 py-2">
              Returned unit does not increase stock yet. After submit it goes to <span className="font-semibold">Inventory → Approvals</span>. Inventory must receive the item and approve — then it is added to Main or Faulty.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">
              {requiresSerial ? "Photos of returned item" : "Step 4 · Photos of returned item"}
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files || []))}
              className={`mt-1.5 ${fieldClass} file:mr-2 file:border-0 file:bg-transparent file:text-[12px] file:font-medium py-2`}
            />
            {photos.length > 0 ? (
              <p className="text-[11px] text-[#86868b] mt-1">{photos.length} photo(s) selected</p>
            ) : null}
          </div>

          <div>
            <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">
              {requiresSerial ? "Reason" : "Step 5 · Reason"}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Battery faulty, customer complaint, physical damage…"
              className="mt-1.5 w-full rounded-[12px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-3 py-2.5 text-[13px] tracking-tight resize-none focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
            />
          </div>

          {(order.replacementLines?.length ?? 0) > 0 ? (
            <div className="rounded-[14px] border border-black/[0.06] bg-[#f5f5f7]/80 dark:bg-white/[0.03] p-3 space-y-2">
              <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">
                Previous replacements
              </p>
              {order.replacementLines!.slice(-3).map((r) => (
                <p key={r.id} className="text-[11px] text-[#6e6e73]">
                  {r.oldSerialNumber && r.newSerialNumber
                    ? `${r.oldSerialNumber} → ${r.newSerialNumber}`
                    : `${r.qty} ${r.unit || "pcs"}`}{" "}
                  · {r.disposition === "faulty" ? "faulty" : "main"} · {new Date(r.replacedAt).toLocaleDateString()}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-t border-black/[0.06] p-4 flex justify-end gap-2 shrink-0 bg-[#fafafa]/90 dark:bg-[hsl(var(--muted))]/20">
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 text-[12px] border-black/[0.08]" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-full px-4 text-[12px] bg-[#1d1d1f] hover:bg-black text-white"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm replacement"}
          </Button>
        </div>
      </div>

      {showOldScanner
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-xl p-4" onClick={() => setShowOldScanner(false)}>
              <div className="w-full max-w-md rounded-[20px] border border-black/[0.06] bg-white/95 dark:bg-[hsl(var(--card))] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[14px] font-semibold tracking-tight">Scan old serial</p>
                  <button type="button" className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer" onClick={() => setShowOldScanner(false)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <WarrantyQrScanner autoStart onScan={(raw) => { setOldSerial(extractSerial(raw)); setShowOldScanner(false) }} />
              </div>
            </div>,
            document.body,
          )
        : null}
      {showNewScanner
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-xl p-4" onClick={() => setShowNewScanner(false)}>
              <div className="w-full max-w-md rounded-[20px] border border-black/[0.06] bg-white/95 dark:bg-[hsl(var(--card))] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[14px] font-semibold tracking-tight">Scan new serial</p>
                  <button type="button" className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer" onClick={() => setShowNewScanner(false)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <WarrantyQrScanner autoStart onScan={(raw) => { setNewSerial(extractSerial(raw)); setShowNewScanner(false) }} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>,
    document.body,
  )
}
