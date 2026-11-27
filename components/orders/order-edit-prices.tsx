"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, Pencil, X } from "lucide-react"
import {
  recalculateOrderFinancials,
  resolveOrderItemModel,
  saveOrder,
  type Order,
} from "@/lib/orders"
import { splitGstInclusiveAmount, DEFAULT_GST_PERCENT } from "@/lib/gst-inclusive-pricing"

function money(n: number) {
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function OrderEditPricesDialog({
  order,
  open,
  onClose,
  onSaved,
}: {
  order: Order
  open: boolean
  onClose: () => void
  onSaved: (order: Order) => void
}) {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    const next: Record<string, string> = {}
    for (const item of order.items || []) {
      next[item.id] = String(Number(item.unitPrice) || 0)
    }
    setPrices(next)
    setError("")
  }, [open, order.id, order.items])

  const preview = useMemo(() => {
    const items = (order.items || []).map((item) => {
      const raw = prices[item.id]
      const unitPrice = Number(raw)
      return {
        ...item,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : Number(item.unitPrice) || 0,
      }
    })
    return recalculateOrderFinancials({ ...order, items })
  }, [order, prices])

  const taxPercent = preview.taxPercent || DEFAULT_GST_PERCENT
  const { base, gst } = splitGstInclusiveAmount(preview.subtotal, taxPercent)

  async function handleSave() {
    setSaving(true)
    setError("")
    try {
      for (const item of order.items || []) {
        const n = Number(prices[item.id])
        if (!Number.isFinite(n) || n < 0) {
          throw new Error("Enter a valid price for every item.")
        }
      }
      const saved = await saveOrder(preview)
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save prices")
    } finally {
      setSaving(false)
    }
  }

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-[18px] sm:rounded-[18px] border border-black/[0.06] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06]">
          <div>
            <p className="text-[14px] font-semibold text-[#1d1d1f]">Edit prices</p>
            <p className="text-[11px] text-[#86868b]">{order.orderNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {(order.items || []).map((item) => {
            const model = resolveOrderItemModel(item)
            const qty = Number(item.qty) || 0
            const unitPrice = Number(prices[item.id]) || 0
            return (
              <div key={item.id} className="rounded-[12px] border border-black/[0.06] p-3 space-y-2">
                <div>
                  {model ? (
                    <p className="text-[10px] font-semibold text-[#007aff] tabular-nums">{model}</p>
                  ) : null}
                  <p className="text-[12px] font-medium text-[#1d1d1f]">{item.description}</p>
                  <p className="text-[10px] text-[#86868b]">
                    Qty {qty} {item.unit || "pcs"}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-medium text-[#6e6e73] mb-1">
                      Unit price (incl. GST)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prices[item.id] ?? ""}
                      onChange={(e) =>
                        setPrices((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] px-3 text-[13px] tabular-nums outline-none focus:ring-2 focus:ring-[#007aff]/25"
                    />
                  </div>
                  <p className="text-[12px] font-semibold tabular-nums text-[#1d1d1f] pb-2 whitespace-nowrap">
                    = {money(unitPrice * qty)}
                  </p>
                </div>
              </div>
            )
          })}

          <div className="rounded-[12px] bg-[#f5f5f7] px-3 py-2.5 space-y-1 text-[12px]">
            <div className="flex justify-between gap-2">
              <span className="text-[#86868b]">Base (excl. GST)</span>
              <span className="font-medium tabular-nums">{money(base)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#86868b]">Included GST ({taxPercent}%)</span>
              <span className="font-medium tabular-nums">{money(gst)}</span>
            </div>
            <div className="flex justify-between gap-2 pt-1 border-t border-black/[0.06]">
              <span className="font-semibold text-[#1d1d1f]">Total</span>
              <span className="font-semibold tabular-nums text-[#007aff]">{money(preview.total)}</span>
            </div>
          </div>

          {error ? (
            <p className="text-[12px] text-[#ff3b30] bg-[#ff3b30]/08 rounded-[10px] px-3 py-2">{error}</p>
          ) : null}
        </div>

        <div className="px-4 py-3 border-t border-black/[0.06] flex justify-end gap-2 bg-[#fafafa]">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-full text-[12px] font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="h-8 px-4 rounded-full bg-[#007aff] text-white text-[12px] font-semibold hover:bg-[#0066d6] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save prices
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function OrderEditPricesButton({
  onClick,
  className = "",
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ||
        "h-8 inline-flex items-center gap-1.5 px-3 rounded-full border border-black/[0.08] bg-white text-[11px] font-semibold text-[#1d1d1f] hover:bg-black/[0.03] cursor-pointer"
      }
    >
      <Pencil className="h-3 w-3" />
      Edit price
    </button>
  )
}
