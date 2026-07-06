"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { formatCurrency, type PosStockProduct } from "@/lib/pos"
import { generateQuotationNumber, saveQuotation, type Quotation, type QuotationItem } from "@/lib/quotations"
import { saveOrder, type Order, type OrderItem } from "@/lib/orders"
import { Loader2, Minus, Plus } from "lucide-react"

type DocKind = "quotation" | "order"

type Line = {
  product: PosStockProduct
  qty: number
  unitPrice: number
}

export function BranchPosDocsPanel({
  kind,
  products,
  branchName,
  userName,
}: {
  kind: DocKind
  products: PosStockProduct[]
  branchName: string
  userName: string
}) {
  const { toast } = useToast()
  const [clientName, setClientName] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)
  const [productId, setProductId] = useState("")

  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)

  const availableProducts = useMemo(
    () => products.filter((p) => p.availableQty > 0),
    [products],
  )

  function addLine() {
    const product = availableProducts.find((p) => p.id === productId)
    if (!product) return
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) {
        const qty = Math.min(product.availableQty, existing.qty + 1)
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty } : l,
        )
      }
      return [...prev, { product, qty: 1, unitPrice: product.costPrice || 0 }]
    })
    setProductId("")
  }

  function updateQty(productId: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== productId) return l
          const qty = Math.max(0, Math.min(l.product.availableQty, l.qty + delta))
          return { ...l, qty }
        })
        .filter((l) => l.qty > 0),
    )
  }

  async function handleSave() {
    if (!clientName.trim()) {
      toast({ type: "error", title: "Client name is required" })
      return
    }
    if (lines.length === 0) {
      toast({ type: "error", title: "Add at least one item" })
      return
    }
    setSaving(true)
    try {
      const items: QuotationItem[] | OrderItem[] = lines.map((line, idx) => ({
        id: `${Date.now()}-${idx}`,
        description: line.product.description,
        qty: line.qty,
        unit: line.product.unit,
        unitPrice: line.unitPrice,
        isCustom: false,
        inventoryItemId: line.product.inventoryId || line.product.id,
        model: line.product.description,
        availableQty: line.product.availableQty,
        costPrice: line.product.costPrice,
      }))

      if (kind === "quotation") {
        const quotationNumber = await generateQuotationNumber()
        const quotation: Quotation = {
          id: "",
          quotationNumber,
          clientId: "",
          clientName: clientName.trim(),
          items: items as QuotationItem[],
          subtotal,
          taxPercent: 0,
          tax: 0,
          transportCost: 0,
          transportLabel: "Transport",
          otherCost: 0,
          otherCostLabel: "Other",
          discount: 0,
          total: subtotal,
          status: "draft",
          notes: notes.trim() || `Created from ${branchName} POS`,
          deliveryAddress: "",
          validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          createdBy: userName,
        }
        await saveQuotation(quotation)
        toast({ type: "success", title: `Quotation ${quotationNumber} saved` })
      } else {
        const order: Order = {
          id: "",
          orderNumber: "",
          clientId: "",
          clientName: clientName.trim(),
          items: items as OrderItem[],
          subtotal,
          taxPercent: 0,
          tax: 0,
          transportCost: 0,
          transportLabel: "Transport",
          otherCost: 0,
          otherCostLabel: "Other",
          discount: 0,
          total: subtotal,
          shipping: 0,
          status: "draft",
          notes: notes.trim() || `Created from ${branchName} POS`,
          deliveryAddress: "",
          deliveryDate: "",
          paymentTerms: "full",
          createdAt: new Date().toISOString(),
          createdBy: userName,
          dispatcher: "",
          fulfillmentProductImageUrls: [],
          fulfillmentSerialAllocations: [],
        }
        await saveOrder(order)
        toast({ type: "success", title: "Order draft saved" })
      }
      setClientName("")
      setNotes("")
      setLines([])
    } catch {
      toast({ type: "error", title: `Could not save ${kind}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-4 max-w-3xl">
      <div>
        <h3 className="text-sm font-semibold">
          {kind === "quotation" ? "New quotation" : "New order"}
        </h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Uses stock available at {branchName} only.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Client name *</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full h-9 rounded-md border px-3 text-sm"
            placeholder="Customer / company"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-9 rounded-md border px-3 text-sm"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="h-9 flex-1 min-w-[200px] rounded-md border px-3 text-sm"
        >
          <option value="">Select product from branch stock…</option>
          {availableProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.description} ({p.availableQty} {p.unit})
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={!productId}>
          Add item
        </Button>
      </div>

      {lines.length > 0 && (
        <div className="rounded-md border divide-y">
          {lines.map((line) => (
            <div key={line.product.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <div className="flex-1 min-w-[160px]">
                <p className="font-medium line-clamp-2">{line.product.description}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Max {line.product.availableQty} {line.product.unit}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => updateQty(line.product.id, -1)} className="p-1 rounded border cursor-pointer">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center tabular-nums">{line.qty}</span>
                <button type="button" onClick={() => updateQty(line.product.id, 1)} className="p-1 rounded border cursor-pointer">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="number"
                min={0}
                value={line.unitPrice}
                onChange={(e) => {
                  const unitPrice = Number(e.target.value) || 0
                  setLines((prev) =>
                    prev.map((l) =>
                      l.product.id === line.product.id ? { ...l, unitPrice } : l,
                    ),
                  )
                }}
                className="w-24 h-8 rounded border px-2 text-sm"
              />
              <span className="font-semibold tabular-nums w-24 text-right">
                {formatCurrency(line.qty * line.unitPrice)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Total: {formatCurrency(subtotal)}</p>
        <Button
          type="button"
          className="bg-[#1faca6] hover:bg-[#17857f] text-white"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save {kind === "quotation" ? "quotation" : "order"}
        </Button>
      </div>
    </div>
  )
}
