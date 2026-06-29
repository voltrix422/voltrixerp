"use client"

import { useMemo, useState } from "react"
import { X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CrmLineItemsEditor } from "@/components/crm/crm-line-items-editor"
import { saveOrder, type Order, type OrderItem } from "@/lib/orders"
import {
  calculateGstInclusiveTotals,
  DEFAULT_GST_PERCENT,
  splitGstInclusiveAmount,
} from "@/lib/gst-inclusive-pricing"

function stripStockLimits(items: OrderItem[]): OrderItem[] {
  return items.map(({ availableQty: _aq, costPrice: _cp, ...item }) => ({ ...item }))
}

export function InvoiceEditModal({
  order,
  onClose,
  onSave,
}: {
  order: Order
  onClose: () => void
  onSave: (order: Order) => void
}) {
  const taxPercent = order.taxPercent || DEFAULT_GST_PERCENT

  const [items, setItems] = useState<OrderItem[]>(() => stripStockLimits(order.items))
  const [transportCost, setTransportCost] = useState(order.transportCost ?? 0)
  const [transportLabel, setTransportLabel] = useState(order.transportLabel || "Transport")
  const [transportIsPercentage, setTransportIsPercentage] = useState(order.transportIsPercentage ?? false)
  const [otherCost, setOtherCost] = useState(order.otherCost ?? 0)
  const [otherCostLabel, setOtherCostLabel] = useState(order.otherCostLabel || "Other")
  const [otherCostIsPercentage, setOtherCostIsPercentage] = useState(order.otherCostIsPercentage ?? false)
  const [discount, setDiscount] = useState(order.discount ?? 0)
  const [discountIsPercentage, setDiscountIsPercentage] = useState(order.discountIsPercentage ?? true)
  const [notes, setNotes] = useState(order.notes ?? "")
  const [deliveryAddress, setDeliveryAddress] = useState(order.deliveryAddress ?? "")
  const [saving, setSaving] = useState(false)

  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const subtotalGstBreakdown = splitGstInclusiveAmount(subtotal, taxPercent)
  const pricing = useMemo(
    () =>
      calculateGstInclusiveTotals({
        subtotalInclGst: subtotal,
        gstPercent: taxPercent,
        discount,
        discountIsPercentage,
        transportCost,
        transportIsPercentage,
        otherCost,
        otherCostIsPercentage,
      }),
    [
      subtotal,
      taxPercent,
      discount,
      discountIsPercentage,
      transportCost,
      transportIsPercentage,
      otherCost,
      otherCostIsPercentage,
    ],
  )

  const {
    base: subtotalBeforeTax,
    gst: taxAmount,
    discountOnBase: discountAmount,
    transportAmount,
    otherAmount,
    total,
  } = pricing

  function updateItem(id: string, key: keyof OrderItem, value: string | number) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    )
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleSave() {
    if (items.length === 0) {
      alert("Invoice must have at least one line item.")
      return
    }
    setSaving(true)
    try {
      const updated: Order = {
        ...order,
        items,
        subtotal,
        taxPercent,
        tax: taxAmount,
        transportCost,
        transportLabel,
        transportIsPercentage,
        transportCostValue: transportAmount,
        otherCost,
        otherCostLabel,
        otherCostIsPercentage,
        otherCostValue: otherAmount,
        discount,
        discountIsPercentage,
        discountValue: discountAmount,
        total,
        notes: notes.trim(),
        deliveryAddress: deliveryAddress.trim(),
      }
      const saved = await saveOrder(updated)
      onSave(saved)
      onClose()
    } catch {
      alert("Could not save invoice changes. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-5xl rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-5 border-b shrink-0">
          <div>
            <p className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#1faca6]" />
              Edit invoice — {order.orderNumber}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 capitalize">
              {order.clientName} · Status stays {order.status.replace(/_/g, " ")}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 space-y-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            Update line prices, quantities, and totals. Changes apply to the order and downloaded invoice PDF.
            Order status and payments are not changed.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Delivery address (on invoice)</label>
              <input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Notes (on invoice)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
              Invoice line items
            </p>
            <CrmLineItemsEditor
              items={items}
              onUpdate={updateItem}
              onRemove={removeItem}
              size="md"
              removeIcon="trash"
              gstPercent={taxPercent}
            />
          </div>

          {subtotal > 0 && (
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                  Subtotal (excl. GST)
                </p>
                <p className="font-semibold tabular-nums mt-1">
                  PKR {subtotalGstBreakdown.base.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                  GST ({taxPercent}%)
                </p>
                <p className="font-semibold tabular-nums mt-1 text-[#1faca6]">
                  PKR {subtotalGstBreakdown.gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                  Subtotal (incl. GST)
                </p>
                <p className="font-semibold tabular-nums mt-1">
                  PKR {subtotalGstBreakdown.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          <div className="pt-2 border-t space-y-4">
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Discount
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Discount %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountIsPercentage ? discount : subtotalBeforeTax > 0 ? ((discountAmount / subtotalBeforeTax) * 100).toFixed(2) : 0}
                  onChange={(e) => {
                    setDiscount(Number(e.target.value))
                    setDiscountIsPercentage(true)
                  }}
                  className="w-full h-9 rounded-md border px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Discount amount (PKR)</label>
                <input
                  type="number"
                  min={0}
                  value={discountIsPercentage ? discountAmount : discount}
                  onChange={(e) => {
                    setDiscount(Number(e.target.value))
                    setDiscountIsPercentage(false)
                  }}
                  className="w-full h-9 rounded-md border px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Applied discount</label>
                <div className="h-9 flex items-center px-3 rounded-md border bg-[hsl(var(--muted))]/30 text-sm text-green-600 font-medium">
                  − PKR {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t space-y-3">
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Transport & other
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={transportLabel}
                  onChange={(e) => setTransportLabel(e.target.value)}
                  placeholder="Transport label"
                  className="h-9 rounded-md border px-3 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={transportCost}
                  onChange={(e) => setTransportCost(Number(e.target.value))}
                  className="h-9 rounded-md border px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={otherCostLabel}
                  onChange={(e) => setOtherCostLabel(e.target.value)}
                  placeholder="Other label"
                  className="h-9 rounded-md border px-3 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={otherCost}
                  onChange={(e) => setOtherCost(Number(e.target.value))}
                  className="h-9 rounded-md border px-3 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center border-t pt-4 text-base font-bold">
            <span>Invoice total</span>
            <span className="text-[#1faca6] tabular-nums">
              PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 sm:px-8 py-3 sm:py-5 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button
            size="sm"
            className="h-10 bg-[#1faca6] hover:bg-[#17857f] text-white cursor-pointer"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save invoice changes"}
          </Button>
          <Button size="sm" variant="outline" className="h-10 sm:ml-auto cursor-pointer" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
