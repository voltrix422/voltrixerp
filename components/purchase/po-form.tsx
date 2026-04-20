"use client"
import { useState, useEffect } from "react"
import { getSuppliers, generatePONumber, type Supplier, type POItem, type PurchaseOrder } from "@/lib/purchase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Trash2 } from "lucide-react"

interface Props {
  onSave: (po: Omit<PurchaseOrder, "id">) => void
  onCancel: () => void
  createdBy: string
  type: "local" | "imported"
}

const emptyItem = (): POItem => ({
  id: Date.now().toString() + Math.random(),
  description: "", qty: 1, unit: "pcs", specs: "",
})

export function POForm({ onSave, onCancel, createdBy, type }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([])
  const [supplierId, setSupplierId] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [receivingLocation, setReceivingLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<POItem[]>([emptyItem()])

  useEffect(() => {
    getSuppliers().then(all => setSuppliers(all.filter(s => s.type === type)))
  }, [type])

  const selectedSuppliers = suppliers.filter(s => selectedSupplierIds.includes(s.id))

  function updateItem(id: string, key: keyof POItem, value: string | number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
  }

  function addItem() { setItems(prev => [...prev, emptyItem()]) }
  function removeItem(id: string) { setItems(prev => prev.filter(i => i.id !== id)) }

  function addSupplier() {
    if (supplierId && !selectedSupplierIds.includes(supplierId)) {
      setSelectedSupplierIds(prev => [...prev, supplierId])
      setSupplierId("")
    }
  }

  function removeSupplier(id: string) {
    setSelectedSupplierIds(prev => prev.filter(s => s !== id))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedSupplierIds.length === 0) return

    const poNumber = await generatePONumber()
    const selectedSupplierNames = selectedSupplierIds.map(id => suppliers.find(s => s.id === id)?.name ?? "").filter(Boolean)

    onSave({
      poNumber,
      type,
      supplierIds: selectedSupplierIds,
      supplierNames: selectedSupplierNames,
      items,
      notes,
      status: "sent_to_admin",
      createdBy,
      createdAt: new Date().toISOString(),
      adminNote: "",
      sentToSupplier: false,
      deliveryDate,
      receivingLocation,
      suppliersSent: [],
      quotes: [],
      finalizedSupplierId: undefined,
      payments: [],
      adminDocuments: [],
      financeDocuments1: [],
      purchaseDocuments: [],
      financeDocuments2: [],
      importedItems: [],
      flowHistory: [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border bg-[hsl(var(--card))] shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-[hsl(var(--card))] z-10">
          <div>
            <p className="text-sm font-semibold">New {type === "local" ? "Local" : "Imported"} Purchase Order</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Fill in the details below</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Supplier selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Supplier *</label>
            <div className="flex gap-2">
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                className="flex-1 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer">
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.company ? `(${s.company})` : ""}</option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" className="h-9 cursor-pointer" onClick={addSupplier} disabled={!supplierId}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {suppliers.length === 0 && (
              <p className="text-[10px] text-amber-600">No {type} suppliers found. Add them in the Suppliers tab first.</p>
            )}
          </div>

          {/* Selected suppliers */}
          {selectedSuppliers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                {selectedSuppliers.length} supplier{selectedSuppliers.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedSuppliers.map(s => (
                  <Badge key={s.id} variant="secondary" className="flex items-center gap-1.5 px-2.5 py-1">
                    {s.name}
                    <button type="button" onClick={() => removeSupplier(s.id)} className="hover:text-red-500 cursor-pointer">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Required Delivery Date</label>
            <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
          </div>

          {/* Receiving Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Receiving Location</label>
            <input type="text" value={receivingLocation} onChange={e => setReceivingLocation(e.target.value)}
              placeholder="e.g. Warehouse A, Main Office, Store 3"
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
          </div>

          {/* Items table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Items *</label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> Add Row
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[hsl(var(--muted))]/50 border-b">
                    <th className="px-3 py-2 text-left font-medium text-[hsl(var(--muted-foreground))] w-[45%]">Description</th>
                    <th className="px-3 py-2 text-left font-medium text-[hsl(var(--muted-foreground))] w-[12%]">Qty</th>
                    <th className="px-3 py-2 text-left font-medium text-[hsl(var(--muted-foreground))] w-[12%]">Unit</th>
                    <th className="px-3 py-2 text-left font-medium text-[hsl(var(--muted-foreground))] w-[20%]">Specs (e.g. KW)</th>
                    <th className="px-3 py-2 w-[4%]" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="px-2 py-1.5">
                        <input required value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)}
                          placeholder="Item description"
                          className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="1" required value={item.qty} onChange={e => updateItem(item.id, "qty", Number(e.target.value))}
                          className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)}
                          className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={item.specs || ""} onChange={e => updateItem(item.id, "specs", e.target.value)}
                          placeholder="e.g. 5KW"
                          className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                      </td>
                      <td className="px-2 py-1.5">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 cursor-pointer">
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

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Notes / Terms</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className="cursor-pointer" disabled={selectedSuppliers.length === 0}>
              Create &amp; Send to Dashboard
            </Button>
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
