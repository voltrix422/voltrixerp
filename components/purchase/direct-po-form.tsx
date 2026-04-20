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

export function DirectPOForm({ suppliers, createdBy, onSave, onCancel }: Props) {
  const [supplierId, setSupplierId] = useState("")
  const [items, setItems] = useState<(POItem & { price: number })[]>([
    { id: Date.now().toString(), description: "", qty: 1, unit: "pcs", specs: "", price: 0 }
  ])
  const [tax, setTax] = useState(0)
  const [transport, setTransport] = useState(0)
  const [otherCost, setOtherCost] = useState(0)
  const [otherLabel, setOtherLabel] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const supplier = suppliers.find(s => s.id === supplierId)
  const itemsTotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const taxAmount = itemsTotal * (tax / 100)
  const grandTotal = itemsTotal + taxAmount + transport + otherCost

  function addItem() {
    setItems(prev => [...prev, { id: Date.now().toString(), description: "", qty: 1, unit: "pcs", price: 0 }])
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function updateItem(id: string, key: string, value: string | number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
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
      items: items.map(({ price: _, ...item }) => item),
      notes,
      status: "direct",
      createdBy,
      createdAt: now,
      adminNote: "",
      sentToSupplier: false,
      deliveryDate: "",
      receivingLocation: "",
      suppliersSent: [],
      quotes: [{
        supplierId,
        supplierName: supplier!.name,
        items: items.map(i => ({ itemId: i.id, unitPrice: i.price })),
        taxPct: tax,
        transportCost: transport,
        otherCost,
        otherCostLabel: otherLabel,
        notes: "",
        submittedAt: now,
      }],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <p className="text-sm font-semibold">Direct PO</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Goes directly to Finance</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={onCancel}><X className="h-4 w-4" /></Button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Supplier */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Supplier *</label>
            <select required value={supplierId} onChange={e => setSupplierId(e.target.value)}
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer">
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Items *</label>
              <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2 cursor-pointer" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[hsl(var(--muted))]/40 border-b">
                    <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                    <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-16">Qty</th>
                    <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                    <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-24">Specs (e.g. KW)</th>
                    <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-28">Price (PKR)</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="px-2 py-1.5">
                        <input required value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)}
                          placeholder="Item description"
                          className="w-full h-8 rounded border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="1" required value={item.qty} onChange={e => updateItem(item.id, "qty", Number(e.target.value))}
                          className="w-full h-8 rounded border bg-[hsl(var(--background))] px-3 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)}
                          className="w-full h-8 rounded border bg-[hsl(var(--background))] px-3 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={item.specs || ""} onChange={e => updateItem(item.id, "specs", e.target.value)}
                          placeholder="e.g. 5KW"
                          className="w-full h-8 rounded border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" required value={item.price} onChange={e => updateItem(item.id, "price", Number(e.target.value))}
                          className="w-full h-8 rounded border bg-[hsl(var(--background))] px-3 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                      </td>
                      <td className="px-1 py-1.5">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(item.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Extra costs */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Tax (%)", val: tax, set: setTax },
              { label: "Transport (PKR)", val: transport, set: setTransport },
              { label: "Other Cost (PKR)", val: otherCost, set: setOtherCost },
            ].map(f => (
              <div key={f.label} className="space-y-1">
                <label className="text-xs font-medium">{f.label}</label>
                <input type="number" min="0" step="0.01" value={f.val} onChange={e => f.set(Number(e.target.value))}
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs font-medium">Other Cost Label</label>
              <input value={otherLabel} onChange={e => setOtherLabel(e.target.value)} placeholder="e.g. Customs"
                className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
          </div>

          {/* Total */}
          <div className="rounded-lg border bg-[hsl(var(--muted))]/20 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Grand Total</span>
            <span className="text-sm font-bold">PKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className="h-8 text-xs cursor-pointer" disabled={saving}>
              {saving ? "Saving..." : "Send to Finance"}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
