"use client"
import { useState, useEffect } from "react"
import { getOrders, saveOrder, deleteOrder, generateOrderNumber, type Order, type OrderItem, STATUS_LABELS, STATUS_COLORS } from "@/lib/orders"
import { getClients, type Client } from "@/lib/crm"
import { getInventoryItems, type InventoryItem } from "@/lib/purchase"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import { restoreInventoryForOrder } from "@/lib/inventory"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, Search, X, Trash2, ShoppingCart, FileText, Download, Eye, DollarSign, Edit, ArrowLeft, Save } from "lucide-react"
import { PaymentCapture } from "@/components/crm/payment-capture"
import { OrderFinalize } from "@/components/crm/order-finalize"

export function OrdersList({ currentUser }: { currentUser: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Order | null>(null)

  useEffect(() => {
    Promise.all([getOrders(), getClients()]).then(([o, c]) => {
      setOrders(o)
      setClients(c)
      setLoading(false)
    })
    const channel = supabase
      .channel("crm_orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "erp_orders" }, () => {
        getOrders().then(setOrders)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = orders.filter(o => {
    const matchesSearch = o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.clientName.toLowerCase().includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || o.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-7 pl-2 pr-6 rounded border bg-[hsl(var(--background))] text-[10px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] appearance-none cursor-pointer transition-colors"
          >
            <option value="all">All Status</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="finalized">Finalized</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <svg className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-[hsl(var(--muted-foreground))] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="relative w-48">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="w-full h-8 px-3 border-b-2 border-t-0 border-x-0 border-[hsl(var(--border))] bg-transparent text-xs focus:outline-none focus:border-[hsl(var(--primary))] transition-colors"
          />
        </div>
        <Button size="sm" className="h-8 text-xs px-3" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Order
        </Button>
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
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(order => (
                <tr key={order.id} onClick={() => setSelected(order)} className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer">
                  <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{order.orderNumber}</td>
                  <td className="px-4 py-2.5 text-xs font-medium">{order.clientName}</td>
                  <td className="px-4 py-2.5 text-xs text-center">{order.items.length}</td>
                  <td className="px-4 py-2.5 text-xs text-right font-semibold">PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{new Date(order.createdAt).toLocaleDateString()}</td>
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
    </div>
  )
}

function OrderForm({ currentUser, clients, onClose, onSave }: {
  currentUser: string
  clients: Client[]
  onClose: () => void
  onSave: (o: Order) => void
}) {
  const [clientId, setClientId] = useState("")
  const [items, setItems] = useState<OrderItem[]>([])
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [showInventory, setShowInventory] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)

  useEffect(() => {
    // Load inventory items
    getInventoryItems().then(setInventoryItems)
  }, [])

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
            alert(`Maximum available quantity is ${i.availableQty} ${i.unit}`)
            return i
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
      } else {
        alert(`Maximum available quantity is ${invItem.qty} ${invItem.unit}`)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-3.5 border-b shrink-0">
          <p className="text-sm font-semibold">Create New Order</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1 relative">
            <label className="text-[10px] font-medium">Select Client *</label>
            <button
              type="button"
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs text-left focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] flex items-center justify-between"
            >
              <span className={clientId ? "capitalize" : "text-[hsl(var(--muted-foreground))]"}>
                {clientId ? clients.find(c => c.id === clientId)?.name : "Choose a client..."}
              </span>
              <svg className="h-4 w-4 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showClientDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowClientDropdown(false)} />
                <div className="absolute z-20 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-[hsl(var(--background))] shadow-lg">
                  <div
                    onClick={() => {
                      setClientId("")
                      setShowClientDropdown(false)
                    }}
                    className="px-2.5 py-2 text-xs cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/30 text-[hsl(var(--muted-foreground))]"
                  >
                    Choose a client...
                  </div>
                  {clients.map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setClientId(c.id)
                        setShowClientDropdown(false)
                      }}
                      className="px-2.5 py-2 text-xs cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/30 border-t capitalize"
                    >
                      {c.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Order Items *</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] px-2.5" onClick={() => setShowInventory(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add from Inventory
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] px-2.5" onClick={addCustomItem}>
                  <Plus className="h-3 w-3 mr-1" /> Add Custom Product
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center bg-[hsl(var(--muted))]/10">
                <ShoppingCart className="h-8 w-8 text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-2" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No items added yet</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Add items from inventory or create custom products</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[hsl(var(--muted))]/40 border-b">
                      <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                      <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-24">Qty</th>
                      <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                      <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-32">Unit Price</th>
                      <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-28">Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="px-2 py-1.5">
                          <div>
                            <input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)}
                              disabled={!item.isCustom}
                              placeholder="Product description"
                              className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-60" />
                            {item.availableQty !== undefined && (
                              <p className="text-[10px] text-green-600 dark:text-green-400 font-medium mt-0.5 px-1">
                                Stock: {item.availableQty} {item.unit}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="1" max={item.availableQty} value={item.qty} onChange={e => updateItem(item.id, "qty", Number(e.target.value))}
                            className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)}
                            disabled={!item.isCustom}
                            className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-60" />
                        </td>
                        <td className="px-2 py-1.5">
                          <div>
                            <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, "unitPrice", Number(e.target.value))}
                              className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                            {item.costPrice !== undefined && (
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5 px-1">
                                Cost: PKR {item.costPrice.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium">PKR {(item.unitPrice * item.qty).toLocaleString()}</td>
                        <td className="px-1">
                          <button type="button" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] hover:text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[hsl(var(--muted))]/30 font-bold">
                      <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                      <td className="px-3 py-2 text-right">PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Delivery Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Delivery Address</label>
                <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Enter delivery address"
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium">Delivery Date</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Additional Information</p>
            <div className="space-y-1">
              <label className="text-[10px] font-medium">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Add any special instructions or notes"
                className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button size="sm" className="h-8 text-xs" onClick={submit} disabled={saving || !clientId || items.length === 0}>
            {saving ? "Creating..." : "Create Order"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
        </div>
      </div>

      {showInventory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowInventory(false)}>
          <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <p className="text-sm font-semibold">Select from Inventory</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowInventory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {inventoryItems.length === 0 ? (
                <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">No items in inventory</p>
              ) : (
                <div className="space-y-2">
                  {inventoryItems.map(item => (
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
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => addFromInventory(item)}>
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
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
      <div className="w-full max-w-4xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="h-7 w-7 rounded hover:bg-[hsl(var(--muted))] flex items-center justify-center transition-colors"
              title={isEditing ? "Back to view" : "Edit order"}
            >
              <ArrowLeft className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-[hsl(var(--primary))]">{order.orderNumber}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 capitalize">{order.clientName}</p>
            </div>
            {!isEditing && order.deliveryDate && (
              <div className="border-l pl-4">
                <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))]">Delivery date</p>
                <p className="text-xs mt-0.5">{new Date(order.deliveryDate).toLocaleDateString()}</p>
              </div>
            )}
            {!isEditing && (
              <div className="border-l pl-4">
                <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))]">Created</p>
                <p className="text-xs mt-0.5">{new Date(order.createdAt).toLocaleDateString()} by {order.createdBy}</p>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isEditing ? (
            <>
              {/* Edit Form */}
              <div className="space-y-3">
                <div className="border-b pb-3">
                  <label className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1 block">Notes</label>
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
              {order.notes && (
                <div className="border-b pb-3">
                  <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1">Notes</p>
                  <p className="text-xs whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}

          <div>
            <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5">Order items</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[hsl(var(--muted))]/40 border-b">
                    <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                    <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-14">Qty</th>
                    <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-14">Unit</th>
                    <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-24">Unit Price</th>
                    <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-2.5 py-1.5">{item.description}</td>
                      <td className="px-2.5 py-1.5 text-center">{item.qty}</td>
                      <td className="px-2.5 py-1.5">{item.unit}</td>
                      <td className="px-2.5 py-1.5 text-right">PKR {item.unitPrice.toLocaleString()}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium">PKR {(item.unitPrice * item.qty).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-1.5">
            {order.taxPercent > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-xs gap-20">
                  <span>Tax ({order.taxPercent}%)</span>
                  <span className="font-medium w-32 text-right">PKR {order.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-1.5" />
              </div>
            )}
            {order.transportCost > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-xs gap-20">
                  <span>Transport cost</span>
                  <span className="font-medium w-32 text-right">PKR {order.transportCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-1.5" />
              </div>
            )}
            {order.otherCost > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-xs gap-20">
                  <span>Other cost</span>
                  <span className="font-medium w-32 text-right">PKR {order.otherCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-1.5" />
              </div>
            )}
            {order.shipping > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-xs gap-20">
                  <span>Shipping</span>
                  <span className="font-medium w-32 text-right">PKR {order.shipping.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-1.5" />
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex flex-col items-end">
                <div className="flex items-center text-xs gap-20">
                  <span>Discount</span>
                  <span className="text-red-600 font-medium w-32 text-right">-PKR {order.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full h-px bg-[hsl(var(--border))]/30 mt-1.5" />
              </div>
            )}
            <div className="flex items-center text-sm font-bold gap-20 pt-1.5">
              <span>Total</span>
              <span className="w-32 text-right">PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {order.dispatcher && (
            <div className="border-t pt-3">
              <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1">Dispatcher</p>
              <p className="text-xs font-medium">{order.dispatcher}</p>
            </div>
          )}

          {order.deliveryAddress && (
            <div className="border-t pt-3">
              <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1">Delivery address</p>
              <p className="text-xs whitespace-pre-wrap">{order.deliveryAddress}</p>
            </div>
          )}

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

        <div className="flex items-center gap-2 px-5 py-3 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          {isEditing ? (
            <>
              <Button size="sm" className="h-7 text-xs bg-green-400 hover:bg-green-500 text-white" onClick={handleSaveEdit} disabled={saving}>
                <Save className="h-3 w-3 mr-1.5" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={cancelEdit}>Cancel</Button>
            </>
          ) : (
            <>
              {canFinalize && (
                <Button size="sm" className="h-7 text-xs bg-green-400 hover:bg-green-500 text-white" onClick={() => setShowFinalize(true)}>
                  <FileText className="h-3 w-3 mr-1.5" /> Finalize Order
                </Button>
              )}
              {hasInvoiceDetails && (
                <>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={viewInvoice} title="View Invoice">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={downloadInvoice} title="Download PDF">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" className="h-7 text-xs bg-blue-400 hover:bg-blue-500 text-white" onClick={() => setShowPayment(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Payment
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={onClose}>Close</Button>
              <Button size="sm" className="h-7 text-xs bg-red-400 hover:bg-red-500 text-white" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
                <Trash2 className="h-3 w-3 mr-1.5" /> {deleting ? "Deleting..." : "Delete"}
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
