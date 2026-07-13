"use client"

import { useEffect, useState } from "react"
import { getClients, saveClient, type Client } from "@/lib/crm"
import {
  generateOrderNumber,
  saveOrder,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/lib/orders"
import {
  generateQuotationNumber,
  saveQuotation,
  type Quotation,
  type QuotationItem,
} from "@/lib/quotations"
import {
  applyCrmPriceTierToItems,
  buildCrmPriceMap,
  getCrmProductPrices,
  lookupCrmUnitPrice,
  type CrmPriceTier,
} from "@/lib/crm-product-prices"
import { CrmPriceTierSelect } from "@/components/crm/crm-price-tier-select"
import { CrmLineItemsEditor } from "@/components/crm/crm-line-items-editor"
import { BranchPosInventoryPicker } from "@/components/pos/branch-pos-inventory-picker"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import type { PosStockProduct } from "@/lib/pos"
import { branchPosClientTag, branchPosNotesTag, isBranchPosClient } from "@/lib/branch-pos"
import {
  DEFAULT_GST_PERCENT,
  calculateGstInclusiveTotals,
  splitGstInclusiveAmount,
} from "@/lib/gst-inclusive-pricing"
import { Loader2, Plus, ShoppingCart, UserPlus, X } from "lucide-react"

type DocKind = "order" | "quotation"
export function BranchPosSaleForm({
  kind,
  products,
  branchName,
  branchId,
  userName,
  onSaved,
  onCancel,
}: {
  kind: DocKind
  products: PosStockProduct[]
  branchName: string
  branchId: string
  userName: string
  onSaved?: () => void
  onCancel?: () => void
}) {
  const { toast } = useToast()
  const [priceMap, setPriceMap] = useState(() => new Map())
  const [priceTier, setPriceTier] = useState<CrmPriceTier>("retail")
  const [clientId, setClientId] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  const [clientResults, setClientResults] = useState<Client[]>([])
  const [searchingClients, setSearchingClients] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState("")
  const [quickPhone, setQuickPhone] = useState("")
  const [items, setItems] = useState<(OrderItem | QuotationItem)[]>([])
  const [notes, setNotes] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [markDelivered, setMarkDelivered] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [discountIsPercentage] = useState(true)
  const [showInventory, setShowInventory] = useState(false)
  const [inventorySearch, setInventorySearch] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getCrmProductPrices()
      .then((rows) => setPriceMap(buildCrmPriceMap(rows)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setItems((prev) => applyCrmPriceTierToItems(prev, priceTier, priceMap) as typeof prev)
  }, [priceTier, priceMap])

  useEffect(() => {
    const q = clientSearch.trim()
    if (q.length < 2) {
      setClientResults([])
      return
    }
    setSearchingClients(true)
    const timer = setTimeout(() => {
      void getClients()
        .then((all) =>
          setClientResults(
            all
              .filter((c) => c.status === "active")
              .filter((c) => isBranchPosClient(c, branchName))
              .filter(
                (c) =>
                  c.name.toLowerCase().includes(q.toLowerCase()) ||
                  c.phone.includes(q) ||
                  c.company.toLowerCase().includes(q.toLowerCase()),
              )
              .slice(0, 12),
          ),
        )
        .finally(() => setSearchingClients(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [clientSearch, branchName])

  const selectedClient = clientResults.find((c) => c.id === clientId) || null

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const taxPercent = DEFAULT_GST_PERCENT
  const subtotalGstBreakdown = splitGstInclusiveAmount(subtotal, taxPercent)
  const pricing = calculateGstInclusiveTotals({
    subtotalInclGst: subtotal,
    gstPercent: taxPercent,
    discount,
    discountIsPercentage,
  })
  const { total, discountOnBase: discountAmount, taxAmount } = pricing

  function addFromInventory(product: PosStockProduct) {
    const branchInventoryId = product.branchInventoryId || product.id
    const branchInventoryIds = product.branchInventoryIds?.length
      ? product.branchInventoryIds
      : [branchInventoryId]
    const invId = product.inventoryId || product.id
    const unitPrice = lookupCrmUnitPrice(priceMap, product.model, priceTier)
    const existing = items.find(
      (i) =>
        (i.branchInventoryId && i.branchInventoryId === branchInventoryId) ||
        i.inventoryItemId === invId,
    )
    if (existing) {
      if (existing.qty < product.availableQty) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === existing.id ? { ...i, qty: i.qty + 1 } : i,
          ),
        )
      }
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          description: product.description,
          qty: 1,
          unit: product.unit,
          unitPrice,
          isCustom: false,
          inventoryItemId: invId,
          branchInventoryId,
          branchInventoryIds,
          model: product.model,
          availableQty: product.availableQty,
        },
      ])
    }
    setShowInventory(false)
    setInventorySearch("")
  }

  function updateItem(id: string, key: keyof OrderItem, value: string | number) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        if (key === "qty" && i.availableQty !== undefined && Number(value) > i.availableQty) {
          toast({ type: "error", title: `Max ${i.availableQty} ${i.unit} at branch` })
          return i
        }
        return { ...i, [key]: value }
      }),
    )
  }

  async function handleQuickAddClient() {
    if (!quickName.trim()) return
    const client: Client = {
      id: Date.now().toString(),
      name: quickName.trim(),
      company: "",
      email: "",
      phone: quickPhone.trim(),
      address: "",
      city: "",
      country: "",
      website: "",
      taxId: "",
      ntn: "",
      industry: "",
      contactPerson: "",
      notes: branchPosClientTag(branchName),
      createdAt: new Date().toISOString(),
      createdBy: userName,
      status: "active",
    }
    await saveClient(client)
    setClientId(client.id)
    setClientResults([client])
    setClientSearch(client.name)
    setShowQuickAdd(false)
    setQuickName("")
    setQuickPhone("")
    toast({ type: "success", title: "Client added" })
  }

  async function handleSubmit() {
    if (!clientId) {
      toast({ type: "error", title: "Select or add a client" })
      return
    }
    if (items.length === 0) {
      toast({ type: "error", title: "Add items from branch stock" })
      return
    }
    setSaving(true)
    try {
      const client = clientResults.find((c) => c.id === clientId) || selectedClient
      const branchTag = branchPosNotesTag(branchName)
      const docNotes = notes.trim() ? `${notes.trim()} · ${branchTag}` : branchTag
      if (kind === "quotation") {
        const quotationNumber = await generateQuotationNumber()
        const q: Quotation = {
          id: Date.now().toString(),
          quotationNumber,
          clientId,
          clientName: client?.name || clientSearch,
          items: items as QuotationItem[],
          subtotal,
          taxPercent,
          tax: taxAmount,
          transportCost: 0,
          transportLabel: "Transport",
          otherCost: 0,
          otherCostLabel: "Other",
          discount,
          discountIsPercentage,
          discountValue: discountAmount,
          total,
          status: "draft",
          notes: docNotes,
          deliveryAddress: deliveryAddress.trim(),
          validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          createdBy: userName,
        }
        await saveQuotation(q)
        toast({ type: "success", title: `Quotation ${quotationNumber} created` })
      } else {
        const status: OrderStatus = markDelivered ? "delivered" : "confirmed"
        const order: Order = {
          id: Date.now().toString(),
          orderNumber: await generateOrderNumber(),
          clientId,
          clientName: client?.name || clientSearch,
          items: items as OrderItem[],
          subtotal,
          taxPercent,
          tax: taxAmount,
          transportCost: 0,
          transportLabel: "Transport",
          otherCost: 0,
          otherCostLabel: "Other",
          shipping: 0,
          discount,
          discountIsPercentage,
          discountValue: discountAmount,
          total,
          status,
          notes: docNotes,
          deliveryAddress: deliveryAddress.trim(),
          deliveryDate: deliveryDate || "",
          paymentTerms: "credit",
          creditApprovedAt: new Date().toISOString(),
          creditApprovedBy: userName,
          creditNote: "Branch POS — add payment from order details",
          createdAt: new Date().toISOString(),
          createdBy: userName,
          payments: [],
          branchId,
          source: "branch_pos",
        }
        await saveOrder(order)
        toast({
          type: "success",
          title: `Order ${order.orderNumber} created`,
          message: markDelivered
            ? "Delivered · branch stock updated · add payment anytime from order details"
            : "Branch stock updated · add payment from order details",
        })
      }
      onSaved?.()
    } catch (err) {
      toast({
        type: "error",
        title: `Could not save ${kind}`,
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const title = kind === "order" ? "New order" : "New quotation"

  return (
    <>
      <div className="rounded-xl border bg-[hsl(var(--card))] shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b bg-[hsl(var(--muted))]/10 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {branchName} — branch stock only · stays in POS (not ERP CRM)
            </p>
          </div>
          {onCancel && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-semibold">Client *</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setShowQuickAdd((v) => !v)}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Quick add client
              </Button>
            </div>
            {showQuickAdd && (
              <div className="rounded-lg border p-3 grid sm:grid-cols-2 gap-2 bg-[hsl(var(--muted))]/10">
                <input
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Client name *"
                  className="h-9 rounded-md border px-3 text-sm"
                />
                <input
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="Phone"
                  className="h-9 rounded-md border px-3 text-sm"
                />
                <Button type="button" size="sm" className="sm:col-span-2 bg-[#1faca6] hover:bg-[#17857f] text-white h-9" onClick={() => void handleQuickAddClient()}>
                  Save client
                </Button>
              </div>
            )}
            <input
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value)
                setClientId("")
              }}
              placeholder="Type name or phone to search (min 2 letters)…"
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
            />
            {clientId && selectedClient && (
              <p className="text-sm text-[#1faca6] font-medium">Selected: {selectedClient.name}</p>
            )}
            {clientSearch.trim().length >= 2 && !clientId && (
              <div className="rounded-md border max-h-40 overflow-y-auto divide-y">
                {searchingClients ? (
                  <p className="text-xs text-center py-3 text-[hsl(var(--muted-foreground))]">Searching…</p>
                ) : clientResults.length === 0 ? (
                  <p className="text-xs text-center py-3 text-[hsl(var(--muted-foreground))]">No branch POS clients found — use Quick add</p>
                ) : (
                  clientResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#1faca6]/5 cursor-pointer"
                      onClick={() => {
                        setClientId(c.id)
                        setClientSearch(c.name)
                        setDeliveryAddress(c.address || "")
                        setClientResults([c])
                      }}
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.phone && <span className="text-[hsl(var(--muted-foreground))] ml-2 text-xs">{c.phone}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Delivery address</label>
              <input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full h-10 rounded-md border px-3.5 text-sm"
              />
            </div>
            {kind === "order" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Delivery date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full h-10 rounded-md border px-3.5 text-sm"
                />
              </div>
            )}
          </div>

          <div className="pt-2 border-t space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Items *
              </p>
              <CrmPriceTierSelect value={priceTier} onChange={setPriceTier} className="sm:max-w-md" />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 bg-[#1faca6] hover:bg-[#17857f] text-white"
              onClick={() => setShowInventory(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add from branch stock
            </Button>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center bg-[hsl(var(--muted))]/10">
                <ShoppingCart className="h-10 w-10 text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-2" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No items yet</p>
              </div>
            ) : (
              <>
                <CrmLineItemsEditor
                  items={items}
                  onUpdate={updateItem}
                  onRemove={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
                  size="md"
                  removeIcon="trash"
                  gstPercent={taxPercent}
                />
                {subtotal > 0 && (
                  <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">Subtotal (excl. GST)</p>
                      <p className="font-semibold tabular-nums mt-1">PKR {subtotalGstBreakdown.base.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">GST ({taxPercent}%)</p>
                      <p className="font-semibold tabular-nums mt-1 text-[#1faca6]">PKR {subtotalGstBreakdown.gst.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">Subtotal (incl. GST)</p>
                      <p className="font-semibold tabular-nums mt-1">PKR {subtotalGstBreakdown.total.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {items.length > 0 && (
            <div className="pt-2 border-t space-y-2">
              <label className="text-sm font-medium">Discount (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="w-full sm:w-32 h-10 rounded-md border px-3 text-sm"
              />
            </div>
          )}

          {kind === "order" && items.length > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-2 border-t">
              <input
                type="checkbox"
                checked={markDelivered}
                onChange={(e) => setMarkDelivered(e.target.checked)}
                className="rounded border"
              />
              Mark as delivered now (payment can be added later from order details)
            </label>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-10 rounded-md border px-3.5 text-sm"
              placeholder="Optional"
            />
          </div>

          {items.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  <tr className="bg-[hsl(var(--muted))]/50 font-bold">
                    <td className="px-4 py-3 text-right">Total</td>
                    <td className="px-4 py-3 text-right w-40 tabular-nums">PKR {total.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-4 sm:px-6 py-4 border-t bg-[hsl(var(--muted))]/10">
          {onCancel && (
            <Button type="button" variant="outline" className="h-10" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            className="bg-[#1faca6] hover:bg-[#17857f] text-white h-10 px-6"
            disabled={saving || !clientId || items.length === 0}
            onClick={() => void handleSubmit()}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {kind === "order"
              ? markDelivered
                ? "Create & deliver"
                : "Create order"
              : "Create quotation"}
          </Button>
        </div>
      </div>

      <BranchPosInventoryPicker
        open={showInventory}
        products={products}
        priceMap={priceMap}
        priceTier={priceTier}
        search={inventorySearch}
        onSearchChange={setInventorySearch}
        onClose={() => setShowInventory(false)}
        onSelect={addFromInventory}
        branchName={branchName}
      />
    </>
  )
}
