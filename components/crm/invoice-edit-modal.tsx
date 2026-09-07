"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, X, FileText, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CrmLineItemsEditor } from "@/components/crm/crm-line-items-editor"
import { CrmWarehouseInventoryPicker } from "@/components/crm/crm-warehouse-inventory-picker"
import { saveOrder, type Order, type OrderItem } from "@/lib/orders"
import {
  calculateGstInclusiveTotals,
  DEFAULT_GST_PERCENT,
  splitGstInclusiveAmount,
} from "@/lib/gst-inclusive-pricing"
import { getCrmProductPrices, buildCrmPriceMap, lookupCrmUnitPrice, type CrmProductPrice } from "@/lib/crm-product-prices"
import { loadCrmWarehouseProducts, type CrmWarehouseProduct } from "@/lib/warehouse-inventory-picker"

function stripStockLimits(items: OrderItem[]): OrderItem[] {
  return items.map(({ availableQty: _aq, costPrice: _cp, ...item }) => ({ ...item }))
}

function lineQty(item: Pick<OrderItem, "qty">) {
  return Math.max(0, Math.floor(Number(item.qty) || 0))
}

/** Diff original vs edited lines for warehouse stock restore / deduct. */
function computeInventoryDeltas(original: OrderItem[], next: OrderItem[]) {
  const restoreLines: Array<{ orderItemId: string; qty: number }> = []
  const freeRestoreItems: OrderItem[] = []
  const deductItems: OrderItem[] = []
  const nextById = new Map(next.map((i) => [i.id, i]))
  const origIds = new Set(original.map((i) => i.id))

  for (const old of original) {
    if (old.isCustom) continue
    const neu = nextById.get(old.id)
    const oldQty = lineQty(old)
    if (!neu) {
      if (oldQty <= 0) continue
      if (old.isFreeItem) {
        freeRestoreItems.push({ ...old, qty: oldQty })
      } else {
        restoreLines.push({ orderItemId: old.id, qty: oldQty })
      }
      continue
    }
    const newQty = lineQty(neu)
    if (newQty < oldQty) {
      const delta = oldQty - newQty
      if (old.isFreeItem) {
        freeRestoreItems.push({ ...old, qty: delta })
      } else {
        restoreLines.push({ orderItemId: old.id, qty: delta })
      }
    } else if (newQty > oldQty && !neu.isFreeItem) {
      deductItems.push({
        ...neu,
        id: `${neu.id}-add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        qty: newQty - oldQty,
      })
    }
  }

  for (const neu of next) {
    if (neu.isCustom || neu.isFreeItem) continue
    if (origIds.has(neu.id)) continue
    deductItems.push(neu)
  }

  return { restoreLines, freeRestoreItems, deductItems }
}

async function postInventoryAction(payload: Record<string, unknown>) {
  const res = await fetch("/api/db/inventory-order-deduct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Inventory update failed",
    )
  }
  return data
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

  const [warehouseProducts, setWarehouseProducts] = useState<CrmWarehouseProduct[]>([])
  const [priceMap, setPriceMap] = useState<Map<string, CrmProductPrice>>(() => new Map())
  const [showInventory, setShowInventory] = useState(false)
  const [inventorySearch, setInventorySearch] = useState("")

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadCrmWarehouseProducts(), getCrmProductPrices().catch(() => [])]).then(
      ([products, prices]) => {
        if (cancelled) return
        setWarehouseProducts(products)
        setPriceMap(buildCrmPriceMap(prices))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

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

  function addFromInventory(product: CrmWarehouseProduct) {
    const existingItem = items.find((i) => i.inventoryItemId === product.id && !i.isFreeItem)
    if (existingItem) {
      setItems((prev) =>
        prev.map((i) => (i.id === existingItem.id ? { ...i, qty: i.qty + 1 } : i)),
      )
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          description: product.displayName,
          qty: 1,
          unit: product.unit || "pcs",
          unitPrice: lookupCrmUnitPrice(priceMap, product.model, "retail") || 0,
          isCustom: false,
          inventoryItemId: product.id,
          model: product.model,
        },
      ])
    }
    setShowInventory(false)
    setInventorySearch("")
  }

  function addCustomItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: "",
        qty: 1,
        unit: "pcs",
        unitPrice: 0,
        isCustom: true,
      },
    ])
  }

  async function handleSave() {
    if (items.length === 0) {
      alert("Invoice must have at least one line item.")
      return
    }
    const blank = items.find((i) => !i.description.trim())
    if (blank) {
      alert("Every line item needs a description.")
      return
    }
    setSaving(true)
    try {
      const { restoreLines, freeRestoreItems, deductItems } = computeInventoryDeltas(
        order.items,
        items,
      )
      const shouldTouchStock =
        Boolean(order.inventoryDeductedAt) ||
        ["delivered", "shipped", "processing", "confirmed"].includes(order.status)

      if (shouldTouchStock && restoreLines.length > 0) {
        await postInventoryAction({
          action: "restore",
          historyNotes: `Invoice edit · ${order.orderNumber} · stock restored`,
          restoreLines,
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            clientName: order.clientName,
            createdBy: order.createdBy,
            status: order.status,
            inventoryDeductedAt: order.inventoryDeductedAt,
            source: order.source,
            fulfillmentSerialAllocations: order.fulfillmentSerialAllocations,
            items: order.items.map((i) => ({
              id: i.id,
              description: i.description,
              qty: i.qty,
              unit: i.unit,
              isCustom: i.isCustom,
              isFreeItem: i.isFreeItem,
              model: i.model,
              inventoryItemId: i.inventoryItemId,
            })),
          },
        })
      }

      for (const freeItem of freeRestoreItems) {
        await postInventoryAction({
          action: "restore",
          historyNotes: `Invoice edit · ${order.orderNumber} · free item restocked`,
          order: {
            id: `${order.id}-free-${freeItem.id}`,
            orderNumber: order.orderNumber,
            clientName: `${order.clientName} (free item)`,
            createdBy: order.createdBy,
            status: "processing",
            items: [
              {
                id: freeItem.id,
                description: freeItem.description,
                qty: freeItem.qty,
                unit: freeItem.unit,
                isCustom: false,
                model: freeItem.model,
                inventoryItemId: freeItem.inventoryItemId,
              },
            ],
          },
        })
      }

      if (shouldTouchStock && deductItems.length > 0) {
        const deductResult = await postInventoryAction({
          action: "deduct",
          order: {
            id: `${order.id}-invoice-edit-${Date.now()}`,
            orderNumber: order.orderNumber,
            clientName: `${order.clientName} (invoice edit)`,
            createdBy: order.createdBy,
            status: "processing",
            items: deductItems.map((i) => ({
              id: i.id,
              description: i.description,
              qty: i.qty,
              unit: i.unit,
              isCustom: false,
              model: i.model,
              inventoryItemId: i.inventoryItemId,
            })),
          },
        })
        const deducted = Number(deductResult?.deductedLines) || 0
        const failed = Array.isArray(deductResult?.failedLines) ? deductResult.failedLines : []
        if (deducted === 0 || failed.length > 0) {
          throw new Error(
            failed.length > 0
              ? `Not enough stock: ${failed.join("; ")}`
              : "Could not deduct stock for newly added items",
          )
        }
      }

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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save invoice changes. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
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
              Add, remove, or change line items and unit prices. Totals recalculate automatically.
              Removing or reducing inventory items restores stock; adding items deducts stock.
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Invoice line items
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 cursor-pointer"
                    onClick={() => setShowInventory(true)}
                  >
                    <Package className="h-3.5 w-3.5" /> Add from inventory
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 cursor-pointer"
                    onClick={addCustomItem}
                  >
                    <Plus className="h-3.5 w-3.5" /> Custom item
                  </Button>
                </div>
              </div>
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

      {showInventory && (
        <CrmWarehouseInventoryPicker
          open={showInventory}
          zClass="z-[100]"
          onClose={() => {
            setShowInventory(false)
            setInventorySearch("")
          }}
          products={warehouseProducts}
          search={inventorySearch}
          onSearchChange={setInventorySearch}
          onSelect={addFromInventory}
        />
      )}
    </>
  )
}
