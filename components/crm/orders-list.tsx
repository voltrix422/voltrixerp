"use client"
import { useState, useEffect } from "react"
import { getOrders, saveOrder, deleteOrder, generateOrderNumber, getOrderPaymentProofUrls, getPaymentSubmissionStatus, getSubmittedPayments, canCapturePaymentsForOrder, type Order, type OrderItem, STATUS_LABELS, STATUS_COLORS } from "@/lib/orders"
import { getClients, type Client } from "@/lib/crm"
import { matchesOwnerRecord, resolveOwnerUserId, initialOrderStatus, type CrmWorkspaceScope } from "@/lib/crm-workspace"
import { OrderSourceBadge } from "@/components/crm/order-source-badge"
import { CrmWarehouseInventoryPicker } from "@/components/crm/crm-warehouse-inventory-picker"
import { CrmLineItemsEditor } from "@/components/crm/crm-line-items-editor"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { CrmItemsQtyCell } from "@/components/crm/crm-items-qty-cell"
import { CrmOrdersListCards } from "@/components/crm/crm-orders-list-cards"
import { CrmOrderSummaryDisplay } from "@/components/crm/crm-order-summary-display"
import { loadCrmWarehouseProducts, type CrmWarehouseProduct } from "@/lib/warehouse-inventory-picker"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import { restoreInventoryForOrder } from "@/lib/inventory"
import { useAuth } from "@/components/auth-provider"
// DB access via /api/db routes (Prisma)
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { Plus, Search, X, Trash2, ShoppingCart, FileText, Download, Eye, DollarSign, Edit, Loader2 } from "lucide-react"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { downloadOrdersExcel } from "@/lib/crm-excel-export"
import { PaymentCapture } from "@/components/crm/payment-capture"
import { OrderFinalize } from "@/components/crm/order-finalize"
import { InvoicePreviewModal } from "@/components/crm/invoice-preview-modal"

