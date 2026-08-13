"use client"

import { useState } from "react"
import { X, Upload, Gift } from "lucide-react"
import {
  getOrderCashbackRemainingFromOrder,
  saveOrder,
  type Order,
  type OrderCashbackPayment,
  type OrderCashbackSource,
} from "@/lib/orders"
import { uploadFile } from "@/lib/upload"
import { Button } from "@/components/ui/button"

export function CashbackCapture({
  order,
  currentUser,
  onClose,
  onUpdate,
}: {
  order: Order
  currentUser: string
  onClose: () => void
  onUpdate: (o: Order) => void
}) {
  const [source, setSource] = useState<OrderCashbackSource>("order")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("Bank Transfer")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remainingFromOrder = getOrderCashbackRemainingFromOrder(order)

  async function handleSubmit() {
    const value = Number(amount)
    if (Number.isNaN(value) || value <= 0) {
      setError("Enter a valid cashback amount.")
      return
    }
    if (source === "order" && value > remainingFromOrder + 0.004) {
      setError(
        `Cashback from order cannot exceed remaining balance (PKR ${remainingFromOrder.toLocaleString()}).`,
      )
      return
    }

    setSaving(true)
    setError(null)
    try {
      let proofUrls: string[] = []
      if (proofFiles.length > 0) {
        proofUrls = await Promise.all(proofFiles.map((f) => uploadFile(f, "payment-proofs")))
      }
      const payment: OrderCashbackPayment = {
        id: `cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount: value,
        method,
        date,
        notes: notes.trim(),
        source,
        proofUrl: proofUrls[0],
        proofUrls: proofUrls.length > 0 ? proofUrls : undefined,
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
      }
      const updated: Order = {
        ...order,
        cashbackPayments: [...(order.cashbackPayments || []), payment],
      }
      const saved = await saveOrder(updated)
      onUpdate(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save cashback.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-bold flex items-center gap-1.5">
              <Gift className="h-4 w-4 text-violet-600" />
              Add cashback
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {order.orderNumber} · Bonus or refund to client
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">Cashback type</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setSource("order")}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                  source === "order"
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40"
                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30"
                }`}
              >
                <p className="font-semibold">From order balance</p>
                <p className="text-[hsl(var(--muted-foreground))] mt-0.5">
                  Refund or bonus against this order — reduces balance by up to PKR{" "}
                  {remainingFromOrder.toLocaleString()}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSource("other")}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                  source === "other"
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40"
                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30"
                }`}
              >
                <p className="font-semibold">Other amount (goodwill bonus)</p>
                <p className="text-[hsl(var(--muted-foreground))] mt-0.5">
                  Separate bonus not tied to order total — tracked as cashback only
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Amount (PKR)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={source === "order" ? String(Math.round(remainingFromOrder)) : "e.g. 5000"}
                className="mt-1 w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            >
              <option>Bank Transfer</option>
              <option>Cash</option>
              <option>Cheque</option>
              <option>JazzCash</option>
              <option>EasyPaisa</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for cashback / bonus"
              className="mt-1 w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-dashed text-xs cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {proofFiles.length > 0 ? `${proofFiles.length} attachment(s)` : "Upload attachment (optional)"}
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                setProofFiles(Array.from(e.target.files || []))
                e.target.value = ""
              }}
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2 px-4 py-3 border-t">
          <Button variant="outline" className="h-9 cursor-pointer" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="h-9 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer ml-auto"
            onClick={() => void handleSubmit()}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save cashback"}
          </Button>
        </div>
      </div>
    </div>
  )
}
