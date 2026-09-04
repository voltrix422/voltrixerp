"use client"

import { useState } from "react"
import { Camera, Loader2, PlayCircle, ScanLine, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WarrantyQrScanner } from "@/components/warranty/warranty-qr-scanner"
import { useToast } from "@/components/ui/toast"
import { saveOrder, type Order } from "@/lib/orders"
import { formatSerialListForLine } from "@/lib/order-fulfillment-serials"

export function PosOrderWarrantyPanel({
  order,
  userName,
  onUpdated,
}: {
  order: Order
  userName: string
  onUpdated: (order: Order) => void
}) {
  const { toast } = useToast()
  const [holder, setHolder] = useState(order.warrantyHolderName || "")
  const [savingName, setSavingName] = useState(false)
  const [starting, setStarting] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanMessage, setScanMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [startResult, setStartResult] = useState<string | null>(null)

  const scannedSerialCount = (order.fulfillmentSerialAllocations || []).filter(
    (a) => String(a.serialNumber || "").trim(),
  ).length
  const savedName = (order.warrantyHolderName || "").trim()
  const canStartAll = order.status === "delivered" && Boolean(savedName) && scannedSerialCount > 0

  async function saveHolder() {
    const next = holder.trim()
    setSavingName(true)
    try {
      const saved = await saveOrder({ ...order, warrantyHolderName: next })
      onUpdated(saved)
      toast({ type: "success", title: "Warranty name saved" })
    } catch (err) {
      toast({ type: "error", title: "Could not save name", message: err instanceof Error ? err.message : undefined })
    } finally {
      setSavingName(false)
    }
  }

  async function startAll() {
    if (!canStartAll || starting) return
    setStarting(true)
    setStartResult(null)
    try {
      const res = await fetch("/api/db/orders/start-warranties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          confirm: true,
          activatedBy: userName || "Branch POS",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not start warranties")
      const failCount = Array.isArray(data.failed) ? data.failed.length : 0
      const parts = [
        data.started ? `${data.started} started` : null,
        data.alreadyActive ? `${data.alreadyActive} already started` : null,
        failCount ? `${failCount} failed` : null,
      ].filter(Boolean)
      setStartResult(parts.length ? `${data.orderNumber}: ${parts.join(" · ")}` : "No warranties were started.")
      toast({ type: "success", title: "Warranties processed", message: parts.join(" · ") })
    } catch (err) {
      toast({
        type: "error",
        title: "Could not start warranties",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setStarting(false)
    }
  }

  async function startFromScan(payload: string) {
    if (scanBusy) return
    setScanBusy(true)
    setScanMessage(null)
    try {
      const res = await fetch("/api/db/warranties/scan-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan: payload,
          customerName: holder.trim() || savedName || undefined,
          activatedBy: userName || "Branch POS",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setScanMessage({ type: "err", text: data.error || "Could not start warranty from this QR." })
        return
      }
      const w = data.warranty as { serialNumber?: string; productName?: string } | undefined
      setScanMessage({
        type: "ok",
        text: data.alreadyActive
          ? `Already started: ${w?.serialNumber || "unit"}`
          : `Warranty started${w?.productName ? ` · ${w.productName}` : ""} · ${w?.serialNumber || ""}`,
      })
    } catch {
      setScanMessage({ type: "err", text: "Network error. Try again." })
    } finally {
      setScanBusy(false)
    }
  }

  const serialLines = (order.items || [])
    .map((item) => ({
      id: item.id,
      description: item.description,
      serials: formatSerialListForLine(order, item.id),
    }))
    .filter((row) => row.serials && row.serials !== "—")

  return (
    <div className="rounded-lg border border-[#1a9f9a]/30 bg-[#1a9f9a]/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-[#1a9f9a]" />
        <p className="text-xs font-semibold uppercase tracking-wide">Warranty</p>
      </div>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
        Save the owner name, then start all scanned units, or scan one QR at handover.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={holder}
          onChange={(e) => setHolder(e.target.value)}
          placeholder="Warranty name (person or company)"
          className="flex-1 h-9 rounded-md border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          className="h-9 text-xs bg-[#1a9f9a] hover:bg-[#158a85] text-white"
          disabled={savingName || holder.trim() === savedName}
          onClick={() => void saveHolder()}
        >
          {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save name"}
        </Button>
      </div>
      {serialLines.length > 0 && (
        <div className="text-[11px] space-y-1">
          {serialLines.map((row) => (
            <p key={row.id} className="tabular-nums whitespace-pre-wrap">
              <span className="text-[hsl(var(--muted-foreground))]">{row.description}: </span>
              {row.serials}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 text-xs border-[#1a9f9a] text-[#1a9f9a]"
          disabled={!canStartAll || starting}
          onClick={() => void startAll()}
        >
          {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {scannedSerialCount > 0
            ? `Start warranty (${scannedSerialCount})`
            : "Start warranty for scanned units"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 text-xs"
          onClick={() => setScanOpen((v) => !v)}
        >
          {scanOpen ? <ScanLine className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
          {scanOpen ? "Hide scanner" : "Scan QR to start warranty"}
        </Button>
      </div>
      {!savedName && (
        <p className="text-[11px] text-amber-700">Save a warranty name before starting all units.</p>
      )}
      {savedName && scannedSerialCount === 0 && (
        <p className="text-[11px] text-amber-700">No scanned serials on this order. Scan a QR below to start one unit.</p>
      )}
      {startResult && <p className="text-[11px] text-emerald-800">{startResult}</p>}
      {scanOpen && (
        <div className="rounded-md border bg-[hsl(var(--card))] p-3 space-y-2">
          <WarrantyQrScanner
            readerId={`pos-warranty-${order.id}`}
            onScan={(payload) => void startFromScan(payload)}
            busy={scanBusy}
          />
          {scanBusy && <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Starting…</p>}
          {scanMessage && (
            <p className={`text-[11px] ${scanMessage.type === "ok" ? "text-emerald-800" : "text-red-600"}`}>
              {scanMessage.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