export function OrdersList({ currentUser, currentUserId, workspace }: { currentUser: string; currentUserId?: string; workspace?: CrmWorkspaceScope }) {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Order | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<Order | null>(null)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [pdfDownloadingId, setPdfDownloadingId] = useState<string | null>(null)

  async function handleListDownloadPdf(order: Order, e?: { stopPropagation: () => void }) {
    e?.stopPropagation()
    if (pdfDownloadingId) return
    setPdfDownloadingId(order.id)
    try {
      await downloadInvoicePDF(order)
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({ title: "Error", message: "Failed to generate PDF. Please try again.", type: "error" })
    } finally {
      setPdfDownloadingId(null)
    }
  }

  useEffect(() => {
    Promise.all([getOrders(), getClients()]).then(([o, c]) => {
      const scopedOrders = workspace?.ownerUserId
        ? o.filter(order => matchesOwnerRecord(order.ownerUserId, workspace.ownerUserId))
        : o
      const scopedClients = workspace?.ownerUserId
        ? c.filter(client => matchesOwnerRecord(client.ownerUserId, workspace.ownerUserId))
        : c
      setOrders(scopedOrders)
      setClients(scopedClients)
      setLoading(false)
    })
    const interval = setInterval(() => {
      getOrders().then(o => {
        const scopedOrders = workspace?.ownerUserId
          ? o.filter(order => matchesOwnerRecord(order.ownerUserId, workspace.ownerUserId))
          : o
        setOrders(scopedOrders)
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const filtered = orders.filter(o => {
    const matchesSearch = (o.orderNumber?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (o.clientName?.toLowerCase() || "").includes(search.toLowerCase())
    
    const matchesDateRange = (!fromDate || !toDate) || (
      o.createdAt && 
      new Date(o.createdAt) >= new Date(fromDate) && 
      new Date(o.createdAt) <= new Date(toDate)
    )
    
    return matchesSearch && matchesDateRange
  })

  function exportListExcel() {
    setExportingExcel(true)
    try {
      downloadOrdersExcel(filtered, currentUser)
      toast({
        title: "Download started",
        message: `${filtered.length} order(s) exported for Excel.`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not export orders.", type: "error" })
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter Panel */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border bg-[hsl(var(--card))]">
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <CrmExcelExportButton
            onExport={exportListExcel}
            exporting={exportingExcel}
            disabled={loading || filtered.length === 0}
          />
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? "Hide Filters" : "Filters"}
          </Button>
          {!workspace?.readOnly && (
          <Button size="sm" className="h-9 sm:h-8 w-full sm:w-auto text-xs px-3 cursor-pointer bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Order
          </Button>
          )}
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
        <>
          <CrmOrdersListCards
            orders={filtered}
            onSelect={setSelected}
            onDownloadPdf={(order, e) => void handleListDownloadPdf(order, e)}
            onDelete={setDeleteConfirmOrder}
            pdfDownloadingId={pdfDownloadingId}
          />
          <div className="hidden md:block rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Order #</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Source</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
                <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Qty</th>
                <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
                <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))] cursor-pointer" onClick={() => setSelected(order)}>
                    <span>{order.orderNumber || "—"}</span>
                  </td>
                  <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelected(order)}>
                    <OrderSourceBadge order={order} />
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium cursor-pointer" onClick={() => setSelected(order)}>
                    <div className="flex items-center gap-1">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      <span className="ml-2">{order.clientName || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-center cursor-pointer" onClick={() => setSelected(order)}>
                    <CrmItemsQtyCell items={order.items} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-right font-semibold cursor-pointer" onClick={() => setSelected(order)}>PKR {(order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelected(order)}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[order.status] || order.status || "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer" onClick={() => setSelected(order)}>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => void handleListDownloadPdf(order, e)}
                        disabled={pdfDownloadingId === order.id}
                        className="text-[#1a9f9a] hover:text-[#158a85] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download PDF"
                      >
                        {pdfDownloadingId === order.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                      </button>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {showForm && (
        <OrderForm
          currentUser={currentUser}
          currentUserId={currentUserId}
          workspace={workspace}
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
          clients={clients}
          workspace={workspace}
          currentUser={currentUser}
          currentUserId={currentUserId}
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

export function OrderForm({ currentUser, currentUserId, workspace, clients, existing, onClose, onSave }: {
  currentUser: string
  currentUserId?: string
  workspace?: CrmWorkspaceScope
  clients: Client[]
  existing?: Order
  onClose: () => void
  onSave: (o: Order) => void
}) {
  const { toast } = useToast()
  const isEdit = !!existing
  const [clientId, setClientId] = useState(existing?.clientId ?? "")
  const [items, setItems] = useState<OrderItem[]>(existing?.items ?? [])
  const [deliveryAddress, setDeliveryAddress] = useState(existing?.deliveryAddress ?? "")
  const [deliveryDate, setDeliveryDate] = useState(existing?.deliveryDate ?? "")
  const [notes, setNotes] = useState(existing?.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [warehouseProducts, setWarehouseProducts] = useState<CrmWarehouseProduct[]>([])
  const [showInventory, setShowInventory] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [inventorySearch, setInventorySearch] = useState("")
  const [quantityError, setQuantityError] = useState<string | null>(null)
  
  // Tax and expenses state
  const [taxPercent, setTaxPercent] = useState<number>(existing?.taxPercent ?? 0)
  const [transportCost, setTransportCost] = useState<number>(existing?.transportCost ?? 0)
  const [transportLabel, setTransportLabel] = useState<string>(existing?.transportLabel ?? "Transport")
  const [transportIsPercentage, setTransportIsPercentage] = useState<boolean>(existing?.transportIsPercentage ?? false)
  const [otherCost, setOtherCost] = useState<number>(existing?.otherCost ?? 0)
  const [otherCostLabel, setOtherCostLabel] = useState<string>(existing?.otherCostLabel ?? "Other")
  const [otherCostIsPercentage, setOtherCostIsPercentage] = useState<boolean>(existing?.otherCostIsPercentage ?? false)
  const [discount, setDiscount] = useState<number>(existing?.discount ?? 0)
  const [discountIsPercentage, setDiscountIsPercentage] = useState<boolean>(existing?.discountIsPercentage ?? true)

  useEffect(() => {
    void loadCrmWarehouseProducts().then((products) => {
      setWarehouseProducts(products)
      if (existing?.items?.length) {
        setItems(
          existing.items.map((item) => {
            const product = products.find((p) => p.id === item.inventoryItemId)
            return product ? { ...item, availableQty: product.qty } : item
          }),
        )
      }
    })
  }, [existing?.id])

  useEffect(() => {
    if (quantityError) {
      const timer = setTimeout(() => {
        setQuantityError(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [quantityError])

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  
  // Calculate discount first
  const discountAmount = discountIsPercentage
    ? subtotal * (discount / 100)
    : discount
  
  // Apply discount to get discounted subtotal
  const discountedSubtotal = subtotal - discountAmount
  
  // Calculate tax on discounted subtotal (after discount)
  const taxAmount = discountedSubtotal * (taxPercent / 100)
  
  // Calculate transport cost on discounted subtotal
  const transportAmount = transportIsPercentage 
    ? discountedSubtotal * (transportCost / 100) 
    : transportCost
  
  // Calculate other cost on discounted subtotal
  const otherAmount = otherCostIsPercentage 
    ? discountedSubtotal * (otherCost / 100) 
    : otherCost
  
  // Total calculation
  const total = discountedSubtotal + taxAmount + transportAmount + otherAmount

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

  function addFromInventory(product: CrmWarehouseProduct) {
    const existingItem = items.find((i) => i.inventoryItemId === product.id)

    if (existingItem) {
      if (existingItem.qty < product.qty) {
        setItems((prev) =>
          prev.map((i) => (i.id === existingItem.id ? { ...i, qty: i.qty + 1 } : i)),
        )
      }
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          description: product.displayName,
          qty: 1,
          unit: product.unit,
          unitPrice: 0,
          isCustom: false,
          inventoryItemId: product.id,
          availableQty: product.qty,
          costPrice: 0,
        },
      ])
    }
    setShowInventory(false)
    setInventorySearch("")
  }

  async function submit() {
    if (!clientId || items.length === 0) return
    setSaving(true)

    const client = clients.find(c => c.id === clientId)

    const order: Order = isEdit
      ? {
          ...existing!,
          clientId,
          clientName: client?.name || existing!.clientName,
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
          shipping: existing!.shipping ?? 0,
          discount,
          discountIsPercentage,
          discountValue: discountAmount,
          total,
          notes: notes.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryDate: deliveryDate || "",
        }
      : {
          id: Date.now().toString(),
          orderNumber: await generateOrderNumber(),
          clientId,
          clientName: client?.name || "",
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
          shipping: 0,
          discount,
          discountIsPercentage,
          discountValue: discountAmount,
          total,
          status: initialOrderStatus(workspace),
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
          createdBy: currentUser,
          ownerUserId: resolveOwnerUserId(workspace?.ownerUserId, currentUserId),
          deliveryAddress: deliveryAddress.trim(),
          deliveryDate: deliveryDate || "",
          payments: [],
        }

    await saveOrder(order)
    toast({
      title: isEdit ? "Order updated" : "Order submitted",
      message: isEdit
        ? "Changes saved. Order is still pending admin approval."
        : "This order was sent to the dashboard for admin approval.",
      type: "success",
    })
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
      <div className={`fixed inset-0 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 ${isEdit ? "z-[60]" : "z-50"}`} onClick={onClose}>
        <div className="w-full sm:max-w-5xl rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[85vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-5 border-b shrink-0">
            <p className="text-lg font-bold">{isEdit ? `Edit ${existing?.orderNumber}` : "Create New Order"}</p>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-8 space-y-5 sm:space-y-6">
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

          {/* Delivery Information */}
          <div className="pt-4 border-t">
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Delivery Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Additional Information */}
          <div className="pt-4 border-t">
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Additional Information</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Add any special instructions or notes"
                className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Order Items *</p>
              <Button type="button" size="sm" className="h-9 w-full sm:w-auto text-xs px-3 cursor-pointer bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={() => setShowInventory(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add from inventory
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center bg-[hsl(var(--muted))]/10">
                <ShoppingCart className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-3" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No items added yet</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Add items from warehouse inventory</p>
              </div>
            ) : (
              <CrmLineItemsEditor
                items={items}
                onUpdate={(id, key, value) => updateItem(id, key, value)}
                onRemove={removeItem}
                size="md"
                removeIcon="trash"
              />
            )}
          </div>

          {items.length > 0 && (
            <>
              {/* Discount */}
              <div className="pt-4 border-t">
                <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Discount</p>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-4 space-y-2">
                    <label className="text-sm font-medium">Discount Percentage</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="0" 
                        max="100"
                        value={discountIsPercentage ? discount : subtotal > 0 ? (discountAmount / subtotal * 100).toFixed(2) : 0}
                        onChange={e => {
                          const value = Number(e.target.value)
                          if (discountIsPercentage) {
                            setDiscount(value)
                          } else {
                            setDiscount(value)
                            setDiscountIsPercentage(true)
                          }
                        }}
                        placeholder="10"
                        className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" 
                      />
                    </div>
                  </div>
                  <div className="col-span-4 space-y-2">
                    <label className="text-sm font-medium">Discount Amount (PKR)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="0" 
                        value={discountIsPercentage ? discountAmount : discount}
                        onChange={e => {
                          const value = Number(e.target.value)
                          if (!discountIsPercentage) {
                            setDiscount(value)
                          } else {
                            setDiscount(value)
                            setDiscountIsPercentage(false)
                            setDiscount(value)
                          }
                        }}
                        placeholder="1000"
                        className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" 
                      />
                    </div>
                  </div>
                  <div className="col-span-4 space-y-2">
                    <label className="text-sm font-medium">Calculated Discount</label>
                    <div className="h-10 flex items-center px-4 rounded-md border bg-[hsl(var(--muted))]/30 text-sm font-medium text-green-600">
                      - PKR {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tax and Expenses */}
              <div className="pt-4 border-t">
                <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Tax & Expenses</p>
                
                {/* Tax */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tax Percentage</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="0" 
                        max="100" 
                        value={taxPercent} 
                        onChange={e => setTaxPercent(Number(e.target.value))}
                        placeholder="18"
                        className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" 
                      />
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">%</span>
                    </div>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Tax is applied on <span className="font-semibold">subtotal after discount</span>.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tax Amount</label>
                    <div className="h-10 flex items-center px-3.5 rounded-md border bg-[hsl(var(--muted))]/30 text-sm font-medium">
                      PKR {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Transport Cost */}
                <div className="grid grid-cols-12 gap-4 mb-4">
                  <div className="col-span-4 space-y-2">
                    <label className="text-sm font-medium">Expense Label</label>
                    <input 
                      value={transportLabel} 
                      onChange={e => setTransportLabel(e.target.value)}
                      placeholder="Transport"
                      className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" 
                    />
                  </div>
                  <div className="col-span-4 space-y-2">
                    <label className="text-sm font-medium">Amount</label>
                    <input 
                      type="number" 
                      min="0" 
                      step={transportIsPercentage ? "0.01" : "1"}
                      value={transportCost} 
                      onChange={e => setTransportCost(Number(e.target.value))}
                      placeholder={transportIsPercentage ? "18" : "1000"}
                      className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" 
                    />
                  </div>
                  <div className="col-span-4 space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <div className="flex items-center gap-3 h-10">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={transportIsPercentage}
                          onChange={e => setTransportIsPercentage(e.target.checked)}
                          className="w-4 h-4 rounded border"
                        />
                        <span className="text-sm">Percentage (%)</span>
                      </label>
                    </div>
                  </div>
                </div>
                {transportCost > 0 && (
                  <div className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
                    {transportLabel}: PKR {transportAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    {transportIsPercentage && ` (${transportCost}% of subtotal)`}
                  </div>
                )}

                {/* Other Cost */}
                <div className="grid grid-cols-12 gap-4 mb-4">
                  <div className="col-span-4 space-y-2">
                    <label className="text-sm font-medium">Expense Label</label>
                    <input 
                      value={otherCostLabel} 
                      onChange={e => setOtherCostLabel(e.target.value)}
                      placeholder="Other"
                      className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" 
                    />
                  </div>
                  <div className="col-span-4 space-y-2">
                    <label className="text-sm font-medium">Amount</label>
                    <input 
                      type="number" 
                      min="0" 
                      step={otherCostIsPercentage ? "0.01" : "1"}
                      value={otherCost} 
                      onChange={e => setOtherCost(Number(e.target.value))}
                      placeholder={otherCostIsPercentage ? "5" : "500"}
                      className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" 
                    />
                  </div>
                  <div className="col-span-4 space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <div className="flex items-center gap-3 h-10">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={otherCostIsPercentage}
                          onChange={e => setOtherCostIsPercentage(e.target.checked)}
                          className="w-4 h-4 rounded border"
                        />
                        <span className="text-sm">Percentage (%)</span>
                      </label>
                    </div>
                  </div>
                </div>
                {otherCost > 0 && (
                  <div className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">
                    {otherCostLabel}: PKR {otherAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    {otherCostIsPercentage && ` (${otherCost}% of subtotal)`}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Order Summary */}
          <div className="pt-4 border-t">
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Order Summary</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  <tr className="bg-[hsl(var(--muted))]/30">
                    <td className="px-4 py-3 text-right font-medium">Subtotal</td>
                    <td className="px-4 py-3 text-right font-medium w-48">PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  {discountAmount > 0 && (
                    <tr className="bg-[hsl(var(--muted))]/30">
                      <td className="px-4 py-3 text-right font-medium text-green-600">Discount{discountIsPercentage && ` (${discount}%)`}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">- PKR {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {discountAmount > 0 && (
                    <tr className="bg-[hsl(var(--muted))]/20">
                      <td className="px-4 py-3 text-right font-medium">Subtotal After Discount</td>
                      <td className="px-4 py-3 text-right font-medium">PKR {discountedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {taxAmount > 0 && (
                    <tr className="bg-[hsl(var(--muted))]/30">
                      <td className="px-4 py-3 text-right font-medium">Tax ({taxPercent}%)</td>
                      <td className="px-4 py-3 text-right font-medium">PKR {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {transportAmount > 0 && (
                    <tr className="bg-[hsl(var(--muted))]/30">
                      <td className="px-4 py-3 text-right font-medium">{transportLabel}{transportIsPercentage && ` (${transportCost}%)`}</td>
                      <td className="px-4 py-3 text-right font-medium">PKR {transportAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {otherAmount > 0 && (
                    <tr className="bg-[hsl(var(--muted))]/30">
                      <td className="px-4 py-3 text-right font-medium">{otherCostLabel}{otherCostIsPercentage && ` (${otherCost}%)`}</td>
                      <td className="px-4 py-3 text-right font-medium">PKR {otherAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  <tr className="bg-[hsl(var(--muted))]/50 font-bold border-t">
                    <td className="px-4 py-4 text-right text-base">Total</td>
                    <td className="px-4 py-4 text-right text-base">PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 px-4 sm:px-8 py-3 sm:py-5 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button size="sm" variant="outline" className="h-10 text-sm px-6 cursor-pointer w-full sm:w-auto" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="h-10 text-sm px-6 cursor-pointer w-full sm:w-auto bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={submit} disabled={saving || !clientId || items.length === 0}>
            {saving ? "Saving..." : isEdit ? "Save changes" : workspace?.mode === "sales_agent" ? "Submit for approval" : "Create Order"}
          </Button>
        </div>
      </div>
      </div>

      <CrmWarehouseInventoryPicker
        open={showInventory}
        products={warehouseProducts}
        search={inventorySearch}
        onSearchChange={setInventorySearch}
        onClose={() => setShowInventory(false)}
        onSelect={addFromInventory}
      />
    </>
  )
}


function OrderDetail({
  order,
  clients,
  workspace,
  currentUser,
  currentUserId,
  onClose,
  onUpdate,
  onDelete,
}: {
  order: Order
  clients: Client[]
  workspace?: CrmWorkspaceScope
  currentUser: string
  currentUserId?: string
  onClose: () => void
  onUpdate: (o: Order) => void
  onDelete: (id: string) => void
}) {
  const { user } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState(order.status)
  const [showFinalize, setShowFinalize] = useState(false)
  const [showInvoicePreview, setShowInvoicePreview] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [detailOrder, setDetailOrder] = useState(order)
  const [invoiceLoading, setInvoiceLoading] = useState<null | "view" | "download">(null)

  useEffect(() => {
    setDetailOrder(order)
    setStatus(order.status)
  }, [order])

  const isAdmin = user?.role === "superadmin"
  const canEditOrder = detailOrder.status === "pending_approval"

  async function handleDelete() {
    setDeleting(true)
    await restoreInventoryForOrder(order)
    await deleteOrder(order.id)
    onDelete(order.id)
    setShowDeleteConfirm(false)
  }

  async function updateStatus(newStatus: typeof status) {
    setStatus(newStatus)
    const updated = { ...detailOrder, status: newStatus }

    if (newStatus === "delivered" && status !== "delivered") {
      try {
        const { deductInventoryForOrder } = await import("@/lib/inventory")
        await deductInventoryForOrder(updated)
      } catch (error) {
        console.error("Error deducting inventory:", error)
      }
    }

    let toSave = updated
    if (newStatus === "delivered") {
      const { applySalesCommissionOnDelivery } = await import("@/lib/sales-commission")
      toSave = await applySalesCommissionOnDelivery(updated)
    }

    await saveOrder(toSave)
    setDetailOrder(toSave)
    onUpdate(toSave)
  }

  const hasInvoiceDetails = Math.abs(Number(detailOrder.tax || 0)) > 0.004 || detailOrder.transportCost > 0 || detailOrder.otherCost > 0 || detailOrder.dispatcher
  const canFinalize = detailOrder.status === "approved" && !hasInvoiceDetails
  const canManagePayments = canCapturePaymentsForOrder(detailOrder) &&
    !["confirmed", "processing", "shipped", "delivered", "cancelled", "rejected", "draft", "pending_approval"].includes(detailOrder.status)

  async function downloadInvoice() {
    if (invoiceLoading) return
    setInvoiceLoading("download")
    try {
      await downloadInvoicePDF(detailOrder)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setInvoiceLoading(null)
    }
  }

  function viewInvoice() {
    if (invoiceLoading) return
    setShowInvoicePreview(true)
  }

  return (
    <>
      {showEdit && canEditOrder && (
        <OrderForm
          existing={detailOrder}
          clients={clients}
          workspace={workspace}
          currentUser={currentUser}
          currentUserId={currentUserId}
          onClose={() => setShowEdit(false)}
          onSave={(o) => {
            setDetailOrder(o)
            onUpdate(o)
            setShowEdit(false)
          }}
        />
      )}
      {showFinalize ? (
        <OrderFinalize
          order={detailOrder}
          currentUser={currentUser}
          onClose={() => setShowFinalize(false)}
          onUpdate={o => {
            setDetailOrder(o)
            onUpdate(o)
            setShowFinalize(false)
          }}
        />
      ) : showPayment ? (
        <PaymentCapture
          order={detailOrder}
          currentUser={currentUser}
          onClose={() => setShowPayment(false)}
          onUpdate={o => {
            setDetailOrder(o)
            setStatus(o.status)
            onUpdate(o)
          }}
        />
      ) : (
    <>
    {showInvoicePreview && (
      <InvoicePreviewModal order={detailOrder} onClose={() => setShowInvoicePreview(false)} />
    )}
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-6xl rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 px-4 sm:px-8 py-3 sm:py-5 border-b shrink-0">
          <div className="flex items-start gap-2 sm:gap-4 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <OrderSourceBadge order={detailOrder} />
                <p className="text-base sm:text-xl font-bold text-[hsl(var(--primary))] truncate">{detailOrder.orderNumber}</p>
                <span className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium ${STATUS_COLORS[detailOrder.status]}`}>
                  {STATUS_LABELS[detailOrder.status]}
                </span>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 capitalize truncate">{detailOrder.clientName}</p>
              <div className="lg:hidden grid grid-cols-2 gap-2 mt-2 text-[10px]">
                {detailOrder.deliveryDate && (
                  <div>
                    <p className="font-bold text-[hsl(var(--muted-foreground))] uppercase">Delivery</p>
                    <p className="mt-0.5">{new Date(detailOrder.deliveryDate).toLocaleDateString()}</p>
                  </div>
                )}
                <div>
                  <p className="font-bold text-[hsl(var(--muted-foreground))] uppercase">Created</p>
                  <p className="mt-0.5">{new Date(detailOrder.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            {detailOrder.deliveryDate && (
              <div className="hidden lg:block border-l pl-6 shrink-0">
                <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">Delivery date</p>
                <p className="text-sm mt-1">{new Date(detailOrder.deliveryDate).toLocaleDateString()}</p>
              </div>
            )}
            <div className="hidden lg:block border-l pl-6 shrink-0">
              <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">Source</p>
              <p className="text-sm mt-1">{detailOrder.ownerUserId ? `Sales agent · ${detailOrder.createdBy}` : "CRM"}</p>
            </div>
            <div className="hidden lg:block border-l pl-6 shrink-0">
              <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">Created</p>
              <p className="text-sm mt-1">{new Date(detailOrder.createdAt).toLocaleDateString()} by {detailOrder.createdBy}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 space-y-5 sm:space-y-6">
          {detailOrder.dispatcher && (
            <div className="border-b pb-4">
              <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Dispatcher</p>
              <p className="text-sm font-medium">{detailOrder.dispatcher}</p>
            </div>
          )}

          {detailOrder.deliveryAddress && (
            <div className="border-b pb-4">
              <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Delivery address</p>
              <p className="text-sm whitespace-pre-wrap">{detailOrder.deliveryAddress}</p>
            </div>
          )}

          {detailOrder.notes && (
            <div className="border-b pb-4">
              <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{detailOrder.notes}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-bold text-[hsl(var(--muted-foreground))] mb-3">Order Items</p>
            <CrmLineItemsDisplay items={detailOrder.items} size="md" />
          </div>

          <CrmOrderSummaryDisplay order={detailOrder} />

          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-900 dark:text-blue-100">Payment</p>
              {canManagePayments && (
                <Button size="sm" className="h-8 text-xs bg-blue-500 hover:bg-blue-600 text-white cursor-pointer" onClick={() => setShowPayment(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {detailOrder.payments?.length ? "Manage payments" : "Add payment"}
                </Button>
              )}
            </div>
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Total Amount: PKR {detailOrder.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              {detailOrder.payments && detailOrder.payments.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {detailOrder.payments.map((p, i) => {
                    const pStatus = getPaymentSubmissionStatus(p, detailOrder.status)
                    return (
                    <div key={p.id} className="text-xs text-blue-700 dark:text-blue-300">
                      Payment {i + 1}: PKR {p.amount.toLocaleString()} · {p.method} · {new Date(p.date).toLocaleDateString()}
                      {pStatus === "draft" && " · Draft"}
                      {pStatus === "pending_approval" && " · Sent to finance"}
                    </div>
                  )})}
                </div>
              ) : (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  {canManagePayments ? "No payments yet — add payments with proof; each submit goes to Finance." : "No payments received yet"}
                </p>
              )}
            </div>
          </div>

          {detailOrder.payments && detailOrder.payments.length > 0 && (
            <div className="rounded-lg border bg-green-50 dark:bg-green-950 p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-green-900 dark:text-green-100 mb-2">Payments Received</p>
              <div className="space-y-2">
                {detailOrder.payments.map(p => {
                  const proofUrls = getOrderPaymentProofUrls(p)
                  const pStatus = getPaymentSubmissionStatus(p, detailOrder.status)
                  return (
                  <div key={p.id} className="flex items-center justify-between text-xs border-b border-green-200 dark:border-green-800 pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">PKR {p.amount.toLocaleString()}</p>
                      <p className="text-green-700 dark:text-green-300">
                        {p.method} · {new Date(p.date).toLocaleDateString()}
                        {pStatus === "draft" && " · Draft"}
                        {pStatus === "pending_approval" && " · Pending finance"}
                        {pStatus === "approved" && " · Approved"}
                      </p>
                      {p.notes && <p className="text-green-600 dark:text-green-400 text-[10px] mt-0.5">{p.notes}</p>}
                    </div>
                    {proofUrls.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {proofUrls.map((proofUrl, proofIndex) => (
                          <a
                            key={`${p.id}-${proofIndex}`}
                            href={proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-green-700 dark:text-green-300 underline text-[10px]"
                          >
                            {proofUrls.length > 1 ? `Proof ${proofIndex + 1}` : "View Proof"}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  )
                })}
                {(() => {
                  const submittedTotal = getSubmittedPayments(detailOrder.payments, detailOrder.status).reduce((sum, p) => sum + p.amount, 0)
                  return (
                    <>
                <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-green-200 dark:border-green-800">
                  <span className="text-green-900 dark:text-green-100">Total Paid (submitted)</span>
                  <span className="text-green-900 dark:text-green-100">PKR {submittedTotal.toLocaleString()}</span>
                </div>
                {submittedTotal < detailOrder.total && (
                  <div className="flex items-center justify-between text-xs font-bold text-orange-700 dark:text-orange-300">
                    <span>Remaining</span>
                    <span>PKR {(detailOrder.total - submittedTotal).toLocaleString()}</span>
                  </div>
                )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 px-4 sm:px-8 py-3 sm:py-5 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {detailOrder.status === "pending_approval" && isAdmin && (
            <>
              <Button size="sm" className="h-10 w-full sm:w-auto text-sm bg-green-400 hover:bg-green-500 text-white cursor-pointer" onClick={() => updateStatus("approved")}>
                Approve Order
              </Button>
              <Button size="sm" variant="outline" className="h-10 w-full sm:w-auto text-sm bg-red-400 hover:bg-red-500 text-white cursor-pointer" onClick={() => updateStatus("rejected")}>
                Reject Order
              </Button>
            </>
          )}
          {canEditOrder && (
            <Button size="sm" variant="outline" className="h-10 w-full sm:w-auto text-sm cursor-pointer" onClick={() => setShowEdit(true)}>
              <Edit className="h-4 w-4 mr-2" /> Edit order
            </Button>
          )}
          {canFinalize && (
            <Button size="sm" className="h-10 text-sm bg-green-400 hover:bg-green-500 text-white cursor-pointer" onClick={() => setShowFinalize(true)}>
              <FileText className="h-4 w-4 mr-2" /> Finalize Order
            </Button>
          )}
          {canManagePayments && (
            <Button size="sm" className="h-10 text-sm bg-blue-400 hover:bg-blue-500 text-white cursor-pointer" onClick={() => setShowPayment(true)}>
              <Plus className="h-4 w-4 mr-2" /> {detailOrder.payments?.length ? "Manage payments" : "Add payment"}
            </Button>
          )}
          {hasInvoiceDetails && (detailOrder.status === "finalized" || detailOrder.status === "payment_added" || detailOrder.status === "approved") && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0 cursor-pointer"
                onClick={viewInvoice}
                disabled={!!invoiceLoading}
                title="View Invoice"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0 cursor-pointer"
                onClick={() => void downloadInvoice()}
                disabled={!!invoiceLoading}
                title={invoiceLoading === "download" ? "Generating PDF…" : "Download PDF"}
              >
                {invoiceLoading === "download" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="h-10 w-full sm:w-auto text-sm sm:ml-auto cursor-pointer" onClick={onClose}>Close</Button>
          <Button size="sm" className="h-10 w-full sm:w-auto text-sm bg-red-400 hover:bg-red-500 text-white cursor-pointer" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
            <Trash2 className="h-4 w-4 mr-2" /> {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
    </>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Order"
        message={`Are you sure you want to delete this order? Order ${detailOrder.orderNumber} will be permanently removed and any inventory deductions will be restored.`}
        confirmText="Delete Order"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
