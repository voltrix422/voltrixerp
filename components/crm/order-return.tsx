"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import {
  saveOrder,
  getOrderAmountPaid,
  getOrderReturnAmount,
  getItemRemainingReturnableQty,
  getItemReturnedQty,
  getSuggestedReturnRefund,
  resolveOrderItemModel,
  applyReturnMerchandiseToOrder,
  type Order,
  type OrderReturnLine,
  type OrderReturnPayment,
} from "@/lib/orders"
import { uploadFile } from "@/lib/upload"
import { Button } from "@/components/ui/button"
import { X, Upload, RotateCcw } from "lucide-react"

export function OrderReturn({
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
  const returnableItems = useMemo(
    () => order.items.filter((item) => getItemRemainingReturnableQty(order, item) > 0),
    [order],
  )

  const [selectedQty, setSelectedQty] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of order.items) init[item.id] = 0
    return init
  })
  const [reason, setReason] = useState(order.returnReason || "")
  const [refundAmount, setRefundAmount] = useState("")
  const [refundMethod, setRefundMethod] = useState("Bank Transfer")
  const [refundDate, setRefundDate] = useState(new Date().toISOString().split("T")[0])
  const [refundNotes, setRefundNotes] = useState("")
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [includeRefund, setIncludeRefund] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountPaid = getOrderAmountPaid(order)
  const alreadyReturned = getOrderReturnAmount(order)
  const remainingRefundable = Math.max(0, amountPaid - alreadyReturned)

  const selectedCount = Object.values(selectedQty).reduce((s, q) => s + (q > 0 ? 1 : 0), 0)
  const selectedUnits = Object.values(selectedQty).reduce((s, q) => s + Math.max(0, q), 0)
  const suggestedRefund = getSuggestedReturnRefund(order, selectedQty)

  useEffect(() => {
    if (!includeRefund) return
    setRefundAmount(suggestedRefund > 0 ? String(Math.round(suggestedRefund * 100) / 100) : "")
  }, [suggestedRefund, includeRefund])

  function setQty(itemId: string, raw: number, max: number) {
    const qty = Math.max(0, Math.min(max, Math.floor(Number(raw) || 0)))
    setSelectedQty((prev) => ({ ...prev, [itemId]: qty }))
  }

  function selectAllRemaining() {
    const next: Record<string, number> = {}
    for (const item of returnableItems) {
      next[item.id] = getItemRemainingReturnableQty(order, item)
    }
    setSelectedQty((prev) => ({ ...prev, ...next }))
  }

  function clearSelection() {
    const next: Record<string, number> = {}
    for (const item of order.items) next[item.id] = 0
    setSelectedQty(next)
  }

  async function handleSubmit() {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setError("Please enter a return reason.")
      return
    }

    const batchLines: OrderReturnLine[] = []
    const now = new Date().toISOString()
    for (const item of returnableItems) {
      const qty = Math.max(0, Math.floor(Number(selectedQty[item.id]) || 0))
      const max = getItemRemainingReturnableQty(order, item)
      if (qty <= 0) continue
      if (qty > max) {
        setError(`Return qty for "${item.description || item.model}" cannot exceed ${max}.`)
        return
      }
      batchLines.push({
        id: `rl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        orderItemId: item.id,
        qty,
        returnedAt: now,
        returnedBy: currentUser,
        description: item.description,
        model: resolveOrderItemModel(item) || item.model,
        unit: item.unit || "pcs",
        unitPrice: Number(item.unitPrice) || 0,
      })
    }

    if (batchLines.length === 0) {
      setError("Select at least one item (and quantity) to return.")
      return
    }

    let returnPayments: OrderReturnPayment[] = [...(order.returnPayments || [])]

    if (includeRefund) {
      const amount = Number(refundAmount)
      if (Number.isNaN(amount) || amount <= 0) {
        setError("Enter a valid return payment amount, or turn off return payment.")
        return
      }
      if (amount > remainingRefundable + 0.004 && amountPaid > 0.004) {
        setError(
          `Return payment cannot exceed remaining refundable amount (PKR ${remainingRefundable.toLocaleString()}).`,
        )
        return
      }

      setUploading(true)
      let proofUrls: string[] = []
      try {
        if (proofFiles.length > 0) {
          proofUrls = await Promise.all(proofFiles.map((f) => uploadFile(f, "payment-proofs")))
        }
      } catch {
        setError("Failed to upload return payment proof.")
        setUploading(false)
        return
      } finally {
        setUploading(false)
      }

      returnPayments = [
        ...returnPayments,
        {
          id: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          amount,
          method: refundMethod,
          date: refundDate,
          notes: refundNotes.trim(),
          proofUrl: proofUrls[0],
          proofUrls: proofUrls.length > 0 ? proofUrls : undefined,
          createdAt: now,
          createdBy: currentUser,
        },
      ]
    }

    setSaving(true)
    setError(null)
    try {
      const returnLines = [...(order.returnLines || []), ...batchLines]
      const withReturns: Order = {
        ...order,
        status: "delivered",
        returnReason: trimmedReason,
        returnedAt: order.returnedAt || now,
        returnedBy: order.returnedBy || currentUser,
        returnPayments,
        returnLines,
        inventoryReturnedAt: order.inventoryReturnedAt,
      }
      // Reduce line qty + recalculate totals for remaining items (API also enforces this).
      const updated = order.returnMerchandiseApplied
        ? applyReturnMerchandiseToOrder(withReturns, {
            deltaOnly: batchLines.map((l) => ({ orderItemId: l.orderItemId, qty: l.qty })),
          })
        : applyReturnMerchandiseToOrder(withReturns)
      const saved = await saveOrder(updated)
      onUpdate(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not return items from this order.")
    } finally {
      setSaving(false)
    }
  }

  function onProofChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setProofFiles(files)
    e.target.value = ""
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b shrink-0">
          <div>
            <p className="text-sm font-bold flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-600" />
              Return items
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {order.orderNumber} · {order.clientName}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="rounded-lg border bg-orange-50 dark:bg-orange-950/40 p-3 text-xs text-orange-900 dark:text-orange-100 space-y-1">
            <p>Select which items (and quantities) to return. Only those will go back into inventory.</p>
            <p>
              Order total: PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {amountPaid > 0 && (
                <> · Paid: PKR {amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
              )}
              {alreadyReturned > 0 && (
                <> · Already refunded: PKR {alreadyReturned.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
              )}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                Items to return <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] underline text-[hsl(var(--muted-foreground))] hover:text-foreground cursor-pointer"
                  onClick={selectAllRemaining}
                >
                  Return all remaining
                </button>
                <button
                  type="button"
                  className="text-[11px] underline text-[hsl(var(--muted-foreground))] hover:text-foreground cursor-pointer"
                  onClick={clearSelection}
                >
                  Clear
                </button>
              </div>
            </div>

            {returnableItems.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] rounded-md border px-3 py-3">
                No returnable quantities left on this order.
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-[hsl(var(--muted))]/30 text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        <th className="px-3 py-2 font-semibold">Item</th>
                        <th className="px-3 py-2 font-semibold text-right">Ordered</th>
                        <th className="px-3 py-2 font-semibold text-right">Returned</th>
                        <th className="px-3 py-2 font-semibold text-right">Return now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnableItems.map((item) => {
                        const remaining = getItemRemainingReturnableQty(order, item)
                        const already = getItemReturnedQty(order, item.id)
                        const model = resolveOrderItemModel(item)
                        return (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              <p className="font-medium">{item.description || model || "Item"}</p>
                              {model && (
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                                  {model}
                                </p>
                              )}
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                PKR {(item.unitPrice || 0).toLocaleString()} / {item.unit || "pcs"}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{item.qty}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                              {already}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                max={remaining}
                                step={1}
                                value={selectedQty[item.id] ?? 0}
                                onChange={(e) => setQty(item.id, Number(e.target.value), remaining)}
                                className="w-20 h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-sm text-right tabular-nums"
                              />
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                                max {remaining}
                              </p>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 border-t bg-[hsl(var(--muted))]/20 text-[11px] text-[hsl(var(--muted-foreground))]">
                  {selectedCount > 0
                    ? `${selectedCount} line(s) · ${selectedUnits} unit(s) selected`
                    : "No items selected yet"}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
              Return reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why are these items being returned?"
              className="mt-1 w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeRefund}
              onChange={(e) => setIncludeRefund(e.target.checked)}
              className="rounded border"
            />
            Record return payment (refund to client)
          </label>

          {includeRefund && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Suggested from selected items (incl. GST): PKR{" "}
                {suggestedRefund.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                {remainingRefundable > 0 && (
                  <> · Max refundable: PKR {remainingRefundable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                )}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                    Amount (PKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                    Date
                  </label>
                  <input
                    type="date"
                    value={refundDate}
                    onChange={(e) => setRefundDate(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                  Method
                </label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
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
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                  Notes
                </label>
                <input
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="mt-1 w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                  Payment proof
                </label>
                <label className="mt-1 flex items-center gap-2 h-9 px-3 rounded-md border border-dashed text-xs cursor-pointer hover:bg-[hsl(var(--muted))]/40">
                  <Upload className="h-3.5 w-3.5" />
                  {proofFiles.length > 0
                    ? `${proofFiles.length} file(s) selected`
                    : "Upload return payment proof"}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    className="hidden"
                    onChange={onProofChange}
                  />
                </label>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 sm:px-6 py-4 border-t shrink-0">
          <Button variant="outline" className="h-10 cursor-pointer" onClick={onClose} disabled={saving || uploading}>
            Cancel
          </Button>
          <Button
            className="h-10 bg-orange-500 hover:bg-orange-600 text-white cursor-pointer sm:ml-auto"
            onClick={() => void handleSubmit()}
            disabled={saving || uploading || selectedUnits <= 0}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {saving || uploading
              ? "Processing..."
              : selectedUnits > 0
                ? `Confirm return (${selectedUnits})`
                : "Confirm return"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ReturnPaymentCapture({
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
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("Bank Transfer")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountPaid = getOrderAmountPaid(order)
  const alreadyReturned = getOrderReturnAmount(order)
  const remainingRefundable = Math.max(0, amountPaid - alreadyReturned)

  async function handleSubmit() {
    const value = Number(amount)
    if (Number.isNaN(value) || value <= 0) {
      setError("Enter a valid return payment amount.")
      return
    }
    if (value > remainingRefundable + 0.004 && amountPaid > 0.004) {
      setError(
        `Return payment cannot exceed remaining refundable amount (PKR ${remainingRefundable.toLocaleString()}).`,
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
      const payment: OrderReturnPayment = {
        id: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount: value,
        method,
        date,
        notes: notes.trim(),
        proofUrl: proofUrls[0],
        proofUrls: proofUrls.length > 0 ? proofUrls : undefined,
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
      }
      const updated: Order = {
        ...order,
        returnPayments: [...(order.returnPayments || []), payment],
      }
      const saved = await saveOrder(updated)
      onUpdate(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save return payment.")
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
            <p className="text-sm font-bold">Add return payment</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {order.orderNumber} · Refundable PKR {remainingRefundable.toLocaleString()}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
              className="mt-1 w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-dashed text-xs cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {proofFiles.length > 0 ? `${proofFiles.length} proof file(s)` : "Upload proof"}
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
            className="h-9 bg-orange-500 hover:bg-orange-600 text-white cursor-pointer ml-auto"
            onClick={() => void handleSubmit()}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save return payment"}
          </Button>
        </div>
      </div>
    </div>
  )
}
