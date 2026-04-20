"use client"
import { useState, useEffect, useImperativeHandle, forwardRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Plus, X, Search, Trash2, Truck, Package, MapPin, Calendar, User, Phone, Download, Edit } from "lucide-react"
import jsPDF from 'jspdf'

const STORAGE_KEY = "erp_dispatches"

// PDF — invoice-style layout
async function generateDispatchPDF(d: Dispatch) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 16, RW = W - M * 2

  const TEAL:  [number,number,number] = [26, 159, 154]
  const DARK:  [number,number,number] = [15,  23,  42]
  const INK:   [number,number,number] = [30,  30,  30]
  const MUTED: [number,number,number] = [110, 110, 110]
  const LIGHT: [number,number,number] = [245, 247, 250]
  const RULE:  [number,number,number] = [220, 225, 232]

  const CHIP: Record<string,[number,number,number]> = {
    pending:    [217, 119,  6],
    in_transit: [37,   99, 235],
    delivered:  [22,  163,  74],
    cancelled:  [220,  38,  38],
  }

  let y = 0

  const t = (
    s: string, x: number, yy: number, sz: number,
    col: [number,number,number], w: 'normal'|'bold' = 'normal',
    align: 'left'|'right'|'center' = 'left'
  ) => {
    doc.setFont('helvetica', w); doc.setFontSize(sz); doc.setTextColor(...col)
    doc.text(s, x, yy, { align })
  }
  const rule = (yy: number, col: [number,number,number] = RULE, lw = 0.2) => {
    doc.setDrawColor(...col); doc.setLineWidth(lw); doc.line(M, yy, W - M, yy)
  }

  // ── HEADER ───────────────────────────────────────────────
  // full-width teal bar
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 30, 'F')

  // logo (white bg pill behind it for contrast)
  let logoEndX = M
  try {
    const res  = await fetch('/logo.png')
    const blob = await res.blob()
    const b64  = await new Promise<string>(r => {
      const fr = new FileReader(); fr.onloadend = () => r(fr.result as string); fr.readAsDataURL(blob)
    })
    const dims = await new Promise<{w:number,h:number}>(r => {
      const img = new Image(); img.onload = () => r({w:img.naturalWidth,h:img.naturalHeight}); img.src = b64
    })
    const lh = 10, lw = lh * (dims.w / dims.h)
    // white pill
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(M - 2, 10, lw + 4, lh + 2, 2, 2, 'F')
    doc.addImage(b64, 'PNG', M, 11, lw, lh)
    logoEndX = M + lw + 6
  } catch {
    t('VOLTRIX', M, 20, 16, [255,255,255], 'bold')
    logoEndX = M + 40
  }

  // right side of header
  const statusLabel = STATUSES.find(s => s.value === d.status)?.label || d.status
  t('DISPATCH DETAILS', W - M, 10, 7, [255,255,255,] as any, 'normal', 'right')
  t(`Order #${d.order_id}`, W - M, 17, 12, [255,255,255], 'bold', 'right')

  // status chip
  const chipCol = CHIP[d.status] ?? DARK
  const cw = 28, ch = 5.5
  doc.setFillColor(255,255,255)
  doc.roundedRect(W - M - cw, 20, cw, ch, 1.5, 1.5, 'F')
  t(statusLabel.toUpperCase(), W - M - cw / 2, 24, 6.5, chipCol, 'bold', 'center')

  y = 38

  // ── META ROW ─────────────────────────────────────────────
  t('Generated:', M, y, 7, MUTED)
  t(new Date().toLocaleDateString(), M + 18, y, 7, INK)
  t('Created by:', M + 60, y, 7, MUTED)
  t(d.created_by || '—', M + 78, y, 7, INK)
  y += 8

  rule(y, RULE, 0.3)
  y += 7

  // ── CUSTOMER + DELIVERY ───────────────────────────────────
  // two columns
  const LX = M, LW = 85
  const RX = M + 97, RW2 = 85

  // left: customer
  t('CUSTOMER', LX, y, 6.5, TEAL, 'bold')
  y += 5
  t('Name',  LX,      y, 7, MUTED); t(d.customer_name,  LX + 20, y, 8.5, INK)
  y += 5.5
  if (d.customer_phone) {
    t('Phone', LX, y, 7, MUTED); t(d.customer_phone, LX + 20, y, 8.5, INK)
    y += 5.5
  }

  // right: delivery (reset y to same start)
  const afterCustomerY = y
  y -= (d.customer_phone ? 11 : 5.5)
  const deliveryStartY = y - 5

  t('DELIVERY ADDRESS', RX, deliveryStartY, 6.5, TEAL, 'bold')
  const aLines = doc.splitTextToSize(d.delivery_address, RW2)
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...INK)
  doc.text(aLines, RX, deliveryStartY + 5)

  y = Math.max(afterCustomerY, deliveryStartY + 5 + aLines.length * 5) + 6

  rule(y, RULE, 0.3)
  y += 7

  // ── ITEMS TABLE ───────────────────────────────────────────
  t('ITEMS', M, y, 6.5, TEAL, 'bold')
  y += 5

  // thead
  doc.setFillColor(...DARK)
  doc.rect(M, y - 1, RW, 7.5, 'F')
  const cx = { a: M+2, b: M+60, c: M+98, d2: M+122, e: W-M-2 }
  t('ITEM',       cx.a,  y+4, 7, [255,255,255], 'bold')
  t('SPECS',      cx.b,  y+4, 7, [255,255,255], 'bold')
  t('QTY',        cx.c,  y+4, 7, [255,255,255], 'bold')
  t('UNIT PRICE', cx.d2, y+4, 7, [255,255,255], 'bold')
  t('TOTAL',      cx.e,  y+4, 7, [255,255,255], 'bold', 'right')
  y += 9

  let total = 0
  d.items.forEach((item, i) => {
    const it = item.quantity * item.price; total += it
    if (i % 2 === 0) { doc.setFillColor(...LIGHT); doc.rect(M, y-3.5, RW, 7, 'F') }
    t(item.name,                            cx.a,  y, 8.5, INK)
    t(item.specs || '—',                    cx.b,  y, 8.5, INK)
    t(`${item.quantity} ${item.unit}`,      cx.c,  y, 8.5, INK)
    t(`Rs. ${item.price.toLocaleString()}`, cx.d2, y, 8.5, INK)
    t(`Rs. ${it.toLocaleString()}`,         cx.e,  y, 8.5, INK, 'normal', 'right')
    y += 7
  })

  // total bar
  y += 1
  doc.setFillColor(...TEAL)
  doc.rect(M, y, RW, 8.5, 'F')
  t('Total Amount', cx.d2, y+5.5, 9, [255,255,255], 'bold')
  t(`Rs. ${total.toLocaleString()}`, cx.e, y+5.5, 9, [255,255,255], 'bold', 'right')
  y += 15

  // ── COURIER + DATES ───────────────────────────────────────
  const courierLabel = COURIER_SERVICES.find(c => c.value === d.courier_service)?.label || d.courier_service
  const cRows: [string,string][] = [['Service', courierLabel]]
  if (d.courier_service === 'own_driver') {
    if (d.driver_name)    cRows.push(['Driver',  d.driver_name])
    if (d.driver_phone)   cRows.push(['Phone',   d.driver_phone])
    if (d.vehicle_number) cRows.push(['Vehicle', d.vehicle_number])
  } else {
    if (d.tracking_id) cRows.push(['Tracking', d.tracking_id])
  }
  const dRows: [string,string][] = []
  if (d.dispatch_date)     dRows.push(['Dispatched', d.dispatch_date])
  if (d.expected_delivery) dRows.push(['Expected',   d.expected_delivery])

  // left col
  t('COURIER SERVICE', LX, y, 6.5, TEAL, 'bold'); y += 5
  const courierStartY = y
  cRows.forEach(([lbl, val]) => {
    t(lbl, LX, y, 7, MUTED); t(val, LX + 20, y, 8.5, INK); y += 5.5
  })

  // right col (reset y)
  const afterCourierY = y
  y = courierStartY - 5
  t('DATES', RX, y, 6.5, TEAL, 'bold'); y += 5
  dRows.forEach(([lbl, val]) => {
    t(lbl, RX, y, 7, MUTED); t(val, RX + 22, y, 8.5, INK); y += 5.5
  })

  y = Math.max(afterCourierY, y) + 6

  // ── NOTES ─────────────────────────────────────────────────
  if (d.notes) {
    rule(y, RULE, 0.2); y += 5
    t('NOTES', M, y, 6.5, TEAL, 'bold'); y += 5
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...INK)
    const nl = doc.splitTextToSize(d.notes, RW)
    doc.text(nl, M, y); y += nl.length * 5.5
  }

  // ── FOOTER ────────────────────────────────────────────────
  const PH = doc.internal.pageSize.height
  doc.setFillColor(...DARK); doc.rect(0, PH-12, W, 12, 'F')
  doc.setFillColor(...TEAL); doc.rect(0, PH-12, 3, 12, 'F')
  t('Voltrix ERP System', M, PH-5, 7, [150,160,175])
  t(new Date().toLocaleString(), W-M, PH-5, 7, [150,160,175], 'normal', 'right')

  doc.save(`${d.order_id}-dispatch.pdf`)
}

