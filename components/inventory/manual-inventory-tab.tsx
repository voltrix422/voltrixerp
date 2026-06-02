"use client"

import { useCallback, useEffect, useState, Fragment } from "react"
import {
  Plus,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Loader2,
  PackagePlus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const fieldClass =
  "w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
import { useToast } from "@/components/ui/toast"
import { getSession } from "@/lib/auth"
import {
  addManualInventoryQty,
  createManualInventoryItem,
  deleteManualInventoryItem,
  getManualInventoryItems,
  manualInventoryItemId,
  reserveManualInventoryQty,
  type ManualInventoryItem,
} from "@/lib/manual-inventory"
import { generateOrderNumber, saveOrder, type Order, type OrderItem } from "@/lib/orders"
import {
  parseSerialDispatchClient,
  parseSerialOrderRef,
  serialStatusLabel,
} from "@/lib/parse-serial-order-ref"

type Client = { id: string; name: string }

export function ManualInventoryTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<ManualInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState("")
  const [qty, setQty] = useState("")
  const [unit, setUnit] = useState("pcs")
  const [notes, setNotes] = useState("")
  const [serialText, setSerialText] = useState("")

  const [showOrder, setShowOrder] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState("")
  const [orderLines, setOrderLines] = useState<Record<string, string>>({})
  const [orderNotes, setOrderNotes] = useState("")
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [showAddQty, setShowAddQty] = useState(false)
  const [restockItem, setRestockItem] = useState<ManualInventoryItem | null>(null)
  const [restockQty, setRestockQty] = useState("")
  const [restockNotes, setRestockNotes] = useState("")
  const [restocking, setRestocking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getManualInventoryItems()
      setItems(data)
    } catch (e) {
      toast({
        title: "Could not load manual inventory",
        message: e instanceof Error ? e.message : "Unknown error",
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const q = Number(qty)
    if (!name.trim()) {
      toast({ title: "Name required", type: "error" })
      return
    }
    if (!Number.isFinite(q) || q <= 0) {
      toast({ title: "Enter a valid quantity", type: "error" })
      return
    }

    const serialNumbers = serialText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    setSaving(true)
    try {
      const user = getSession()?.name || "Inventory"
      await createManualInventoryItem({
        name: name.trim(),
        qty: q,
        unit: unit.trim() || "pcs",
        notes: notes.trim(),
        createdBy: user,
        serialNumbers: serialNumbers.length > 0 ? serialNumbers : undefined,
      })
      toast({ title: "Item added to manual inventory", type: "success" })
      setShowAdd(false)
      setName("")
      setQty("")
      setNotes("")
      setSerialText("")
      await load()
    } catch (err) {
      toast({
        title: "Failed to add item",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: ManualInventoryItem) {
    if (!confirm(`Delete "${item.name}" from manual inventory?`)) return
    try {
      await deleteManualInventoryItem(item.id)
      toast({ title: "Deleted", type: "success" })
      await load()
    } catch (err) {
      toast({
        title: "Delete failed",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    }
  }

  function openAddQty(item: ManualInventoryItem) {
    setRestockItem(item)
    setRestockQty("")
    setRestockNotes("")
    setShowAddQty(true)
  }

  async function handleAddQty(e: React.FormEvent) {
    e.preventDefault()
    if (!restockItem) return
    const q = Math.floor(Number(restockQty))
    if (!Number.isFinite(q) || q <= 0) {
      toast({ title: "Enter a valid quantity", type: "error" })
      return
    }
    setRestocking(true)
    try {
      const user = getSession()?.name || "Inventory"
      await addManualInventoryQty({
        manualId: restockItem.id,
        qty: q,
        addedBy: user,
        notes: restockNotes.trim() || undefined,
      })
      toast({ title: "Quantity added", type: "success" })
      setShowAddQty(false)
      setRestockItem(null)
      setRestockQty("")
      setRestockNotes("")
      await load()
    } catch (err) {
      toast({
        title: "Could not add quantity",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setRestocking(false)
    }
  }

  function openCreateOrder() {
    const initial: Record<string, string> = {}
    for (const item of items.filter((i) => i.availableQty > 0)) {
      initial[item.id] = "1"
    }
    setOrderLines(initial)
    setClientId("")
    setOrderNotes("Created from manual inventory")
    setShowOrder(true)
    void fetch("/api/db/clients")
      .then((r) => r.json())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]))
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) {
      toast({ title: "Select a client", type: "error" })
      return
    }

    const client = clients.find((c) => c.id === clientId)
    const lineItems: Array<{ manual: ManualInventoryItem; qty: number }> = []

    for (const item of items) {
      const raw = orderLines[item.id]
      if (!raw?.trim()) continue
      const q = Math.floor(Number(raw))
      if (!Number.isFinite(q) || q <= 0) continue
      if (q > item.availableQty) {
        toast({
          title: "Not enough stock",
          message: `"${item.name}" has only ${item.availableQty} available`,
          type: "error",
        })
        return
      }
      lineItems.push({ manual: item, qty: q })
    }

    if (lineItems.length === 0) {
      toast({ title: "Select at least one item with quantity", type: "error" })
      return
    }

    setCreatingOrder(true)
    try {
      const user = getSession()?.name || "Inventory"
      const orderItems: OrderItem[] = lineItems.map(({ manual, qty: lineQty }) => ({
        id: crypto.randomUUID(),
        description: manual.name,
        qty: lineQty,
        unit: manual.unit || "pcs",
        unitPrice: 0,
        isCustom: false,
        inventoryItemId: manualInventoryItemId(manual.id),
        model: manual.model,
        availableQty: manual.availableQty,
      }))

      await reserveManualInventoryQty(
        lineItems.map(({ manual, qty: lineQty }) => ({ manualId: manual.id, qty: lineQty })),
      )

      const order: Order = {
        id: crypto.randomUUID(),
        orderNumber: await generateOrderNumber(),
        clientId,
        clientName: client?.name || "",
        items: orderItems,
        subtotal: 0,
        taxPercent: 0,
        tax: 0,
        transportCost: 0,
        transportLabel: "",
        otherCost: 0,
        otherCostLabel: "",
        shipping: 0,
        discount: 0,
        total: 0,
        status: "pending_approval",
        notes: orderNotes.trim() || "Created from manual inventory",
        createdAt: new Date().toISOString(),
        createdBy: user,
        deliveryAddress: "",
        deliveryDate: "",
        payments: [],
      }

      await saveOrder(order)
      toast({
        title: "Order created",
        message: `${order.orderNumber} — approve in CRM/Finance, then fulfill from Client Orders with scan.`,
        type: "success",
      })
      setShowOrder(false)
      await load()
    } catch (err) {
      toast({
        title: "Order failed",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setCreatingOrder(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#1faca6]" />
            Manual added inventory
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
            Enter items and quantities by hand. Create client orders from this stock, then scan serial
            numbers when dispatching under Client Orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => setShowAdd(true)}
          >
            <PackagePlus className="h-4 w-4 mr-1.5" />
            Add item
          </Button>
          <Button
            className="cursor-pointer bg-[#1faca6] hover:bg-[#1a9a95] text-white"
            disabled={items.every((i) => i.availableQty <= 0)}
            onClick={openCreateOrder}
          >
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            Create order
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-[hsl(var(--muted-foreground))]">
          <PackagePlus className="h-10 w-10 mx-auto opacity-30 mb-3" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No manual items yet</p>
          <p className="text-xs mt-1">Add your first item with name and quantity.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[hsl(var(--muted))]/40 text-left text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <th className="px-4 py-3 font-semibold w-8" />
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold text-right">Total qty</th>
                <th className="px-4 py-3 font-semibold text-right">Available</th>
                <th className="px-4 py-3 font-semibold">Last added</th>
                <th className="px-4 py-3 font-semibold text-right">Serials</th>
                <th className="px-4 py-3 font-semibold w-28" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const serials = item.serialUnits ?? []
                const expanded = expandedItems[item.id] === true
                const hasSerials = serials.length > 0
                return (
                  <Fragment key={item.id}>
                    <tr className="hover:bg-[hsl(var(--muted))]/15">
                      <td className="px-4 py-3">
                        {hasSerials ? (
                          <button
                            type="button"
                            className="p-0.5 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/30 cursor-pointer"
                            onClick={() =>
                              setExpandedItems((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                            }
                            aria-expanded={expanded}
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.name}</p>
                        {item.notes && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{item.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums">{item.model}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.qty} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={item.availableQty > 0 ? "default" : "secondary"}>
                          {item.availableQty} {item.unit}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                        {new Date(item.lastAddedAt || item.createdAt).toLocaleDateString("en-PK")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-[hsl(var(--muted-foreground))]">
                        {serials.length > 0 ? (
                          <span>
                            {serials.filter((s) => s.status === "in_stock").length}/{serials.length} in stock
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#1faca6] cursor-pointer"
                            onClick={() => openAddQty(item)}
                            title="Add quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 cursor-pointer"
                            onClick={() => void handleDelete(item)}
                            title="Delete item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expanded && hasSerials && (
                      <tr className="bg-[hsl(var(--muted))]/10">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="rounded-lg border overflow-hidden bg-[hsl(var(--background))]">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b bg-[hsl(var(--muted))]/20 text-[hsl(var(--muted-foreground))]">
                                  <th className="px-3 py-2 text-left font-semibold">Serial number</th>
                                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                                  <th className="px-3 py-2 text-left font-semibold">Order</th>
                                  <th className="px-3 py-2 text-left font-semibold">Client</th>
                                  <th className="px-3 py-2 text-left font-semibold">Scanned</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {serials.map((unit) => {
                                  const orderRef = parseSerialOrderRef(unit.notes, unit.specs)
                                  const client = parseSerialDispatchClient(unit.notes)
                                  return (
                                    <tr key={unit.id}>
                                      <td className="px-3 py-2 font-mono font-semibold break-all">
                                        {unit.serialNumber}
                                      </td>
                                      <td className="px-3 py-2 capitalize">
                                        {serialStatusLabel(unit.status)}
                                      </td>
                                      <td className="px-3 py-2 font-mono">{orderRef ?? "—"}</td>
                                      <td className="px-3 py-2">{client ?? "—"}</td>
                                      <td className="px-3 py-2 tabular-nums text-[hsl(var(--muted-foreground))]">
                                        {new Date(unit.scannedAt).toLocaleDateString("en-PK")}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !saving && setShowAdd(false)}
        >
          <form
            className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleAdd(e)}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">Add manual inventory</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={() => setShowAdd(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Item name *</label>
              <input
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Battery 150Ah"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold">Quantity *</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={fieldClass}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold">Unit</label>
                <input className={fieldClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Notes</label>
              <input className={fieldClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Serial numbers (optional)</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                placeholder="One SN per line — or leave empty and scan at dispatch"
                value={serialText}
                onChange={(e) => setSerialText(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full cursor-pointer" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save item"}
            </Button>
          </form>
        </div>
      )}

      {showOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !creatingOrder && setShowOrder(false)}
        >
          <form
            className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleCreateOrder(e)}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">Create order from manual stock</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={() => setShowOrder(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Client *</label>
              <select
                className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                <option value="">Choose client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Order lines</label>
              <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                {items
                  .filter((i) => i.availableQty > 0)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm"
                    >
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                        max {item.availableQty}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={item.availableQty}
                        className="w-20 h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-sm text-right"
                        value={orderLines[item.id] ?? ""}
                        onChange={(e) =>
                          setOrderLines((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Notes</label>
              <input
                className={fieldClass}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Order goes to pending approval. After finance confirms, fulfill under Client Orders and
              use <strong>Scan to dispatch</strong> for serial numbers.
            </p>
            <Button type="submit" className="w-full cursor-pointer" disabled={creatingOrder}>
              {creatingOrder ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "Create order"
              )}
            </Button>
          </form>
        </div>
      )}

      {showAddQty && restockItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => !restocking && setShowAddQty(false)}
        >
          <form
            className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleAddQty(e)}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">Add quantity</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={() => setShowAddQty(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {restockItem.name} ({restockItem.model})
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Quantity to add *</label>
              <input
                type="number"
                min={1}
                step={1}
                className={fieldClass}
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Notes (optional)</label>
              <input
                className={fieldClass}
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                placeholder="e.g. New lot received"
              />
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Addition date is tracked automatically.
            </p>
            <Button type="submit" className="w-full cursor-pointer" disabled={restocking}>
              {restocking ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Add quantity"}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
