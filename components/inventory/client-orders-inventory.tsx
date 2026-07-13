"use client"
import { useState, useEffect, useRef, useMemo } from "react"
import { getOrders, saveOrder, hasOutstandingCredit, type Order } from "@/lib/orders"
import { isBranchPosOrderHiddenFromErp } from "@/lib/branch-pos"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
// DB access via /api/db routes (Prisma)
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SuccessNotification } from "@/components/ui/success-notification"
import { Loader2, X, Eye, Download, Truck, FileText, Search, Package, ScanLine, PackageMinus } from "lucide-react"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import { generateDispatchNotePDF } from "@/lib/generate-dispatch-note"
import { deductInventoryForOrder, orderNeedsInventoryDeduction } from "@/lib/inventory"
import { logOrderFulfillmentHistory } from "@/lib/order-fulfillment-history"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { downloadDispatchOrdersExcel } from "@/lib/inventory-excel-export"
import { useToast } from "@/components/ui/toast"
import { formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { CrmOrderSummaryDisplay } from "@/components/crm/crm-order-summary-display"
import { getManualInventoryItems } from "@/lib/manual-inventory"
import {
  buildAllocationsFromSelections,
  manualDispatchMetaByModel,
  orderHasSerialAllocations,
  orderLinesRequiringSerials,
  selectionsFromAllocations,
  validateSerialSelections,
  warehouseStockByModelFromRows,
} from "@/lib/order-fulfillment-serials"
import { OrderDispatchSerialPicker } from "@/components/inventory/order-dispatch-serial-picker"
import {
  computeDeliveredProductQty,
  hasProductFilter,
  matchingProductDescription,
  matchingProductQtyLabel,
  matchingProductValue,
  orderMatchesProductFilter,
  type ProductFilter,
} from "@/lib/order-product-search"
import { loadInventoryProductOptions, type InventoryProductOption } from "@/lib/inventory-product-options"

/** Optional delivery proof — all receiver/vehicle/product fields filled. */
function orderHasCompleteFulfillmentProof(o: Order): boolean {
  const textOk =
    !!(o.fulfillmentReceiverName || "").trim() &&
    !!(o.fulfillmentReceiverCnic || "").trim() &&
    !!(o.fulfillmentVehicleNumber || "").trim()
  const imgOk =
    !!(o.fulfillmentReceiverImageUrl || "").trim() &&
    !!(o.fulfillmentReceiverCnicImageUrl || "").trim() &&
    !!(o.fulfillmentVehicleImageUrl || "").trim()
  const productsOk = Array.isArray(o.fulfillmentProductImageUrls) && o.fulfillmentProductImageUrls.length > 0
  return textOk && imgOk && productsOk
}

export function ClientOrdersInventory() {
  const { toast } = useToast()
  const [exportingExcel, setExportingExcel] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [selectedProductModel, setSelectedProductModel] = useState("")
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadInventoryProductOptions()
      .then(setInventoryProducts)
      .finally(() => setLoadingProducts(false))
  }, [])

  const selectedProductOption = useMemo(
    () => inventoryProducts.find((p) => p.id === selectedProductModel),
    [inventoryProducts, selectedProductModel],
  )

  const productFilter: ProductFilter = useMemo(() => {
    if (selectedProductOption) {
      return {
        matchTerms: selectedProductOption.matchTerms,
        modelKey: selectedProductOption.displayName,
      }
    }
    return { query: productSearch || undefined }
  }, [selectedProductOption, productSearch])

  const filteredInventoryProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q || selectedProductModel) return inventoryProducts
    return inventoryProducts.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.modelKey.toLowerCase().includes(q) ||
        p.matchTerms.some((term) => term.toLowerCase().includes(q)),
    )
  }, [inventoryProducts, productSearch, selectedProductModel])

  useEffect(() => {
    getOrders().then(o => {
      // Show confirmed orders (sent from Finance) and processing/shipped/delivered orders
      // Branch POS orders are handled entirely in POS — keep them out of ERP inventory.
      const filtered = o.filter(order =>
        !isBranchPosOrderHiddenFromErp(order) &&
        (order.status === "confirmed" ||
        order.status === "processing" ||
        order.status === "shipped" ||
        order.status === "delivered")
      )
      setOrders(filtered)
      setSelectedOrder(prev => (prev ? filtered.find(order => order.id === prev.id) ?? prev : null))
      setLoading(false)
    })
    const interval = setInterval(() => {
      getOrders().then(o => {
        const filtered = o.filter(order =>
          !isBranchPosOrderHiddenFromErp(order) &&
          (order.status === "confirmed" ||
          order.status === "processing" ||
          order.status === "shipped" ||
          order.status === "delivered")
        )
        setOrders(filtered)
        setSelectedOrder(prev => (prev ? filtered.find(order => order.id === prev.id) ?? prev : null))
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        !search ||
        order.orderNumber.toLowerCase().includes(searchLower) ||
        order.clientName.toLowerCase().includes(searchLower) ||
        (order.dispatcher || "").toLowerCase().includes(searchLower)

      const matchesProduct = orderMatchesProductFilter(order, productFilter)

      const orderDate = order.deliveryDate ? new Date(order.deliveryDate) : new Date()
      const matchesDateRange =
        (!fromDate || orderDate >= new Date(fromDate)) &&
        (!toDate || orderDate <= new Date(toDate))

      return matchesSearch && matchesProduct && matchesDateRange
    })
  }, [orders, search, productFilter, fromDate, toDate])

  const productSummary = useMemo(() => {
    if (!hasProductFilter(productFilter)) return null
    const { qty, unit } = computeDeliveredProductQty(filteredOrders, productFilter)
    return {
      label: selectedProductOption?.displayName || productSearch.trim() || "Product",
      deliveredQty: qty,
      unit,
    }
  }, [filteredOrders, productFilter, selectedProductOption, productSearch])

  const isProductFiltered = hasProductFilter(productFilter)

  function clearProductFilter() {
    setSelectedProductModel("")
    setProductSearch("")
  }

  function handleProductDropdownChange(value: string) {
    setSelectedProductModel(value)
    setProductSearch("")
  }

  function handleProductSearchChange(value: string) {
    setProductSearch(value)
    if (value.trim()) setSelectedProductModel("")
  }

  function exportDispatchExcel() {
    setExportingExcel(true)
    try {
      downloadDispatchOrdersExcel(filteredOrders)
      toast({
        title: "Download started",
        message: `${filteredOrders.length} order(s) exported for Excel.`,
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
      {/* Product filter */}
      {!loading && orders.length > 0 && (
        <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative sm:w-72 shrink-0">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1faca6] pointer-events-none" />
              <select
                value={selectedProductModel}
                onChange={(e) => handleProductDropdownChange(e.target.value)}
                disabled={loadingProducts}
                className="w-full h-9 rounded-md border bg-[hsl(var(--background))] pl-10 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-[#1faca6]/50 cursor-pointer"
              >
                <option value="">
                  {loadingProducts ? "Loading inventory…" : "All products"}
                </option>
                {filteredInventoryProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.displayName} ({product.inStock} in stock)
                  </option>
                ))}
              </select>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                value={productSearch}
                onChange={(e) => handleProductSearchChange(e.target.value)}
                placeholder="Or type product / model name..."
                className="w-full h-9 rounded-md border bg-[hsl(var(--background))] pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]/50"
              />
            </div>
          </div>

          {productSummary && (
            <div className="rounded-md border bg-[hsl(var(--background))] p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{productSummary.label}</p>
                <button
                  type="button"
                  onClick={clearProductFilter}
                  className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                >
                  Clear product
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Delivered qty</p>
                  <p className="text-2xl font-bold text-[#1faca6] tabular-nums">
                    {productSummary.deliveredQty} <span className="text-sm font-medium">{productSummary.unit}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header with count */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
          {isProductFiltered ? " with this product" : " for dispatch"}
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <CrmExcelExportButton
            onExport={exportDispatchExcel}
            exporting={exportingExcel}
            disabled={loading || filteredOrders.length === 0}
          />
          {!loading && orders.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 flex-1 sm:flex-none text-xs gap-1.5 cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
              Filters
            </Button>
          )}
        </div>
      </div>

      
      {/* Filters */}
      {showFilters && !loading && orders.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border bg-[hsl(var(--muted))]/20 p-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search order, client, dispatcher..."
              className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            placeholder="From Date"
            className="h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] w-full sm:w-36 cursor-pointer"
          />
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            placeholder="To Date"
            className="h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] w-full sm:w-36 cursor-pointer"
          />
          {(search || isProductFiltered || fromDate || toDate) && (
            <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => { setSearch(""); clearProductFilter(); setFromDate(""); setToDate("") }}>
              Clear
            </Button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium">No orders for dispatch</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Confirmed orders from Finance will appear here.
          </p>
        </div>
      )}

      {!loading && filteredOrders.length === 0 && orders.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium">No orders match your filters</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}

      {!loading && filteredOrders.length > 0 && (
        <>
          <div className="md:hidden space-y-2">
            {filteredOrders.map((order) => {
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left rounded-lg border p-3 space-y-2.5 hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-[#1faca6] truncate">{order.orderNumber}</p>
                        {hasOutstandingCredit(order) && (
                          <Badge variant="warning" className="text-[9px] px-1 py-0">Credit</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate mt-0.5">{order.clientName}</p>
                    </div>
                    <OrderStatusBadge status={order.status} className="shrink-0 max-w-[42%] text-right" />
                  </div>
                  {isProductFiltered && (
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] line-clamp-2">
                      {matchingProductDescription(order, productFilter)}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {isProductFiltered ? "Product Qty" : "Items"}
                      </p>
                      <p className="font-medium">
                        {isProductFiltered
                          ? matchingProductQtyLabel(order, productFilter)
                          : formatCrmItemsQtyLabel(order.items)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Total</p>
                      <p className="font-semibold tabular-nums">
                        PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Delivery</p>
                      <p>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="hidden md:block rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem]">
                <thead>
                  <tr className="border-b bg-[hsl(var(--muted))]/40">
                    {[
                      "Order #",
                      "Client",
                      isProductFiltered ? "Product" : null,
                      isProductFiltered ? "Product Qty" : "Items",
                      isProductFiltered ? "Product Value" : "Total",
                      "Delivery Date",
                      "Status",
                    ].filter(Boolean).map((h) => (
                      <th
                        key={h}
                        className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((order) => {
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {order.orderNumber}
                            {hasOutstandingCredit(order) && (
                              <Badge variant="warning" className="text-[9px] px-1 py-0">Credit</Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium">{order.clientName}</td>
                        {isProductFiltered && (
                          <td className="px-4 py-2.5 text-xs max-w-[200px]">
                            <span className="line-clamp-2">{matchingProductDescription(order, productFilter)}</span>
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-xs">
                          {isProductFiltered
                            ? matchingProductQtyLabel(order, productFilter)
                            : formatCrmItemsQtyLabel(order.items)}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap tabular-nums">
                          {isProductFiltered
                            ? `PKR ${matchingProductValue(order, productFilter).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : `PKR ${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                          {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <OrderStatusBadge status={order.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedOrder && (
        <ClientOrderInventoryDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={o => {
            setOrders(prev => prev.map(x => x.id === o.id ? o : x))
            setSelectedOrder(o)
          }}
        />
      )}
    </div>
  )
}


function ClientOrderInventoryDetail({ order, onClose, onUpdate }: {
  order: Order
  onClose: () => void
  onUpdate: (o: Order) => void
}) {
  const [updating, setUpdating] = useState(false)
  const [showDeliveryConfirm, setShowDeliveryConfirm] = useState(false)
  const [showFulfillDialog, setShowFulfillDialog] = useState(false)
  const [showFulfillSuccess, setShowFulfillSuccess] = useState(false)
  const [fulfilledOrderNumber, setFulfilledOrderNumber] = useState("")
  const [stockItems, setStockItems] = useState<any[]>([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [showDeliveryAnimation, setShowDeliveryAnimation] = useState(false)
  
  // Fulfillment form states
  const [fulfillDispatcherName, setFulfillDispatcherName] = useState("")
  const [receiverName, setReceiverName] = useState("")
  const [receiverImage, setReceiverImage] = useState<File | null>(null)
  const [receiverCnic, setReceiverCnic] = useState("")
  const [receiverCnicImage, setReceiverCnicImage] = useState<File | null>(null)
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [vehicleImage, setVehicleImage] = useState<File | null>(null)
  const [productImages, setProductImages] = useState<File[]>([])
  const [serialSelections, setSerialSelections] = useState<Record<string, string[]>>({})
  const [serialSelectionValid, setSerialSelectionValid] = useState(true)
  const [fulfillTab, setFulfillTab] = useState<"dispatcher" | "products">("dispatcher")
  const [dispatchMode, setDispatchMode] = useState<"scan" | "no_scan">("scan")
  const [invoiceLoading, setInvoiceLoading] = useState<null | "view" | "download">(null)
  const [deductingStock, setDeductingStock] = useState(false)
  const [stockDeductionNotice, setStockDeductionNotice] = useState<string | null>(null)
  const autoDeductAttempted = useRef(false)

  async function applyInventoryDeduction(targetOrder: Order): Promise<Order> {
    if (targetOrder.inventoryDeductedAt) return targetOrder

    const result = await deductInventoryForOrder(targetOrder)
    if (result.alreadyDeducted) {
      if (!targetOrder.inventoryDeductedAt) {
        const marked: Order = { ...targetOrder, inventoryDeductedAt: new Date().toISOString() }
        await saveOrder(marked)
        return marked
      }
      return targetOrder
    }
    if (result.success) {
      const marked: Order = { ...targetOrder, inventoryDeductedAt: new Date().toISOString() }
      await saveOrder(marked)
      setStockDeductionNotice("Inventory updated successfully.")
      return marked
    }
    if (result.deductedLines > 0) {
      const marked: Order = { ...targetOrder, inventoryDeductedAt: new Date().toISOString() }
      await saveOrder(marked)
      setStockDeductionNotice(
        `Partial inventory update: ${result.failedLines.join("; ")}`
      )
      return marked
    }
    setStockDeductionNotice(
      result.failedLines.length > 0
        ? `Could not update inventory: ${result.failedLines.join("; ")}`
        : "Could not update inventory. Check stock records match order items."
    )
    return targetOrder
  }

  function openFulfillPrefilled() {
    setFulfillDispatcherName(order.fulfillmentDispatcher || order.dispatcher || "")
    setReceiverName(order.fulfillmentReceiverName || "")
    setReceiverCnic(order.fulfillmentReceiverCnic || "")
    setVehicleNumber(order.fulfillmentVehicleNumber || "")
    setReceiverImage(null)
    setReceiverCnicImage(null)
    setVehicleImage(null)
    setProductImages([])
    setSerialSelections(selectionsFromAllocations(order.fulfillmentSerialAllocations))
    setSerialSelectionValid(orderLinesRequiringSerials(order).length === 0)
    setDispatchMode("scan")
    setFulfillTab("dispatcher")
    setShowFulfillDialog(true)
  }

  function selectDispatchMode(mode: "scan" | "no_scan") {
    setDispatchMode(mode)
    setFulfillTab("dispatcher")
    if (mode === "no_scan") {
      setSerialSelections({})
      setSerialSelectionValid(true)
    } else {
      setSerialSelections(selectionsFromAllocations(order.fulfillmentSerialAllocations))
      setSerialSelectionValid(false)
    }
  }

  async function handleFulfillOrder() {
    if (!fulfillDispatcherName.trim()) {
      alert("Please enter the dispatcher name.")
      return
    }

    const linesNeedSerials = orderLinesRequiringSerials(order)
    let fulfillmentSerialAllocations = order.fulfillmentSerialAllocations ?? []

    if (linesNeedSerials.length > 0 && !order.inventoryDeductedAt) {
      if (dispatchMode === "no_scan") {
        fulfillmentSerialAllocations = []
      } else {
        const [manualItems, stockRes] = await Promise.all([
          getManualInventoryItems().catch(() => []),
          fetch("/api/db/inventory-stock", { cache: "no-store" }),
        ])
        const stockRows = stockRes.ok ? await stockRes.json() : []
        const manualMeta = manualDispatchMetaByModel(manualItems)
        const warehouseStockByModel = warehouseStockByModelFromRows(stockRows)
        const check = validateSerialSelections(
          order,
          serialSelections,
          manualMeta,
          warehouseStockByModel,
        )
        if (!check.valid) {
          setFulfillTab("products")
          alert(check.errors.join("\n"))
          return
        }
        fulfillmentSerialAllocations = buildAllocationsFromSelections(order, serialSelections)
      }
    }

    setUpdating(true)

    try {
      const fulfillDate = new Date().toLocaleDateString()

      const uploadImg = async (file: File): Promise<string> => {
        const fd = new FormData()
        fd.append("files", file)
        fd.append("folder", "fulfillment")
        const res = await fetch("/api/upload", { method: "POST", body: fd })
        const data = await res.json()
        return data.urls?.[0] || ""
      }

      let receiverImageUrl = (order.fulfillmentReceiverImageUrl || "").trim() || undefined
      let receiverCnicImageUrl = (order.fulfillmentReceiverCnicImageUrl || "").trim() || undefined
      let vehicleImageUrl = (order.fulfillmentVehicleImageUrl || "").trim() || undefined
      let productImageUrls: string[] = [...(order.fulfillmentProductImageUrls || [])]

      if (receiverImage) receiverImageUrl = await uploadImg(receiverImage)
      if (receiverCnicImage) receiverCnicImageUrl = await uploadImg(receiverCnicImage)
      if (vehicleImage) vehicleImageUrl = await uploadImg(vehicleImage)
      if (productImages.length > 0) {
        const newUrls = await Promise.all(productImages.map(uploadImg))
        productImageUrls = [...productImageUrls, ...newUrls]
      }

      let updatedOrder: Order = {
        ...order,
        dispatcher: fulfillDispatcherName.trim(),
        status: "delivered",
        fulfillmentDispatcher: fulfillDispatcherName.trim(),
        fulfillmentDate: new Date().toISOString(),
        fulfillmentReceiverName: receiverName.trim() || order.fulfillmentReceiverName,
        fulfillmentReceiverCnic: receiverCnic.trim() || order.fulfillmentReceiverCnic,
        fulfillmentVehicleNumber: vehicleNumber.trim() || order.fulfillmentVehicleNumber,
        fulfillmentReceiverImageUrl: receiverImageUrl,
        fulfillmentReceiverCnicImageUrl: receiverCnicImageUrl,
        fulfillmentVehicleImageUrl: vehicleImageUrl,
        fulfillmentProductImageUrls: productImageUrls.length > 0 ? productImageUrls : order.fulfillmentProductImageUrls,
        fulfillmentSerialAllocations,
      }

      const { applySalesCommissionOnDelivery } = await import("@/lib/sales-commission")
      updatedOrder = await applySalesCommissionOnDelivery(updatedOrder)

      updatedOrder = await saveOrder(updatedOrder)
      if (!updatedOrder.inventoryDeductedAt) {
        updatedOrder = await applyInventoryDeduction(updatedOrder)
      }

      await logOrderFulfillmentHistory({
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        clientName: updatedOrder.clientName,
        dispatcherName: fulfillDispatcherName.trim(),
        receiverName: receiverName.trim() || "",
        receiverCnic: receiverCnic.trim() || "",
        vehicleNumber: vehicleNumber.trim() || "",
        receiverImageUrl,
        receiverCnicImageUrl,
        vehicleImageUrl,
        productImageUrls: productImageUrls.length > 0 ? productImageUrls : [],
        fulfilledAt: updatedOrder.fulfillmentDate || new Date().toISOString(),
        fulfilledBy: updatedOrder.createdBy || "Inventory",
        notes:
          dispatchMode === "no_scan"
            ? `Dispatch note (qty only, no QR scan) by ${fulfillDispatcherName.trim()}. Inventory updated.`
            : `Dispatch note created by ${fulfillDispatcherName.trim()}. Inventory updated.`,
      })

      const blob = await generateDispatchNotePDF(updatedOrder, fulfillDispatcherName, fulfillDate)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Dispatch-Note-${order.orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setFulfilledOrderNumber(order.orderNumber)
      setShowFulfillSuccess(true)

      setShowFulfillDialog(false)
      onUpdate(updatedOrder)
      if (!updatedOrder.inventoryDeductedAt) {
        setStockDeductionNotice(
          "Dispatch saved, but inventory could not be matched. Use “Update inventory” on the order."
        )
      }

      setFulfillDispatcherName("")
      setReceiverName("")
      setReceiverCnic("")
      setVehicleNumber("")
      setReceiverImage(null)
      setReceiverCnicImage(null)
      setVehicleImage(null)
      setProductImages([])
    } catch (error) {
      console.error("Error fulfilling order:", error)
      alert("Failed to fulfill order. Please try again.")
    } finally {
      setUpdating(false)
    }
  }

  async function downloadInvoice() {
    if (invoiceLoading) return
    setInvoiceLoading("download")
    try {
      await downloadInvoicePDF(order)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setInvoiceLoading(null)
    }
  }

  async function viewInvoice() {
    if (invoiceLoading) return
    setInvoiceLoading("view")
    try {
      const blob = await import("@/lib/generate-invoice-pdf").then(m => m.generateInvoicePDF(order))
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setInvoiceLoading(null)
    }
  }

  async function redownloadDispatchNote() {
    if (!(order.fulfillmentDispatcher || order.dispatcher || "").trim()) {
      alert("Create a dispatch note first by entering the dispatcher name.")
      openFulfillPrefilled()
      return
    }
    try {
      const dispatcher = order.fulfillmentDispatcher || order.dispatcher || ""
      const date = order.fulfillmentDate
        ? new Date(order.fulfillmentDate).toLocaleDateString()
        : new Date().toLocaleDateString()
      const blob = await generateDispatchNotePDF(order, dispatcher, date)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Dispatch-Note-${order.orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error generating dispatch note:", error)
      alert("Failed to generate dispatch note. Please try again.")
    }
  }

  async function updateStatus(newStatus: "processing" | "shipped" | "delivered") {
    setUpdating(true)
    let updated: Order = { ...order, status: newStatus }
    updated = await saveOrder(updated)
    
    if (newStatus === "delivered") {
      const withStock = updated.inventoryDeductedAt
        ? updated
        : await applyInventoryDeduction(updated)
      onUpdate(withStock)
      
      // Close the delivery confirmation dialog
      if (showDeliveryConfirm) {
        setShowDeliveryConfirm(false)
      }
      
      // Show delivery animation
      setShowDeliveryAnimation(true)
      
      // Hide animation and update order after 3 seconds
      setTimeout(() => {
        setShowDeliveryAnimation(false)
        onUpdate(withStock)
        setUpdating(false)
      }, 3000)
    } else {
      onUpdate(updated)
      setUpdating(false)
    }
  }

  async function handleMarkAsDelivered() {
    // Check if this is a custom order (no stock tracking needed)
    const isCustomOrder = order.items.every(item => item.isCustom)
    
    if (isCustomOrder) {
      // For custom orders, just show a simple confirmation
      setShowDeliveryConfirm(true)
      return
    }
    
    setLoadingStock(true)
    setShowDeliveryConfirm(true)
    
    try {
      console.log("📦 Loading inventory from inventory-stock table...")
      
      // Load stock items directly from inventory-stock table
      const res = await fetch("/api/db/inventory-stock")
      if (!res.ok) {
        throw new Error("Failed to load inventory")
      }
      
      const stockItems = await res.json()
      console.log(`✅ Found ${stockItems.length} stock items`)
      
      // Filter for items matching the order
      const itemDescriptions = order.items.map(item => item.description)
      console.log("🔍 Looking for items:", itemDescriptions)
      
      const matchingStock = stockItems.filter((stock: any) => 
        itemDescriptions.includes(stock.description)
      )
      
      console.log(`✅ Found ${matchingStock.length} matching items`)
      console.log("📦 Matching items:", matchingStock)
      
      setStockItems(matchingStock)
    } catch (error) {
      console.error("💥 Exception while fetching inventory:", error)
      setStockItems([])
    } finally {
      setLoadingStock(false)
    }
  }

  const proofComplete = orderHasCompleteFulfillmentProof(order)
  const hasDispatcher = !!(order.fulfillmentDispatcher || order.dispatcher || "").trim()
  const linesNeedSerials = orderLinesRequiringSerials(order).length > 0
  const useQrScanDispatch =
    linesNeedSerials && !order.inventoryDeductedAt && dispatchMode === "scan"
  const serialSelectionOk =
    !useQrScanDispatch || serialSelectionValid
  const canSubmitFulfillment = !!fulfillDispatcherName.trim() && serialSelectionOk
  const needsStockUpdate = hasDispatcher && !order.inventoryDeductedAt

  async function handleUpdateInventory() {
    setDeductingStock(true)
    setStockDeductionNotice(null)
    try {
      const next = await applyInventoryDeduction(order)
      onUpdate(next)
    } finally {
      setDeductingStock(false)
    }
  }

  useEffect(() => {
    if (!hasDispatcher || order.inventoryDeductedAt || autoDeductAttempted.current) return
    if (
      linesNeedSerials &&
      !orderHasSerialAllocations(order) &&
      order.status !== "delivered"
    ) {
      return
    }
    autoDeductAttempted.current = true

    let cancelled = false
    ;(async () => {
      const needs = await orderNeedsInventoryDeduction(order)
      if (!needs || cancelled) return
      setDeductingStock(true)
      try {
        const next = await applyInventoryDeduction(order)
        if (!cancelled) onUpdate(next)
      } finally {
        if (!cancelled) setDeductingStock(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [order.id, order.inventoryDeductedAt, hasDispatcher])

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
          <div className="min-w-0 flex-1 pr-2 space-y-1">
            <p className="text-base sm:text-lg font-bold text-[hsl(var(--primary))] truncate">{order.orderNumber}</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">{order.clientName}</p>
            {order.deliveryDate && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Delivery: {new Date(order.deliveryDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="hidden sm:flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2 border-b shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs min-w-[7rem]"
              onClick={() => void viewInvoice()}
              disabled={!!invoiceLoading}
            >
              {invoiceLoading === "view" ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1.5" />
                  View Invoice
                </>
              )}
            </Button>
          {hasDispatcher && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={redownloadDispatchNote}>
              <Download className="h-3 w-3 mr-1.5" /> Dispatch Note
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-xs bg-green-600 hover:bg-green-700"
            onClick={openFulfillPrefilled}
            disabled={updating}
          >
            <Truck className="h-3 w-3 mr-1.5" />{" "}
            {updating ? "Processing..." : hasDispatcher ? "Update dispatch" : "Create dispatch note"}
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-4">
          <div>
            <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Order Items</p>
            <CrmLineItemsDisplay items={order.items} />
            {orderHasSerialAllocations(order) && (
              <div className="mt-3 rounded-lg border bg-[hsl(var(--muted))]/20 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                  Dispatched serial numbers
                </p>
                <ul className="space-y-1.5 text-xs">
                  {order.fulfillmentSerialAllocations!.map((a) => (
                    <li key={`${a.orderItemId}-${a.unitId}`} className="flex flex-wrap gap-x-2">
                      <span className="font-semibold tabular-nums">{a.model}</span>
                      <span className="font-mono text-[hsl(var(--primary))]">{a.serialNumber}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <CrmOrderSummaryDisplay order={order} />

          {(needsStockUpdate || stockDeductionNotice || deductingStock) && (
            <div
              className={`rounded-lg border px-3 py-3 text-xs space-y-2 ${
                needsStockUpdate
                  ? "border-amber-200 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                  : "border-green-200 bg-green-50 dark:bg-green-950/40 text-green-900 dark:text-green-100"
              }`}
            >
              {deductingStock ? (
                <p className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Updating inventory from this order…
                </p>
              ) : needsStockUpdate ? (
                <p>Stock has not been reduced for this dispatch yet.</p>
              ) : (
                <p>{stockDeductionNotice || "Inventory updated for this order."}</p>
              )}
              {needsStockUpdate && !deductingStock && (
                <Button
                  size="sm"
                  className="h-8 w-full sm:w-auto text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => void handleUpdateInventory()}
                >
                  Update inventory now
                </Button>
              )}
            </div>
          )}

        {hasDispatcher && (
          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Dispatch &amp; delivery</p>

            {!proofComplete && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-3 py-2.5 text-xs text-blue-900 dark:text-blue-100">
                Receiver details and photos are optional. You can add them later if needed.
              </div>
            )}

            {/* Info cards row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Dispatcher */}
              <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Dispatcher</p>
                <p className="text-sm font-semibold">{order.fulfillmentDispatcher || order.dispatcher}</p>
                {order.fulfillmentDate && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {new Date(order.fulfillmentDate).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Status */}
              <div
                className={
                  proofComplete
                    ? "rounded-lg border bg-green-50 dark:bg-green-950/30 p-4 space-y-1"
                    : "rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-4 space-y-1"
                }
              >
                <p
                  className={
                    proofComplete
                      ? "text-[10px] font-bold uppercase tracking-widest text-green-700 dark:text-green-400"
                      : "text-[10px] font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300"
                  }
                >
                  Status
                </p>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${proofComplete ? "bg-green-500" : "bg-amber-500"}`} />
                  <p
                    className={
                      proofComplete
                        ? "text-sm font-semibold text-green-700 dark:text-green-400"
                        : "text-sm font-semibold text-amber-800 dark:text-amber-200"
                    }
                  >
                    {proofComplete ? "Delivered" : "Delivered — proof pending"}
                  </p>
                </div>
              </div>

              {/* Receiver */}
              {order.fulfillmentReceiverName && (
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Receiver</p>
                  <p className="text-sm font-semibold">{order.fulfillmentReceiverName}</p>
                  {order.fulfillmentReceiverCnic && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">CNIC: {order.fulfillmentReceiverCnic}</p>
                  )}
                </div>
              )}

              {/* Vehicle */}
              {order.fulfillmentVehicleNumber && (
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Vehicle</p>
                  <p className="text-sm font-semibold">{order.fulfillmentVehicleNumber}</p>
                </div>
              )}
            </div>

            {/* Images section */}
            {(order.fulfillmentReceiverImageUrl || order.fulfillmentReceiverCnicImageUrl || order.fulfillmentVehicleImageUrl || (order.fulfillmentProductImageUrls && order.fulfillmentProductImageUrls.length > 0)) && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Proof Images</p>
                <div className="grid grid-cols-3 gap-3">
                  {order.fulfillmentReceiverImageUrl && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase">Receiver Photo</p>
                      <a href={order.fulfillmentReceiverImageUrl} target="_blank" rel="noreferrer">
                        <img src={order.fulfillmentReceiverImageUrl} alt="Receiver" className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"/>
                      </a>
                    </div>
                  )}
                  {order.fulfillmentReceiverCnicImageUrl && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase">Receiver CNIC</p>
                      <a href={order.fulfillmentReceiverCnicImageUrl} target="_blank" rel="noreferrer">
                        <img src={order.fulfillmentReceiverCnicImageUrl} alt="CNIC" className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"/>
                      </a>
                    </div>
                  )}
                  {order.fulfillmentVehicleImageUrl && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase">Vehicle Photo</p>
                      <a href={order.fulfillmentVehicleImageUrl} target="_blank" rel="noreferrer">
                        <img src={order.fulfillmentVehicleImageUrl} alt="Vehicle" className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"/>
                      </a>
                    </div>
                  )}
                  {order.fulfillmentProductImageUrls?.map((url, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase">Product Photo {i + 1}</p>
                      <a href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Product ${i + 1}`} className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"/>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>

        <div className="flex flex-col gap-2 sm:hidden px-4 py-3 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            size="sm"
            variant="outline"
            className="h-10 w-full text-xs"
            onClick={() => void viewInvoice()}
            disabled={!!invoiceLoading}
          >
            {invoiceLoading === "view" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                View Invoice
              </>
            )}
          </Button>
          {hasDispatcher && (
            <Button size="sm" variant="outline" className="h-10 w-full text-xs" onClick={redownloadDispatchNote}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Dispatch Note
            </Button>
          )}
          <Button
            size="sm"
            className="h-10 w-full text-xs bg-green-600 hover:bg-green-700"
            onClick={openFulfillPrefilled}
            disabled={updating}
          >
            <Truck className="h-3.5 w-3.5 mr-1.5" />{" "}
            {updating ? "Processing..." : hasDispatcher ? "Update dispatch" : "Create dispatch note"}
          </Button>
        </div>
      </div>
    </div>

      {showDeliveryConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDeliveryConfirm(false)}>
          <div className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50 dark:bg-green-950 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-green-900 dark:text-green-100">Confirm Delivery</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">Review stock items and confirm delivery</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDeliveryConfirm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingStock ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading stock data...</p>
                </div>
              ) : order.items.every(item => item.isCustom) ? (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-6 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Custom Order</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        This is a custom order. No inventory tracking required.
                      </p>
                    </div>
                  </div>
                </div>
              ) : stockItems.length === 0 ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
                    <div className="flex gap-3">
                      <svg className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="text-xs text-red-800 dark:text-red-200">
                        <p className="font-semibold mb-1">No Stock Data Found</p>
                        <p>No stock items found for the order items. Please ensure items have been properly received from POs.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">Looking for these items:</p>
                    <div className="space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
                          <span className="font-mono bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">"{item.description}"</span>
                          <span className="text-blue-600 dark:text-blue-400">({item.qty} {item.unit})</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
                      💡 Check the browser console for debugging information about available stock items.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Stock Items</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[hsl(var(--muted))]/40 border-b">
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Item Description</th>
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-24">PO #</th>
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-32">Supplier</th>
                            <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-16">Qty</th>
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                            <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-28">Landed Cost/Unit</th>
                            <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-28">Total Value</th>
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-24">Received</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {stockItems.map(stock => (
                            <tr key={stock.id}>
                              <td className="px-3 py-2">{stock.description}</td>
                              <td className="px-3 py-2 text-[hsl(var(--primary))] font-semibold">{stock.poNumber || stock.po_number}</td>
                              <td className="px-3 py-2">{stock.supplierName || stock.supplier_name || "—"}</td>
                              <td className="px-3 py-2 text-center font-medium">{stock.availableQty || stock.available_qty}</td>
                              <td className="px-3 py-2">{stock.unit}</td>
                              <td className="px-3 py-2 text-right">PKR {((stock.costPrice || stock.cost_price || 0)).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium">PKR {((stock.costPrice || stock.cost_price || 0) * (stock.availableQty || stock.available_qty)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{new Date(stock.createdAt || stock.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/30 p-4">
                    <p className="text-sm font-semibold mb-3 text-yellow-900 dark:text-yellow-100">Stock Check:</p>
                    <div className="space-y-3">
                      {order.items.map((item, index) => {
                        const itemStocks = stockItems.filter(s => s.description === item.description)
                        const totalAvailable = itemStocks.reduce((sum, s) => sum + (s.availableQty || s.available_qty || 0), 0)
                        const hasEnough = totalAvailable >= item.qty
                        const shortage = item.qty - totalAvailable
                        
                        return (
                          <div key={index} className="rounded-lg border bg-white dark:bg-gray-900 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-semibold text-sm">{item.description}</p>
                              {hasEnough ? (
                                <span className="text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-400 px-2 py-1 rounded-full">
                                  ✓ In Stock
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-400 px-2 py-1 rounded-full">
                                  ⚠ Shortage
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <p className="text-[hsl(var(--muted-foreground))]">Available</p>
                                <p className="font-semibold text-lg">{totalAvailable} {item.unit}</p>
                              </div>
                              <div>
                                <p className="text-[hsl(var(--muted-foreground))]">Required</p>
                                <p className="font-semibold text-lg">{item.qty} {item.unit}</p>
                              </div>
                              <div>
                                <p className="text-[hsl(var(--muted-foreground))]">Remaining</p>
                                <p className={`font-semibold text-lg ${hasEnough ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {hasEnough ? totalAvailable - item.qty : `-${shortage}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4">
                    <div className="flex gap-3">
                      <svg className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-xs text-orange-800 dark:text-orange-200">
                        <p className="font-semibold mb-1">Important:</p>
                        <p>Once marked as delivered, the inventory quantities will be permanently reduced. Make sure the order has been successfully delivered to the customer.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowDeliveryConfirm(false)}>
                Cancel
              </Button>
              <Button 
                size="sm" 
                className="h-8 text-xs bg-green-600 hover:bg-green-700 ml-auto" 
                onClick={() => updateStatus("delivered")} 
                disabled={updating || loadingStock || (!order.items.every(item => item.isCustom) && stockItems.length === 0)}
              >
                <Truck className="h-3 w-3 mr-1.5" /> {updating ? "Processing..." : "Confirm & Mark as Delivered"}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delivery Animation */}
      {showDeliveryAnimation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl h-48 overflow-hidden">
            {/* Truck Animation */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-[slideRight_3s_ease-in-out]">
                <Truck className="h-24 w-24 text-green-500" />
              </div>
            </div>
            
            {/* Success Message */}
            <div className="absolute inset-0 flex items-center justify-center animate-[fadeInOut_3s_ease-in-out]">
              <div className="text-center">
                <p className="text-2xl font-bold text-white mb-2">Order Delivered!</p>
                <p className="text-sm text-white/80">Inventory has been updated</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fulfillment Dialog */}
      {showFulfillDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowFulfillDialog(false)}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
              <div>
                <p className="text-base font-bold">Create dispatch note</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {useQrScanDispatch
                    ? "Step 1: dispatcher · Step 2: scan QR codes for order qty"
                    : dispatchMode === "no_scan" && linesNeedSerials
                      ? "Qty-only dispatch — inventory reduced without QR scanning"
                      : "Enter dispatcher details and create the dispatch note"}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowFulfillDialog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {linesNeedSerials && !order.inventoryDeductedAt ? (
              <div className="px-4 sm:px-6 py-3 border-b shrink-0 bg-[hsl(var(--muted))]/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">
                  Dispatch method
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => selectDispatchMode("scan")}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      dispatchMode === "scan"
                        ? "border-[#1faca6] bg-[#1faca6]/10 ring-1 ring-[#1faca6]/40"
                        : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/20"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <ScanLine className="h-4 w-4 text-[#1faca6] shrink-0" />
                      With QR scanning
                    </span>
                    <span className="block text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                      Scan serials for warranty · then create dispatch note
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDispatchMode("no_scan")}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      dispatchMode === "no_scan"
                        ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40"
                        : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/20"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <PackageMinus className="h-4 w-4 text-amber-600 shrink-0" />
                      Without scanning
                    </span>
                    <span className="block text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                      Reduce inventory qty only · no warranty serials
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-1 px-4 sm:px-6 border-b shrink-0 bg-[hsl(var(--muted))]/10">
              <button
                type="button"
                onClick={() => setFulfillTab("dispatcher")}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative ${
                  fulfillTab === "dispatcher"
                    ? "text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <Truck className="h-3.5 w-3.5 shrink-0" />
                Dispatcher
                {fulfillTab === "dispatcher" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
                )}
              </button>
              {useQrScanDispatch ? (
                <button
                  type="button"
                  onClick={() => setFulfillTab("products")}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative ${
                    fulfillTab === "products"
                      ? "text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <Package className="h-3.5 w-3.5 shrink-0" />
                  Scan QR
                  {!serialSelectionValid && (
                    <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                      !
                    </span>
                  )}
                  {fulfillTab === "products" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
                  )}
                </button>
              ) : null}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
              {fulfillTab === "dispatcher" && (
              <>
              {dispatchMode === "no_scan" && linesNeedSerials && !order.inventoryDeductedAt ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">Qty-only dispatch</p>
                  <p className="mt-1">
                    Inventory quantity will be reduced for each order line. QR codes are not required and
                    no warranty serials will be registered for this dispatch.
                  </p>
                </div>
              ) : null}
              {/* Dispatcher Information */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Dispatcher Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                      Dispatcher Name *
                    </label>
                    <input
                      type="text"
                      value={fulfillDispatcherName}
                      onChange={e => setFulfillDispatcherName(e.target.value)}
                      placeholder="Enter dispatcher name"
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                </div>
              </div>

              {/* Receiver Information */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Receiver Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                      Receiver Name
                    </label>
                    <input
                      type="text"
                      value={receiverName}
                      onChange={e => setReceiverName(e.target.value)}
                      placeholder="Enter receiver name"
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                      Receiver CNIC
                    </label>
                    <input
                      type="text"
                      value={receiverCnic}
                      onChange={e => setReceiverCnic(e.target.value)}
                      placeholder="Enter CNIC number"
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                      Receiver Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setReceiverImage(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                    {(order.fulfillmentReceiverImageUrl || "").trim() && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Already on file — upload only if replacing.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                      CNIC Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setReceiverCnicImage(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                    {(order.fulfillmentReceiverCnicImageUrl || "").trim() && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Already on file — upload only if replacing.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Vehicle Information */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Vehicle Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                      Vehicle Number
                    </label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={e => setVehicleNumber(e.target.value)}
                      placeholder="Enter vehicle number"
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                      Vehicle Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setVehicleImage(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                    {(order.fulfillmentVehicleImageUrl || "").trim() && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Already on file — upload only if replacing.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Images */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Product Images</p>
                <div>
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                    Upload Product Images
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => setProductImages(Array.from(e.target.files || []))}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                  {(order.fulfillmentProductImageUrls?.length ?? 0) > 0 && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                      {order.fulfillmentProductImageUrls!.length} product photo(s) already on file. Add more here or leave unchanged.
                    </p>
                  )}
                  {productImages.length > 0 && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      {productImages.length} image(s) selected
                    </p>
                  )}
                </div>
              </div>
              </>
              )}

              {showFulfillDialog && useQrScanDispatch && (
                <div className={fulfillTab === "products" ? "" : "hidden"} aria-hidden={fulfillTab !== "products"}>
                  <OrderDispatchSerialPicker
                    order={order}
                    value={serialSelections}
                    onChange={setSerialSelections}
                    disabled={!!order.inventoryDeductedAt}
                    allowFocus={fulfillTab === "products"}
                    onValidationChange={(valid) => setSerialSelectionValid(valid)}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {fulfillTab === "products" && useQrScanDispatch ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 w-full sm:w-auto text-xs"
                  onClick={() => setFulfillTab("dispatcher")}
                  disabled={updating}
                >
                  Back to dispatcher
                </Button>
              ) : useQrScanDispatch && fulfillTab === "dispatcher" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 w-full sm:w-auto text-xs"
                  onClick={() => setFulfillTab("products")}
                  disabled={updating || !fulfillDispatcherName.trim()}
                >
                  Next: Scan QR codes
                </Button>
              ) : null}
              <Button
                size="sm"
                className="h-10 w-full sm:w-auto sm:ml-auto text-xs bg-green-600 hover:bg-green-700"
                onClick={handleFulfillOrder}
                disabled={updating || !canSubmitFulfillment}
              >
                {updating ? "Creating…" : "Create dispatch note"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-full sm:w-auto text-xs"
                onClick={() => setShowFulfillDialog(false)}
                disabled={updating}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fulfilling overlay */}
      {updating && showFulfillDialog && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[hsl(var(--card))] rounded-2xl p-10 flex flex-col items-center gap-5 shadow-2xl">
            <div className="relative h-16 w-16">
              <svg className="animate-spin h-16 w-16 text-[#1faca6]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="h-7 w-7 text-[#1faca6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-bold text-[hsl(var(--foreground))]">Fulfilling Order...</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Uploading images and saving records</p>
            </div>
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="h-2 w-2 rounded-full bg-[#1faca6] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>
              ))}
            </div>
          </div>
        </div>
      )}

      <SuccessNotification
        isOpen={showFulfillSuccess}
        title={`Order ${fulfilledOrderNumber} Fulfilled!`}
        message="The order has been fulfilled and the dispatch note has been downloaded."
        onClose={() => setShowFulfillSuccess(false)}
        autoCloseDelay={4000}
      />
    </>
  )
}