interface DispatchItem {
  name: string
  specs: string // watts, capacity, or other specifications
  quantity: number
  unit: string // pcs, box, kg, etc.
  price: number
}

interface Dispatch {
  id: string
  order_id: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  items: DispatchItem[]
  dispatch_date: string
  expected_delivery: string
  status: "pending" | "in_transit" | "delivered" | "cancelled"
  courier_service: string // "own_driver" | "tcs" | "leopards" | "other"
  driver_name: string
  driver_phone: string
  vehicle_number: string
  tracking_id: string
  notes: string
  created_by: string
  created_at: string
}

const STATUSES = [
  { value: "pending", label: "Pending", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
  { value: "in_transit", label: "In Transit", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { value: "delivered", label: "Delivered", color: "bg-green-500/10 text-green-600 border-green-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500/10 text-red-600 border-red-200" },
]

const COURIER_SERVICES = [
  { value: "own_driver", label: "Own Driver" },
  { value: "tcs", label: "TCS" },
  { value: "leopards", label: "Leopards Courier" },
  { value: "m&p", label: "M&P Express" },
  { value: "trax", label: "Trax" },
  { value: "other", label: "Other" },
]

const UNITS = ["pcs", "box", "carton", "kg", "liter", "meter", "set"]


export interface DispatchesManagerRef {
  openNewForm: () => void
}

const DispatchesManager = forwardRef<DispatchesManagerRef, { showForm: boolean, setShowForm: (show: boolean | ((prev: boolean) => boolean)) => void }>(
  ({ showForm, setShowForm }, ref) => {
  const { user } = useAuth()
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewDispatch, setViewDispatch] = useState<Dispatch | null>(null)
  const [editingDispatch, setEditingDispatch] = useState<Dispatch | null>(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("All")

  // form
  const [orderId, setOrderId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [items, setItems] = useState<DispatchItem[]>([])
  const [dispatchDate, setDispatchDate] = useState("")
  const [expectedDelivery, setExpectedDelivery] = useState("")
  const [status, setStatus] = useState<Dispatch["status"]>("pending")
  const [courierService, setCourierService] = useState("own_driver")
  const [driverName, setDriverName] = useState("")
  const [driverPhone, setDriverPhone] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [trackingId, setTrackingId] = useState("")
  const [notes, setNotes] = useState("")

  // Item form
  const [itemName, setItemName] = useState("")
  const [itemSpecs, setItemSpecs] = useState("")
  const [itemQty, setItemQty] = useState("")
  const [itemUnit, setItemUnit] = useState("pcs")
  const [itemPrice, setItemPrice] = useState("")

  useEffect(() => {
    async function fetchDispatches() {
      try {
        const res = await fetch('/api/dispatches')
        const data = await res.json()
        setDispatches(data)
      } catch (error) {
        console.error('Failed to fetch dispatches:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDispatches()
  }, [])

  const filtered = dispatches.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !search || 
      d.order_id.toLowerCase().includes(q) || 
      d.customer_name.toLowerCase().includes(q) ||
      d.driver_name.toLowerCase().includes(q) ||
      d.vehicle_number.toLowerCase().includes(q) ||
      d.tracking_id.toLowerCase().includes(q)
    const matchStatus = filterStatus === "All" || d.status === filterStatus
    return matchSearch && matchStatus
  })

  function addItem() {
    if (!itemName || !itemQty) return
    const newItem: DispatchItem = {
      name: itemName,
      specs: itemSpecs,
      quantity: parseFloat(itemQty),
      unit: itemUnit,
      price: parseFloat(itemPrice) || 0,
    }
    setItems([...items, newItem])
    setItemName("")
    setItemSpecs("")
    setItemQty("")
    setItemUnit("pcs")
    setItemPrice("")
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderId || !customerName || !deliveryAddress) {
      alert("Please fill required fields")
      return
    }
    setSaving(true)

    const dispatch: Dispatch = {
      id: editingDispatch?.id || `dsp_${Date.now()}`,
      order_id: orderId,
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_address: deliveryAddress,
      items: items,
      dispatch_date: dispatchDate,
      expected_delivery: expectedDelivery,
      status: status,
      courier_service: courierService,
      driver_name: driverName,
      driver_phone: driverPhone,
      vehicle_number: vehicleNumber,
      tracking_id: trackingId,
      notes: notes,
      created_by: user?.name || "Unknown",
      created_at: editingDispatch?.created_at || new Date().toISOString(),
    }

    // Save to database
    try {
      const res = await fetch('/api/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatch)
      })
      const savedDispatch = await res.json()
      const updated = editingDispatch
        ? dispatches.map(d => d.id === savedDispatch.id ? savedDispatch : d)
        : [savedDispatch, ...dispatches]
      setDispatches(updated)
      resetForm()
      setSaving(false)
    } catch (error) {
      console.error('Failed to save dispatch:', error)
      setSaving(false)
    }
  }

  function resetForm() {
    setOrderId(""); setCustomerName(""); setCustomerPhone("")
    setDeliveryAddress(""); setItems([]); setDispatchDate("")
    setExpectedDelivery(""); setStatus("pending"); setCourierService("own_driver")
    setDriverName(""); setDriverPhone(""); setVehicleNumber("")
    setTrackingId(""); setNotes(""); setShowForm(false)
    setEditingDispatch(null)
    setItemName(""); setItemSpecs(""); setItemQty(""); setItemUnit("pcs"); setItemPrice("")
  }

  function openNewForm() {
    // Generate auto order ID: ORD-YYYYMMDD-XXX
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
    const existingToday = dispatches.filter(d => d.order_id.includes(dateStr)).length
    const autoOrderId = `ORD-${dateStr}-${String(existingToday + 1).padStart(3, '0')}`
    setOrderId(autoOrderId)
    setShowForm(true)
  }

  // Expose openNewForm to parent via ref
  useImperativeHandle(ref, () => ({
    openNewForm
  }))

  function openEditForm(dispatch: Dispatch) {
    setEditingDispatch(dispatch)
    setOrderId(dispatch.order_id)
    setCustomerName(dispatch.customer_name)
    setCustomerPhone(dispatch.customer_phone)
    setDeliveryAddress(dispatch.delivery_address)
    setItems(dispatch.items || [])
    setDispatchDate(dispatch.dispatch_date)
    setExpectedDelivery(dispatch.expected_delivery)
    setStatus(dispatch.status)
    setCourierService(dispatch.courier_service || "own_driver")
    setDriverName(dispatch.driver_name)
    setDriverPhone(dispatch.driver_phone || "")
    setVehicleNumber(dispatch.vehicle_number)
    setTrackingId(dispatch.tracking_id || "")
    setNotes(dispatch.notes)
    setShowForm(true)
    setViewDispatch(null)
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/dispatches?id=${id}`, { method: 'DELETE' })
      const updated = dispatches.filter(d => d.id !== id)
      setDispatches(updated)
      if (viewDispatch?.id === id) setViewDispatch(null)
    } catch (error) {
      console.error('Failed to delete dispatch:', error)
    }
  }

  const statusCounts = {
    pending: dispatches.filter(d => d.status === "pending").length,
    in_transit: dispatches.filter(d => d.status === "in_transit").length,
    delivered: dispatches.filter(d => d.status === "delivered").length,
  }

  return (
    <div className="space-y-4">

      {/* Stats */}
      {dispatches.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: dispatches.length, color: "text-[#1faca6]", bg: "bg-[#1faca6]/8 border-[#1faca6]/20" },
            { label: "Pending", value: statusCounts.pending, color: "text-amber-600", bg: "bg-amber-50/60 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30" },
            { label: "In Transit", value: statusCounts.in_transit, color: "text-blue-600", bg: "bg-blue-50/60 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30" },
            { label: "Delivered", value: statusCounts.delivered, color: "text-emerald-600", bg: "bg-emerald-50/60 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {dispatches.length > 0 && (
        <div className="rounded-xl border bg-[hsl(var(--card))] p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by order, customer, driver..."
              className="w-full h-8 rounded-lg border bg-[hsl(var(--background))] pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-8 rounded-lg border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]">
            <option value="All">All Status</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {(search || filterStatus !== "All") && (
            <button onClick={() => { setSearch(""); setFilterStatus("All") }}
              className="h-8 px-3 text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground border rounded-lg cursor-pointer">Clear</button>
          )}
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto">{filtered.length} of {dispatches.length}</span>
        </div>
      )}

      {/* Dispatches list */}
      {loading ? (
        <div className="text-center py-12 text-xs text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : dispatches.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-2xl">
          <div className="h-12 w-12 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-3">
            <Truck className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm font-semibold">No dispatches yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Create your first dispatch to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-xs text-[hsl(var(--muted-foreground))] border rounded-xl border-dashed">No dispatches match your filters.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(d => {
            const statusInfo = STATUSES.find(s => s.value === d.status)
            return (
              <div key={d.id} onClick={() => setViewDispatch(d)}
                className="group flex items-center gap-3 rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5 hover:border-[#1faca6]/50 hover:bg-[#1faca6]/5 cursor-pointer transition-all">
                <div className="h-10 w-10 rounded-full shrink-0 bg-[hsl(var(--accent))] flex items-center justify-center">
                  <Truck className="h-5 w-5 text-[#1faca6]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold truncate">Order #{d.order_id}</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${statusInfo?.color}`}>
                      {statusInfo?.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                    {d.customer_name} · {d.items?.length || 0} item(s) · {d.delivery_address}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-medium">{d.courier_service === "own_driver" ? d.driver_name || "—" : COURIER_SERVICES.find(c => c.value === d.courier_service)?.label || "—"}</p>
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{d.tracking_id || d.vehicle_number || "—"}</p>
                </div>

                <Button size="icon" variant="ghost"
                  className="h-6 w-6 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                  onClick={e => { e.stopPropagation(); handleDelete(d.id) }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <p className="text-sm font-semibold">{editingDispatch ? "Edit Dispatch" : "New Dispatch"}</p>
              <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={resetForm}><X className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1">
                    Order ID *
                    <span className="text-[9px] text-[hsl(var(--muted-foreground))] font-normal">(auto-generated, editable)</span>
                  </label>
                  <input value={orderId} onChange={e => setOrderId(e.target.value)} required placeholder="e.g. ORD-20260415-001"
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as Dispatch["status"])}
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]">
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Customer Name *</label>
                  <input value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="Customer name"
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Customer Phone</label>
                  <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+92 300 0000000"
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium">Delivery Address *</label>
                  <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} required placeholder="Full delivery address"
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                </div>

                {/* Items Builder */}
                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-medium">Items *</label>
                  
                  {/* Add Item Form */}
                  <div className="rounded-lg border bg-[hsl(var(--background))] p-3 space-y-2">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3 space-y-1">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Item Name</label>
                        <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. Battery"
                          className="w-full h-8 rounded-md border bg-[hsl(var(--card))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Specs/Watts</label>
                        <input value={itemSpecs} onChange={e => setItemSpecs(e.target.value)} placeholder="e.g. 5kW"
                          className="w-full h-8 rounded-md border bg-[hsl(var(--card))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Quantity</label>
                        <input value={itemQty} onChange={e => setItemQty(e.target.value)} type="number" step="0.01" placeholder="0"
                          className="w-full h-8 rounded-md border bg-[hsl(var(--card))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Unit</label>
                        <select value={itemUnit} onChange={e => setItemUnit(e.target.value)}
                          className="w-full h-8 rounded-md border bg-[hsl(var(--card))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]">
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Price (Rs.)</label>
                        <input value={itemPrice} onChange={e => setItemPrice(e.target.value)} type="number" step="0.01" placeholder="0"
                          className="w-full h-8 rounded-md border bg-[hsl(var(--card))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <label className="text-[10px] text-transparent">Add</label>
                        <Button type="button" size="sm" onClick={addItem}
                          className="w-full h-8 bg-[#1faca6] hover:bg-[#17857f] text-white px-2 cursor-pointer">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  {items.length > 0 && (
                    <div className="rounded-lg border bg-[hsl(var(--background))] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-[hsl(var(--accent))] border-b">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Item</th>
                            <th className="text-left px-3 py-2 font-medium">Specs</th>
                            <th className="text-right px-3 py-2 font-medium">Qty</th>
                            <th className="text-left px-3 py-2 font-medium">Unit</th>
                            <th className="text-right px-3 py-2 font-medium">Price</th>
                            <th className="text-right px-3 py-2 font-medium">Total</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="px-3 py-2">{item.name}</td>
                              <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{item.specs || "—"}</td>
                              <td className="px-3 py-2 text-right">{item.quantity}</td>
                              <td className="px-3 py-2">{item.unit}</td>
                              <td className="px-3 py-2 text-right">Rs. {item.price.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-medium">Rs. {(item.quantity * item.price).toLocaleString()}</td>
                              <td className="px-3 py-2">
                                <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}
                                  className="h-6 w-6 text-red-400 hover:text-red-600 cursor-pointer">
                                  <X className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-[hsl(var(--accent))] font-semibold">
                            <td colSpan={5} className="px-3 py-2 text-right">Total Amount:</td>
                            <td className="px-3 py-2 text-right">Rs. {totalAmount.toLocaleString()}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Dispatch Date</label>
                  <input value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} type="date"
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Expected Delivery</label>
                  <input value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} type="date"
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                </div>

                {/* Courier Service Section */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium">Courier Service</label>
                  <select value={courierService} onChange={e => setCourierService(e.target.value)}
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]">
                    {COURIER_SERVICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                {courierService === "own_driver" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Driver Name</label>
                      <input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Driver name"
                        className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Driver Phone</label>
                      <input value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="+92 300 0000000"
                        className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-medium">Vehicle Number</label>
                      <input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. ABC-123"
                        className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-medium">Tracking ID</label>
                    <input value={trackingId} onChange={e => setTrackingId(e.target.value)} placeholder="Enter tracking number"
                      className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
                  </div>
                )}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional notes..."
                    className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6] resize-none" />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-9 cursor-pointer" onClick={resetForm}>Cancel</Button>
                <Button type="submit" size="sm" className="flex-1 h-9 bg-[#1faca6] hover:bg-[#17857f] text-white cursor-pointer" disabled={saving}>
                  {saving ? "Saving..." : editingDispatch ? "Update" : "Create Dispatch"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Dispatch Modal */}
      {viewDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setViewDispatch(null)}>
          <div className="w-full max-w-3xl rounded-2xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#1faca6]/10 flex items-center justify-center">
                  <Truck className="h-4.5 w-4.5 text-[#1faca6]" />
                </div>
                <div>
                  <p className="text-sm font-bold">Order #{viewDispatch.order_id}</p>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUSES.find(s => s.value === viewDispatch.status)?.color}`}>
                    {STATUSES.find(s => s.value === viewDispatch.status)?.label}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => setViewDispatch(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Row 1: Customer + Delivery + Courier + Dates + Notes — all in 2 cols */}
              <div className="grid grid-cols-2 gap-4">

                {/* LEFT column */}
                <div className="space-y-4">
                  {/* Customer */}
                  <div className="rounded-lg border bg-[hsl(var(--background))] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1faca6] mb-2">Customer</p>
                    <div className="space-y-1">
                      <div className="flex gap-2 text-xs">
                        <span className="text-[hsl(var(--muted-foreground))] w-12 shrink-0">Name</span>
                        <span className="font-medium">{viewDispatch.customer_name}</span>
                      </div>
                      {viewDispatch.customer_phone && (
                        <div className="flex gap-2 text-xs">
                          <span className="text-[hsl(var(--muted-foreground))] w-12 shrink-0">Phone</span>
                          <span>{viewDispatch.customer_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="rounded-lg border bg-[hsl(var(--background))] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1faca6] mb-2">Delivery Address</p>
                    <p className="text-xs">{viewDispatch.delivery_address}</p>
                  </div>
                </div>

                {/* RIGHT column */}
                <div className="space-y-4">
                  {/* Courier Service */}
                  <div className="rounded-lg border bg-[hsl(var(--background))] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1faca6] mb-2">Courier Service</p>
                    <div className="space-y-1">
                      <div className="flex gap-2 text-xs">
                        <span className="text-[hsl(var(--muted-foreground))] w-14 shrink-0">Service</span>
                        <span className="font-medium">{COURIER_SERVICES.find(c => c.value === viewDispatch.courier_service)?.label || "—"}</span>
                      </div>
                      {viewDispatch.courier_service === "own_driver" ? (<>
                        {viewDispatch.driver_name && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-[hsl(var(--muted-foreground))] w-14 shrink-0">Driver</span>
                            <span>{viewDispatch.driver_name}</span>
                          </div>
                        )}
                        {viewDispatch.driver_phone && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-[hsl(var(--muted-foreground))] w-14 shrink-0">Phone</span>
                            <span>{viewDispatch.driver_phone}</span>
                          </div>
                        )}
                        {viewDispatch.vehicle_number && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-[hsl(var(--muted-foreground))] w-14 shrink-0">Vehicle</span>
                            <span>{viewDispatch.vehicle_number}</span>
                          </div>
                        )}
                      </>) : viewDispatch.tracking_id && (
                        <div className="flex gap-2 text-xs">
                          <span className="text-[hsl(var(--muted-foreground))] w-14 shrink-0">Tracking</span>
                          <span>{viewDispatch.tracking_id}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  {(viewDispatch.dispatch_date || viewDispatch.expected_delivery) && (
                    <div className="rounded-lg border bg-[hsl(var(--background))] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1faca6] mb-2">Dates</p>
                      <div className="space-y-1">
                        {viewDispatch.dispatch_date && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-[hsl(var(--muted-foreground))] w-20 shrink-0">Dispatched</span>
                            <span>{viewDispatch.dispatch_date}</span>
                          </div>
                        )}
                        {viewDispatch.expected_delivery && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-[hsl(var(--muted-foreground))] w-20 shrink-0">Expected</span>
                            <span>{viewDispatch.expected_delivery}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {viewDispatch.notes && (
                    <div className="rounded-lg border bg-[hsl(var(--background))] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1faca6] mb-2">Notes</p>
                      <p className="text-xs whitespace-pre-wrap text-[hsl(var(--muted-foreground))]">{viewDispatch.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items — full width */}
              {viewDispatch.items && viewDispatch.items.length > 0 && (
                <div className="rounded-lg border bg-[hsl(var(--background))] overflow-hidden">
                  <div className="px-3 py-2 border-b bg-[hsl(var(--muted))]/40">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1faca6]">Items</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="border-b bg-[hsl(var(--muted))]/20">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">Item</th>
                        <th className="text-left px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">Specs</th>
                        <th className="text-center px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">Unit Price</th>
                        <th className="text-right px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {viewDispatch.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[hsl(var(--muted))]/20">
                          <td className="px-3 py-2 font-medium">{item.name}</td>
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{item.specs || "—"}</td>
                          <td className="px-3 py-2 text-center">{item.quantity} {item.unit}</td>
                          <td className="px-3 py-2 text-right">Rs. {item.price.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-semibold">Rs. {(item.quantity * item.price).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-[#1faca6]/5">
                        <td colSpan={4} className="px-3 py-2 text-right font-semibold text-[#1faca6]">Total Amount</td>
                        <td className="px-3 py-2 text-right font-bold text-[#1faca6]">
                          Rs. {viewDispatch.items.reduce((s, i) => s + i.quantity * i.price, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t bg-[hsl(var(--muted))]/20 flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setViewDispatch(null)}>Close</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={() => openEditForm(viewDispatch)}>
                <Edit className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
              <Button size="sm" className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white cursor-pointer"
                onClick={() => generateDispatchPDF(viewDispatch)}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download PDF
              </Button>
              <Button size="sm" className="h-8 text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-200 ml-auto cursor-pointer"
                onClick={() => handleDelete(viewDispatch.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

DispatchesManager.displayName = "DispatchesManager"

export default DispatchesManager
