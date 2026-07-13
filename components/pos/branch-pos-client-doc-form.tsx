"use client"

import { useEffect, useMemo, useState } from "react"
import { getClients, type Client } from "@/lib/crm"
import { isBranchPosClient } from "@/lib/branch-pos"
import { generateOrderNumber, saveOrder, type Order, type OrderItem } from "@/lib/orders"
import {
  generateQuotationNumber,
  saveQuotation,
  type Quotation,
  type QuotationItem,
} from "@/lib/quotations"
import { formatCurrency, type PosStockProduct } from "@/lib/pos"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { ChevronDown, Loader2, Minus, Plus, Search, X } from "lucide-react"

type DocKind = "order" | "quotation"

export function BranchPosClientDocForm({
  kind,
  products,
  branchName,
  userName,
  onSaved,
}: {
  kind: DocKind
  products: PosStockProduct[]
  branchName: string
  userName: string
  onSaved?: () => void
}) {
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [clientId, setClientId] = useState("")
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [items, setItems] = useState<(OrderItem | QuotationItem)[]>([])
  const [notes, setNotes] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [showProducts, setShowProducts] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getClients()
      .then((rows) =>
        setClients(rows.filter((c) => c.status === "active" && isBranchPosClient(c, branchName))),
      )
      .finally(() => setLoadingClients(false))
  }, [branchName])

  const selectedClient = clients.find((c) => c.id === clientId)
  const filteredClients = clients.filter((c) => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    )
  })

  const availableProducts = useMemo(
    () => products.filter((p) => p.availableQty > 0),
    [products],
  )

  const filteredProducts = availableProducts.filter((p) => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return true
    return p.description.toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q)
  })

  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)

  function addProduct(product: PosStockProduct) {
    const invId = product.inventoryId || product.id
    const existing = items.find((i) => i.inventoryItemId === invId)
    if (existing) {
      if (existing.qty < product.availableQty) {
        setItems((prev) =>
          prev.map((i) =>
            i.inventoryItemId === invId ? { ...i, qty: i.qty + 1 } : i,
          ),
        )
      }
      return
    }
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        description: product.description,
        qty: 1,
        unit: product.unit,
        unitPrice: product.costPrice || 0,
        isCustom: false,
        inventoryItemId: invId,
        model: product.description,
        availableQty: product.availableQty,
        costPrice: product.costPrice,
      },
    ])
    setShowProducts(false)
    setProductSearch("")
  }

  function updateItem(id: string, key: "qty" | "unitPrice", value: number) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        if (key === "qty" && i.availableQty !== undefined && value > i.availableQty) {
          toast({ type: "error", title: `Max ${i.availableQty} ${i.unit} at ${branchName}` })
          return i
        }
        return { ...i, [key]: value }
      }),
    )
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function handleSubmit() {
    if (!clientId) {
      toast({ type: "error", title: "Select a client" })
      return
    }
    if (items.length === 0) {
      toast({ type: "error", title: "Add at least one item" })
      return
    }
    setSaving(true)
    try {
      const client = clients.find((c) => c.id === clientId)
      if (kind === "quotation") {
        const quotationNumber = await generateQuotationNumber()
        const q: Quotation = {
          id: Date.now().toString(),
          quotationNumber,
          clientId,
          clientName: client?.name || "",
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
          notes: notes.trim() || `Branch POS · ${branchName}`,
          deliveryAddress: deliveryAddress.trim(),
          validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          createdBy: userName,
        }
        await saveQuotation(q)
        toast({ type: "success", title: `Quotation ${quotationNumber} created` })
      } else {
        const order: Order = {
          id: Date.now().toString(),
          orderNumber: await generateOrderNumber(),
          clientId,
          clientName: client?.name || "",
          items: items as OrderItem[],
          subtotal,
          taxPercent: 0,
          tax: 0,
          transportCost: 0,
          transportLabel: "Transport",
          otherCost: 0,
          otherCostLabel: "Other",
          shipping: 0,
          discount: 0,
          total: subtotal,
          status: "draft",
          notes: notes.trim() || `Branch POS · ${branchName}`,
          deliveryAddress: deliveryAddress.trim(),
          deliveryDate: deliveryDate || "",
          createdAt: new Date().toISOString(),
          createdBy: userName,
          payments: [],
        }
        await saveOrder(order)
        toast({ type: "success", title: "Order created" })
      }
      setClientId("")
      setItems([])
      setNotes("")
      setDeliveryAddress("")
      setDeliveryDate("")
      onSaved?.()
    } catch {
      toast({ type: "error", title: `Could not save ${kind}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-[hsl(var(--card))] p-4 sm:p-6 space-y-5 max-w-4xl">
      <div>
        <h3 className="text-base font-semibold">
          {kind === "order" ? "Create order" : "Create quotation"}
        </h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Select a client and add items from <strong>{branchName}</strong> stock only.
        </p>
      </div>

      <div className="space-y-1.5 relative">
        <label className="text-xs font-semibold">Client *</label>
        <button
          type="button"
          onClick={() => setShowClientDropdown((v) => !v)}
          className="w-full h-10 rounded-lg border px-3 text-sm text-left flex items-center justify-between cursor-pointer"
        >
          <span className={selectedClient ? "" : "text-[hsl(var(--muted-foreground))]"}>
            {selectedClient?.name || (loadingClients ? "Loading clients…" : "Choose a client…")}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
        {showClientDropdown && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border bg-[hsl(var(--background))] shadow-lg p-2">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search client…"
                className="w-full h-8 pl-8 pr-3 rounded-md border text-xs"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto divide-y">
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-2 py-2 text-sm hover:bg-[hsl(var(--muted))]/30 cursor-pointer"
                  onClick={() => {
                    setClientId(c.id)
                    setDeliveryAddress(c.address || "")
                    setShowClientDropdown(false)
                    setClientSearch("")
                  }}
                >
                  <p className="font-medium">{c.name}</p>
                  {c.phone && (
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{c.phone}</p>
                  )}
                </button>
              ))}
              {filteredClients.length === 0 && (
                <p className="text-xs text-center py-4 text-[hsl(var(--muted-foreground))]">No clients found</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold">Items from branch stock</label>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowProducts((v) => !v)}>
            {showProducts ? "Hide products" : "Add from stock"}
          </Button>
        </div>
        {showProducts && (
          <div className="rounded-lg border p-3 space-y-2">
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search branch stock…"
              className="w-full h-9 rounded-md border px-3 text-sm"
            />
            <div className="max-h-40 overflow-y-auto divide-y">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="w-full text-left py-2 px-1 hover:bg-[hsl(var(--muted))]/20 cursor-pointer"
                >
                  <p className="text-sm font-medium">{p.description}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {p.availableQty} {p.unit} · {formatCurrency(p.costPrice)}
                  </p>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="text-xs text-center py-4 text-[hsl(var(--muted-foreground))]">No stock at this branch</p>
              )}
            </div>
          </div>
        )}
        {items.length > 0 && (
          <div className="rounded-lg border divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <div className="flex-1 min-w-[140px]">
                  <p className="font-medium line-clamp-2">{item.description}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    Max {item.availableQty} {item.unit}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updateItem(item.id, "qty", item.qty - 1)} className="p-1 border rounded cursor-pointer">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center tabular-nums">{item.qty}</span>
                  <button type="button" onClick={() => updateItem(item.id, "qty", item.qty + 1)} className="p-1 border rounded cursor-pointer">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value) || 0)}
                  className="w-24 h-8 rounded border px-2 text-sm"
                />
                <span className="font-semibold tabular-nums w-20 text-right">
                  {formatCurrency(item.qty * item.unitPrice)}
                </span>
                <button type="button" onClick={() => removeItem(item.id)} className="p-1 text-red-500 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Delivery address</label>
          <input
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            className="w-full h-9 rounded-md border px-3 text-sm"
          />
        </div>
        {kind === "order" && (
          <div className="space-y-1">
            <label className="text-xs font-medium">Delivery date</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full h-9 rounded-md border px-3 text-sm"
            />
          </div>
        )}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-9 rounded-md border px-3 text-sm"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <p className="text-sm font-semibold">Total: {formatCurrency(subtotal)}</p>
        <Button
          type="button"
          className="bg-[#1faca6] hover:bg-[#17857f] text-white"
          disabled={saving}
          onClick={() => void handleSubmit()}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save {kind === "order" ? "order" : "quotation"}
        </Button>
      </div>
    </div>
  )
}
