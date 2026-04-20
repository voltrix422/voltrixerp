"use client"
import { useState, useEffect } from "react"
import { getOrders, saveOrder, deleteOrder, generateOrderNumber, type Order, type OrderItem, STATUS_LABELS, STATUS_COLORS } from "@/lib/orders"
import { getClients, type Client } from "@/lib/crm"
import { getInventoryItems, type InventoryItem } from "@/lib/purchase"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import { restoreInventoryForOrder } from "@/lib/inventory"
// DB access via /api/db routes (Prisma)
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { Plus, Search, X, Trash2, ShoppingCart, FileText, Download, Eye, DollarSign, Edit, ArrowLeft, Save } from "lucide-react"
import { PaymentCapture } from "@/components/crm/payment-capture"
import { OrderFinalize } from "@/components/crm/order-finalize"

export function OrdersList({ currentUser }: { currentUser: string }) {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Order | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<Order | null>(null)

  useEffect(() => {
    Promise.all([getOrders(), getClients()]).then(([o, c]) => {
      setOrders(o)
      setClients(c)
      setLoading(false)
    })
    const interval = setInterval(() => getOrders().then(setOrders), 30000)
    return () => clearInterval(interval)
  }, [])

  const filtered = orders.filter(o => {
    const matchesSearch = (o.orderNumber?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (o.clientName?.toLowerCase() || "").includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || o.status === statusFilter
    
    const matchesDateRange = (!fromDate || !toDate) || (
      o.createdAt && 
      new Date(o.createdAt) >= new Date(fromDate) && 
      new Date(o.createdAt) <= new Date(toDate)
    )
    
    return matchesSearch && matchesStatus && matchesDateRange
  })

  return (
    <div className="space-y-4">
      {/* Filter Panel */}
      {showFilters && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-[hsl(var(--card))]">
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="h-8 px-2.5 rounded border bg-[hsl(var(--background))] text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="h-8 px-2.5 rounded border bg-[hsl(var(--background))] text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
          <div className="relative flex-1">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders..."
              className="w-full h-8 px-3 rounded border bg-[hsl(var(--background))] text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => { setFromDate(""); setToDate(""); setSearch("") }}>
            Clear
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
              statusFilter === "all"
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            All
            {statusFilter === "all" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
            )}
          </button>
          <button
            onClick={() => setStatusFilter("pending_approval")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
              statusFilter === "pending_approval"
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Pending
            {statusFilter === "pending_approval" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
            )}
          </button>
          <button
            onClick={() => setStatusFilter("approved")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
              statusFilter === "approved"
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Approved
            {statusFilter === "approved" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
            )}
          </button>
          <button
            onClick={() => setStatusFilter("rejected")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
              statusFilter === "rejected"
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Rejected
            {statusFilter === "rejected" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
            )}
          </button>
          <button
            onClick={() => setStatusFilter("finalized")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
              statusFilter === "finalized"
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Finalized
            {statusFilter === "finalized" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
            )}
          </button>
          <button
            onClick={() => setStatusFilter("delivered")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
              statusFilter === "delivered"
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Delivered
            {statusFilter === "delivered" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? "Hide Filters" : "Filters"}
          </Button>
          <Button size="sm" className="h-8 text-xs px-3 cursor-pointer" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Order
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingCart className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {orders.length === 0 ? "No orders found" : "No orders found"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Order #</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
                <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Items</th>
                <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
                <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))] cursor-pointer" onClick={() => setSelected(order)}>{order.orderNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-medium cursor-pointer" onClick={() => setSelected(order)}>{order.clientName || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-center cursor-pointer" onClick={() => setSelected(order)}>{order.items?.length || 0}</td>
                  <td className="px-4 py-2.5 text-xs text-right font-semibold cursor-pointer" onClick={() => setSelected(order)}>PKR {(order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelected(order)}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[order.status] || order.status || "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer" onClick={() => setSelected(order)}>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirmOrder(order)
                      }}
                      className="text-red-500 hover:text-red-700 cursor-pointer transition-colors"
                      title="Delete order"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <OrderForm
          currentUser={currentUser}
          clients={clients}
          onClose={() => setShowForm(false)}
          onSave={o => {
            setOrders(prev => [o, ...prev.filter(x => x.id !== o.id)])
            setShowForm(false)
          }}
        />
      )}

      {selected && (
        <OrderDetail
          order={selected}
          currentUser={currentUser}
          onClose={() => setSelected(null)}
          onUpdate={o => {
            setOrders(prev => prev.map(x => x.id === o.id ? o : x))
            setSelected(o)
          }}
          onDelete={id => {
            setOrders(prev => prev.filter(x => x.id !== id))
            setSelected(null)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirmOrder}
        title="Delete Order"
        message={`Are you sure you want to delete order ${deleteConfirmOrder?.orderNumber}?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirmOrder) {
            deleteOrder(deleteConfirmOrder.id).then(() => {
              setOrders(prev => prev.filter(x => x.id !== deleteConfirmOrder.id))
            })
          }
          setDeleteConfirmOrder(null)
        }}
        onCancel={() => setDeleteConfirmOrder(null)}
      />
    </div>
  )
}

function OrderForm({ currentUser, clients, onClose, onSave }: {
  currentUser: string
  clients: Client[]
  onClose: () => void
  onSave: (o: Order) => void
}) {
  const { toast } = useToast()
  const [clientId, setClientId] = useState("")
  const [items, setItems] = useState<OrderItem[]>([])
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [showInventory, setShowInventory] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [inventorySearch, setInventorySearch] = useState("")
  const [quantityError, setQuantityError] = useState<string | null>(null)

  useEffect(() => {
    // Load inventory items
    getInventoryItems().then(setInventoryItems)
  }, [])

  useEffect(() => {
    if (quantityError) {
      const timer = setTimeout(() => {
        setQuantityError(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [quantityError])

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const total = subtotal

  function addCustomItem() {
    setItems(prev => [...prev, { id: Date.now().toString(), description: "", qty: 1, unit: "pcs", unitPrice: 0, isCustom: true }])
  }

  function updateItem(id: string, key: keyof OrderItem, value: any) {
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        // If updating quantity, validate against available stock
        if (key === "qty" && i.availableQty !== undefined) {
          const newQty = Number(value)
          if (newQty > i.availableQty) {
            setQuantityError(`Maximum available quantity is ${i.availableQty} ${i.unit}`)
            return i
          } else {
            setQuantityError(null)
          }
        }
        return { ...i, [key]: value }
      }
      return i
    }))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function addFromInventory(invItem: InventoryItem) {
    // Check if item already exists in the order
    const existingItem = items.find(i => i.inventoryItemId === invItem.id)
    
    if (existingItem) {
      // Item already added, just increase quantity by 1 (up to available stock)
      if (existingItem.qty < invItem.qty) {
        setItems(prev => prev.map(i => 
          i.id === existingItem.id 
            ? { ...i, qty: i.qty + 1 }
            : i
        ))
      }
    } else {
      // Add new item with cost price, user can edit to add profit
      setItems(prev => [...prev, {
        id: Date.now().toString(),
        description: invItem.description,
        qty: 1,
        unit: invItem.unit,
        unitPrice: invItem.unitPrice, // Start with cost price
        isCustom: false,
        inventoryItemId: invItem.id,
        availableQty: invItem.qty,
        costPrice: invItem.unitPrice, // Store cost price for reference
      }])
    }
    setShowInventory(false)
  }

  async function submit() {
    if (!clientId || items.length === 0) return
    setSaving(true)

    const client = clients.find(c => c.id === clientId)
    const orderNumber = await generateOrderNumber()

    const order: Order = {
      id: Date.now().toString(),
      orderNumber,
      clientId,
      clientName: client?.name || "",
      items,
      subtotal,
      taxPercent: 0,
      tax: 0,
      transportCost: 0,
      transportLabel: "Transport",
      otherCost: 0,
      otherCostLabel: "Other",
      shipping: 0,
      discount: 0,
      total,
      status: "pending_approval", // Send to admin for approval
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser,
      deliveryAddress: deliveryAddress.trim(),
      deliveryDate: deliveryDate || "",
      payments: [],
    }

    await saveOrder(order)
    onSave(order)
    setSaving(false)
  }

  return (
    <>
      {quantityError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">{quantityError}</p>
        </div>
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-5xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-8 py-5 border-b shrink-0">
            <p className="text-lg font-bold">Create New Order</p>
            <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="space-y-2 relative">
            <label className="text-sm font-semibold">Select Client *</label>
            <button
              type="button"
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] flex items-center justify-between cursor-pointer"
            >
              <span className={clientId ? "capitalize" : "text-[hsl(var(--muted-foreground))]"}>
                {clientId ? clients.find(c => c.id === clientId)?.name : "Choose a client..."}
              </span>
              <svg className="h-5 w-5 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showClientDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowClientDropdown(false)} />
                <div className="absolute z-20 w-full mt-1 max-h-80 overflow-auto rounded-md border bg-[hsl(var(--background))] shadow-lg">
                  <div className="p-3 border-b">
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Search client..."
                      className="w-full h-9 rounded border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                    />
                  </div>
                  <div
                    onClick={() => {
                      setClientId("")
                      setShowClientDropdown(false)
                    }}
                    className="px-3.5 py-2.5 text-sm cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/30 text-[hsl(var(--muted-foreground))]"
                  >
                    Choose a client...
                  </div>
                  {clients.filter(c => 
                    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                    (c.company && c.company.toLowerCase().includes(clientSearch.toLowerCase()))
                  ).map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setClientId(c.id)
                        setShowClientDropdown(false)
                        setClientSearch("")
                      }}
                      className="px-3.5 py-2.5 text-sm cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/30 border-t capitalize"
                    >
                      {c.name}
                      {c.company && <span className="text-[hsl(var(--muted-foreground))] ml-2 text-xs">({c.company})</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Order Items *</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="h-9 text-xs px-3 cursor-pointer" onClick={() => setShowInventory(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add from Inventory
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-9 text-xs px-3 cursor-pointer" onClick={addCustomItem}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Custom Product
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center bg-[hsl(var(--muted))]/10">
                <ShoppingCart className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-3" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No items added yet</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Add items from inventory or create custom products</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(var(--muted))]/40 border-b">
                      <th className="px-4 py-3 text-left font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                      <th className="px-4 py-3 text-center font-semibold text-[hsl(var(--muted-foreground))] w-28">Qty</th>
                      <th className="px-4 py-3 text-center font-semibold text-[hsl(var(--muted-foreground))] w-20">Unit</th>
                      <th className="px-4 py-3 text-right font-semibold text-[hsl(var(--muted-foreground))] w-36">Unit Price</th>
                      <th className="px-4 py-3 text-right font-semibold text-[hsl(var(--muted-foreground))] w-32">Total</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <div>
                            <input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)}
                              disabled={!item.isCustom}
                              placeholder="Product description"
                              className="w-full h-9 rounded border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:opacity-60" />
                            {item.availableQty !== undefined && (
                              <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1 px-1">
                                Stock: {item.availableQty} {item.unit}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="1" max={item.availableQty} value={item.qty} onChange={e => updateItem(item.id, "qty", Number(e.target.value))}
                            className="w-full h-9 rounded border bg-[hsl(var(--background))] px-3 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
                        </td>
                        <td className="px-3 py-2">
                          <input value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)}
                            disabled={!item.isCustom}
                            className="w-full h-9 rounded border bg-[hsl(var(--background))] px-3 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:opacity-60" />
                        </td>
                        <td className="px-3 py-2">
                          <div>
                            <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, "unitPrice", Number(e.target.value))}
                              className="w-full h-9 rounded border bg-[hsl(var(--background))] px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
                            {item.costPrice !== undefined && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 px-1">
                                Cost: PKR {item.costPrice.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">PKR {(item.unitPrice * item.qty).toLocaleString()}</td>
                        <td className="px-2">
                          <button type="button" onClick={() => removeItem(item.id)} className="cursor-pointer">
                            <Trash2 className="h-4 w-4 text-[hsl(var(--muted-foreground))] hover:text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[hsl(var(--muted))]/30 font-bold">
                      <td colSpan={4} className="px-4 py-3 text-right">Total</td>
                      <td className="px-4 py-3 text-right">PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Delivery Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Delivery Address</label>
                <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Enter delivery address"
                  className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Delivery Date</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Additional Information</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Add any special instructions or notes"
                className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-8 py-5 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button size="sm" className="h-10 text-sm px-6 cursor-pointer" onClick={submit} disabled={saving || !clientId || items.length === 0}>
            {saving ? "Creating..." : "Create Order"}
          </Button>
          <Button size="sm" variant="outline" className="h-10 text-sm px-6 cursor-pointer" onClick={onClose}>Cancel</Button>
        </div>
      </div>

      {showInventory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowInventory(false)}>
          <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <p className="text-sm font-semibold">Select from Inventory</p>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => setShowInventory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 border-b">
              <input
                type="text"
                value={inventorySearch}
                onChange={e => setInventorySearch(e.target.value)}
                placeholder="Search inventory..."
                className="w-full h-9 rounded border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {inventoryItems.length === 0 ? (
                <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">No items in inventory</p>
              ) : (() => {
                const filteredItems = inventoryItems.filter(item => 
                  item.description.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                  (item.supplier && item.supplier.toLowerCase().includes(inventorySearch.toLowerCase())) ||
                  (item.poNumber && item.poNumber.toLowerCase().includes(inventorySearch.toLowerCase()))
                )
                // Manual items: no poNumber or poNumber starts with "MI-"
                const manualItems = filteredItems.filter(item => !item.poNumber || item.poNumber?.startsWith("MI-"))
                // PO items: has poNumber and doesn't start with "MI-"
                const poItems = filteredItems.filter(item => item.poNumber && !item.poNumber.startsWith("MI-"))
                
                if (filteredItems.length === 0) {
                  return (
                    <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">No items found matching your search</p>
                  )
                }
                
                return (
                  <div className="space-y-6">
                    {poItems.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b pb-2">From Purchase Orders</p>
                        {poItems.map(item => (
                          <div key={item.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.description}</p>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                {item.poNumber} · {item.supplier}
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1">
                                Available: {item.qty} {item.unit} in stock
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">PKR {item.unitPrice.toLocaleString()}/{item.unit}</p>
                              <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => addFromInventory(item)}>
                                Add
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {manualItems.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b pb-2">From Manual Inventory</p>
                        {manualItems.map(item => (
                          <div key={item.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.description}</p>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                {item.poNumber || "Manual"} · {item.supplier}
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1">
                                Available: {item.qty} {item.unit} in stock
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">PKR {item.unitPrice.toLocaleString()}/{item.unit}</p>
                              <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => addFromInventory(item)}>
                                Add
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function OrderDetail({ order, onClose, onUpdate, onDelete, currentUser }: {
  order: Order
  onClose: () => void
  onUpdate: (o: Order) => void
  onDelete: (id: string) => void
  currentUser: string
}) {
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState(order.status)
  const [showFinalize, setShowFinalize] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Editable fields
  const [editDeliveryDate, setEditDeliveryDate] = useState(order.deliveryDate || "")
  const [editDeliveryAddress, setEditDeliveryAddress] = useState(order.deliveryAddress || "")
  const [editNotes, setEditNotes] = useState(order.notes || "")
  const [editTaxPercent, setEditTaxPercent] = useState(order.taxPercent || "")
  const [editTransportCost, setEditTransportCost] = useState(order.transportCost || "")
  const [editOtherCost, setEditOtherCost] = useState(order.otherCost || "")
  const [editDispatcher, setEditDispatcher] = useState(order.dispatcher || "")

  async function handleDelete() {
    setDeleting(true)
    
    // Restore inventory if order was delivered
    await restoreInventoryForOrder(order)
    
    await deleteOrder(order.id)
    onDelete(order.id)
    setShowDeleteConfirm(false)
  }

  async function handleSaveEdit() {
    setSaving(true)
    
    const subtotal = order.subtotal
    const tax = (subtotal * (Number(editTaxPercent) || 0)) / 100
    const total = subtotal + tax + (Number(editTransportCost) || 0) + (Number(editOtherCost) || 0)
    
    const updated: Order = {
      ...order,
      deliveryDate: editDeliveryDate || "",
      deliveryAddress: editDeliveryAddress,
      notes: editNotes,
      taxPercent: Number(editTaxPercent) || 0,
      tax,
      transportCost: Number(editTransportCost) || 0,
      transportLabel: "Transport cost",
      otherCost: Number(editOtherCost) || 0,
      otherCostLabel: "Other cost",
      dispatcher: editDispatcher,
      total,
    }
    
    await saveOrder(updated)
    onUpdate(updated)
    setIsEditing(false)
    setSaving(false)
  }

  function cancelEdit() {
    setEditDeliveryDate(order.deliveryDate || "")
    setEditDeliveryAddress(order.deliveryAddress || "")
    setEditNotes(order.notes || "")
    setEditTaxPercent(order.taxPercent || "")
    setEditTransportCost(order.transportCost || "")
    setEditOtherCost(order.otherCost || "")
    setEditDispatcher(order.dispatcher || "")
    setIsEditing(false)
  }

  async function updateStatus(newStatus: typeof status) {
    setStatus(newStatus)
    const updated = { ...order, status: newStatus }
    
    // Deduct inventory when order is delivered
    if (newStatus === "delivered" && status !== "delivered") {
      try {
        const { deductInventoryForOrder } = await import("@/lib/inventory")
        await deductInventoryForOrder(updated)
        console.log("Inventory deducted for delivered order:", updated.orderNumber)
      } catch (error) {
        console.error("Error deducting inventory:", error)
        // Don't fail the status update if inventory deduction fails
      }
    }
    
    await saveOrder(updated)
    onUpdate(updated)
  }

  // Show finalize option for approved orders that don't have invoice details yet
  const hasInvoiceDetails = order.taxPercent > 0 || order.transportCost > 0 || order.otherCost > 0 || order.dispatcher
  const canFinalize = order.status === "approved" && !hasInvoiceDetails

  async function downloadInvoice() {
    try {
      await downloadInvoicePDF(order)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  async function viewInvoice() {
    try {
      const blob = await import("@/lib/generate-invoice-pdf").then(m => m.generateInvoicePDF(order))
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  return (
    <>
      {showFinalize ? (
        <OrderFinalize
          order={order}
          currentUser={currentUser}
          onClose={() => setShowFinalize(false)}
          onUpdate={o => {
            onUpdate(o)
            setShowFinalize(false)
          }}
        />
      ) : showPayment ? (
        <PaymentCapture
          order={order}
          currentUser={currentUser}
          onClose={() => setShowPayment(false)}
          onUpdate={o => {
            onUpdate(o)
            setShowPayment(false)
          }}
        />
      ) : (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-6xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-8 py-5 border-b shrink-0">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="h-9 w-9 rounded hover:bg-[hsl(var(--muted))] flex items-center justify-center transition-colors cursor-pointer"
              title={isEditing ? "Back to view" : "Edit order"}
            >
              <ArrowLeft className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <p className="text-xl font-bold text-[hsl(var(--primary))]">{order.orderNumber}</p>
                <span className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 capitalize">{order.clientName}</p>
            </div>
            {!isEditing && order.deliveryDate && (
              <div className="border-l pl-6">
                <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">Delivery date</p>
                <p className="text-sm mt-1">{new Date(order.deliveryDate).toLocaleDateString()}</p>
              </div>
            )}
            {!isEditing && (
              <div className="border-l pl-6">
                <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">Created</p>
                <p className="text-sm mt-1">{new Date(order.createdAt).toLocaleDateString()} by {order.createdBy}</p>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {isEditing ? (
            <>
              {/* Edit Form */}
              <div className="space-y-4">
                <div className="border-b pb-4">
                  <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2 block">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
                    placeholder="Add notes..."
                  />
                </div>

                <div className="border-b pb-3">
                  <label className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1 block">Delivery date</label>
                  <input
                    type="date"
                    value={editDeliveryDate}
                    onChange={e => setEditDeliveryDate(e.target.value)}
                    className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>

                <div className="border-b pb-3">
                  <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-2">Costs</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium">Tax percentage (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={editTaxPercent}
                        onChange={e => setEditTaxPercent(e.target.value)}
                        className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                        placeholder="e.g., 18"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium">Transport cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editTransportCost}
                        onChange={e => setEditTransportCost(e.target.value)}
                        className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                        placeholder=""
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-medium">Other cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editOtherCost}
                        onChange={e => setEditOtherCost(e.target.value)}
                        className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>

                <div className="border-b pb-3">
                  <label className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1 block">Delivery address</label>
                  <textarea
                    value={editDeliveryAddress}
                    onChange={e => setEditDeliveryAddress(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
                    placeholder="Enter delivery address"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1 block">Dispatcher</label>
                  <input
                    type="text"
                    value={editDispatcher}
                    onChange={e => setEditDispatcher(e.target.value)}
                    className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    placeholder="Assign dispatcher"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* View Mode */}
              {order.dispatcher && (
                <div className="border-b pb-4">
                  <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Dispatcher</p>
                  <p className="text-sm font-medium">{order.dispatcher}</p>
                </div>
              )}

              {order.deliveryAddress && (
                <div className="border-b pb-4">
                  <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Delivery address</p>
                  <p className="text-sm whitespace-pre-wrap">{order.deliveryAddress}</p>
                </div>
              )}

              {order.notes && (
                <div className="border-b pb-4">
                  <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}

          <div>
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] mb-3">Order items</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[hsl(var(--muted))]/40 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] w-20">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] w-20">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[hsl(var(--muted-foreground))] w-32">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[hsl(var(--muted-foreground))] w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-center">{item.qty}</td>
                      <td className="px-4 py-3">{item.unit}</td>
                      <td className="px-4 py-3 text-right">PKR {item.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium">PKR {(item.unitPrice * item.qty).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-2">
            {order.taxPercent > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-sm gap-24">
                  <span>Tax ({order.taxPercent}%)</span>
                  <span className="font-medium w-40 text-right">PKR {order.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-2" />
              </div>
            )}
            {order.transportCost > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-sm gap-24">
                  <span>Transport cost</span>
                  <span className="font-medium w-40 text-right">PKR {order.transportCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-2" />
              </div>
            )}
            {order.otherCost > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-sm gap-24">
                  <span>Other cost</span>
                  <span className="font-medium w-40 text-right">PKR {order.otherCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-2" />
              </div>
            )}
            {order.shipping > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-sm gap-24">
                  <span>Shipping</span>
                  <span className="font-medium w-40 text-right">PKR {order.shipping.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-2" />
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-sm gap-24">
                  <span>Discount</span>
                  <span className="text-red-600 font-medium w-40 text-right">-PKR {order.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-2" />
              </div>
            )}
            <div className="flex items-center text-base font-bold gap-24 pt-2">
              <span>Total</span>
              <span className="w-40 text-right">PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {order.payments && order.payments.length > 0 && (
            <div className="rounded-lg border bg-green-50 dark:bg-green-950 p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-green-900 dark:text-green-100 mb-2">Payments Received</p>
              <div className="space-y-2">
                {order.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs border-b border-green-200 dark:border-green-800 pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">PKR {p.amount.toLocaleString()}</p>
                      <p className="text-green-700 dark:text-green-300">{p.method} · {new Date(p.date).toLocaleDateString()}</p>
                      {p.notes && <p className="text-green-600 dark:text-green-400 text-[10px] mt-0.5">{p.notes}</p>}
                    </div>
                    {p.proofUrl && (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-green-700 dark:text-green-300 underline text-[10px]">View Proof</a>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-green-200 dark:border-green-800">
                  <span className="text-green-900 dark:text-green-100">Total Paid</span>
                  <span className="text-green-900 dark:text-green-100">PKR {order.payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</span>
                </div>
                {order.payments.reduce((sum, p) => sum + p.amount, 0) < order.total && (
                  <div className="flex items-center justify-between text-xs font-bold text-orange-700 dark:text-orange-300">
                    <span>Remaining</span>
                    <span>PKR {(order.total - order.payments.reduce((sum, p) => sum + p.amount, 0)).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 px-8 py-5 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          {isEditing ? (
            <>
              <Button size="sm" className="h-10 text-sm bg-green-400 hover:bg-green-500 text-white cursor-pointer" onClick={handleSaveEdit} disabled={saving}>
                <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button size="sm" variant="outline" className="h-10 text-sm cursor-pointer" onClick={cancelEdit}>Cancel</Button>
            </>
          ) : (
            <>
              {order.status === "pending_approval" && (
                <>
                  <Button size="sm" className="h-10 text-sm bg-green-400 hover:bg-green-500 text-white cursor-pointer" onClick={() => updateStatus("approved")}>
                    Approve Order
                  </Button>
                  <Button size="sm" variant="outline" className="h-10 text-sm bg-red-400 hover:bg-red-500 text-white cursor-pointer" onClick={() => updateStatus("rejected")}>
                    Reject Order
                  </Button>
                </>
              )}
              {canFinalize && (
                <Button size="sm" className="h-10 text-sm bg-green-400 hover:bg-green-500 text-white cursor-pointer" onClick={() => setShowFinalize(true)}>
                  <FileText className="h-4 w-4 mr-2" /> Finalize Order
                </Button>
              )}
              {hasInvoiceDetails && (
                <>
                  <Button size="sm" variant="outline" className="h-10 w-10 p-0 cursor-pointer" onClick={viewInvoice} title="View Invoice">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-10 w-10 p-0 cursor-pointer" onClick={downloadInvoice} title="Download PDF">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="sm" className="h-10 text-sm bg-blue-400 hover:bg-blue-500 text-white cursor-pointer" onClick={() => setShowPayment(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Payment
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="h-10 text-sm ml-auto cursor-pointer" onClick={onClose}>Close</Button>
              <Button size="sm" className="h-10 text-sm bg-red-400 hover:bg-red-500 text-white cursor-pointer" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" /> {deleting ? "Deleting..." : "Delete"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
      )}
      
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Order"
        message={`Are you sure you want to delete this order? Order ${order.orderNumber} will be permanently removed and any inventory deductions will be restored.`}
        confirmText="Delete Order"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
