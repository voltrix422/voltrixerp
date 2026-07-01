"use client"
import { useState } from "react"
import { type PurchaseOrder, type Supplier, type POItem, generatePONumber } from "@/lib/purchase"
import { Button } from "@/components/ui/button"
import { X, Plus, Trash2 } from "lucide-react"

interface Props {
  suppliers: Supplier[]
  createdBy: string
  onSave: (po: Omit<PurchaseOrder, "id">) => void
  onCancel: () => void
}

type DirectPOItem = POItem & { price: number; lineTotal: number }

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyItem(): DirectPOItem {
  return { id: Date.now().toString(), description: "", qty: 1, unit: "pcs", specs: "", price: 0, lineTotal: 0 }
}

const inputClass =
  "w-full h-11 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]/40 focus:border-[#1a9f9a]"

export function DirectPOForm({ suppliers, createdBy, onSave, onCancel }: Props) {
  const [supplierId, setSupplierId] = useState("")
  const [items, setItems] = useState<DirectPOItem[]>([emptyItem()])
  const [tax, setTax] = useState(0)
  const [transport, setTransport] = useState(0)
  const [otherCost, setOtherCost] = useState(0)
  const [otherLabel, setOtherLabel] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const supplier = suppliers.find((s) => s.id === supplierId)
  const itemsTotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const taxAmount = itemsTotal * (tax / 100)
  const grandTotal = itemsTotal + taxAmount + transport + otherCost

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem(), id: `${Date.now()}-${prev.length}` }])
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function updateQty(id: string, qty: number) {
    const safeQty = Math.max(1, qty || 1)
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        const lineTotal = i.lineTotal > 0 ? i.lineTotal : roundMoney(i.price * safeQty)
        const price = lineTotal > 0 ? roundMoney(lineTotal / safeQty) : i.price
        return { ...i, qty: safeQty, price, lineTotal: lineTotal > 0 ? lineTotal : roundMoney(price * safeQty) }
      }),
    )
  }

  function updateUnitPrice(id: string, price: number) {
    const safePrice = Math.max(0, price || 0)
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        return { ...i, price: safePrice, lineTotal: roundMoney(safePrice * i.qty) }
      }),
    )
  }

  function updateLineTotal(id: string, lineTotal: number) {
    const safeTotal = Math.max(0, lineTotal || 0)
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        const price = i.qty > 0 ? roundMoney(safeTotal / i.qty) : 0
        return { ...i, lineTotal: safeTotal, price }
      }),
    )
  }

  function updateItemField(id: string, key: "description" | "unit" | "specs", value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [key]: value } : i)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) return
    setSaving(true)
    const poNumber = await generatePONumber()
    const now = new Date().toISOString()
    onSave({
      poNumber,
      type: supplier!.type,
      supplierIds: [supplierId],
      supplierNames: [supplier!.name],
      items: items.map(({ price: _, lineTotal: __, ...item }) => item),
      notes,
      status: "direct",
      createdBy,
      createdAt: now,
      adminNote: "",
      sentToSupplier: false,
      deliveryDate: "",
      receivingLocation: "",
      suppliersSent: [],
      quotes: [
        {
          supplierId,
          supplierName: supplier!.name,
          items: items.map((i) => ({ itemId: i.id, unitPrice: i.price })),
          taxPct: tax,
          transportCost: transport,
          otherCost,
          otherCostLabel: otherLabel,
          notes: "",
          submittedAt: now,
        },
      ],
      finalizedSupplierId: supplierId,
      payments: [],
      adminDocuments: [],
      financeDocuments1: [],
      purchaseDocuments: [],
      financeDocuments2: [],
      importedItems: [],
      flowHistory: [],
    })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-5xl rounded-2xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b shrink-0">
          <div>
            <p className="text-lg font-semibold">Direct PO</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Goes directly to Finance</p>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Supplier *</label>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium">Items *</label>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Enter qty, then line total — unit price is calculated automatically.
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" className="h-9 text-sm px-3 cursor-pointer" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Item
              </Button>
            </div>

            <div className="rounded-xl border overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="bg-[hsl(var(--muted))]/40 border-b">
                    <th className="px-3 py-3 text-left font-semibold text-[hsl(var(--muted-foreground))] min-w-[200px]">
                      Description
                    </th>
                    <th className="px-3 py-3 text-center font-semibold text-[hsl(var(--muted-foreground))] w-24">Qty</th>
                    <th className="px-3 py-3 text-center font-semibold text-[hsl(var(--muted-foreground))] w-24">Unit</th>
                    <th className="px-3 py-3 text-left font-semibold text-[hsl(var(--muted-foreground))] w-32">
                      Specs (e.g. KW)
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-[hsl(var(--muted-foreground))] w-36">
                      Unit price
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-[hsl(var(--muted-foreground))] w-40">
                      Line total (PKR)
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-2.5">
                        <input
                          required
                          value={item.description}
                          onChange={(e) => updateItemField(item.id, "description", e.target.value)}
                          placeholder="Item description"
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.qty}
                          onChange={(e) => updateQty(item.id, Number(e.target.value))}
                          className={`${inputClass} text-center tabular-nums`}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          value={item.unit}
                          onChange={(e) => updateItemField(item.id, "unit", e.target.value)}
                          className={`${inputClass} text-center`}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          value={item.specs || ""}
                          onChange={(e) => updateItemField(item.id, "specs", e.target.value)}
                          placeholder="e.g. 5KW"
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price || ""}
                          onChange={(e) => updateUnitPrice(item.id, Number(e.target.value))}
                          placeholder="Auto"
                          className={`${inputClass} text-right tabular-nums bg-[hsl(var(--muted))]/10`}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.lineTotal || ""}
                          onChange={(e) => updateLineTotal(item.id, Number(e.target.value))}
                          placeholder="Total for qty"
                          className={`${inputClass} text-right tabular-nums font-medium`}
                        />
                      </td>
                      <td className="px-1 py-2.5 align-middle">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="h-9 w-9 inline-flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] text-right">
              Items subtotal: <span className="font-semibold text-[hsl(var(--foreground))]">PKR {itemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Tax (%)", val: tax, set: setTax },
              { label: "Transport (PKR)", val: transport, set: setTransport },
              { label: "Other Cost (PKR)", val: otherCost, set: setOtherCost },
            ].map((f) => (
              <div key={f.label} className="space-y-1.5">
                <label className="text-sm font-medium">{f.label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={f.val}
                  onChange={(e) => f.set(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Other Cost Label</label>
              <input
                value={otherLabel}
                onChange={(e) => setOtherLabel(e.target.value)}
                placeholder="e.g. Customs"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputClass} py-3 resize-y min-h-[88px]`}
            />
          </div>

          <div className="rounded-xl border bg-[hsl(var(--muted))]/20 px-5 py-4 flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Grand Total</span>
            <span className="text-xl font-bold tabular-nums">
              PKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" className="h-10 px-5 text-sm cursor-pointer" disabled={saving}>
              {saving ? "Saving..." : "Send to Finance"}
            </Button>
            <Button type="button" variant="outline" className="h-10 px-5 text-sm cursor-pointer" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
