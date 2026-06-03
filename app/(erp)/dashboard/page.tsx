"use client"
import { useState, useEffect } from "react"
import { Topbar } from "@/components/layout/topbar"
import { UsersPanel } from "@/components/layout/users-panel"
import { useAuth } from "@/components/auth-provider"
import { getPOs, savePO, getSuppliers, STATUS_LABELS, STATUS_VARIANT, type PurchaseOrder, type Supplier } from "@/lib/purchase"
// DB access via /api/db routes (Prisma)
import { PODetail } from "@/components/purchase/po-detail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ComingSoon } from "@/components/layout/coming-soon"
import { Users, Building2, Package, FileText, ShoppingCart, BarChart3, DollarSign, ClipboardCheck, LayoutDashboard } from "lucide-react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useToast } from "@/components/ui/toast"
import { ClientOrdersApproval } from "@/components/dashboard/client-orders-approval"
import { DashboardBranchTransferApprovals, useBranchTransferPendingCount } from "@/components/dashboard/branch-transfer-approvals-panel"
import { DashboardPettyCashApprovals, usePettyCashPendingCount } from "@/components/dashboard/petty-cash-approvals"
import {
  ChartCard,
  ChartLoading,
  CHART_TOOLTIP_STYLE,
  DashboardSection,
  DashboardShell,
  FinanceHighlightGrid,
  formatRsAxis,
  formatRsFull,
  RangeToggle,
  StatCardGrid,
} from "@/components/dashboard/dashboard-ui"

function POsWidget({ showFilters, setShowFilters, onPendingChange }: { showFilters: boolean, setShowFilters: (value: boolean) => void, onPendingChange?: (count: number, openFirst: () => void) => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [notified, setNotified] = useState(false)
  const [subTab, setSubTab] = useState<"pending" | "approved" | "draft" | "rejected" | "received">("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  useEffect(() => {
    Promise.all([getPOs(), getSuppliers()]).then(([p, s]) => {
      setPOs(p); setSuppliers(s)
    })
    const interval = setInterval(() => {
      getPOs().then(newPos => {
        setPOs(newPos)
        const pending = newPos.filter(p => p.status === "sent_to_admin")
        if (pending.length > 0) {
          toast({
            type: "warning",
            title: `${pending.length} PO${pending.length > 1 ? "s" : ""} awaiting approval`,
            message: "New purchase order submitted for your review.",
            duration: 5000,
          })
        }
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (notified) return
    const pending = pos.filter(p => p.status === "sent_to_admin")
    if (pending.length > 0) {
      toast({
        type: "warning",
        title: `${pending.length} purchase order${pending.length > 1 ? "s" : ""} waiting for your approval`,
        message: "Go to the purchase orders table below to review.",
        duration: 6000,
      })
      setNotified(true)
    }
  }, [pos, notified, toast])

  useEffect(() => {
    const pending = pos.filter(p => p.status === "sent_to_admin")
    onPendingChange?.(pending.length, () => {
      const first = pending[0]
      if (first) setSelected(first)
    })
  }, [pos])

  async function handleUpdate(updated: PurchaseOrder) {
    await savePO(updated)
    setPOs(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSelected(updated)
  }

  const pendingPOs = pos.filter(p => p.status === "sent_to_admin")
  const approvedPOs = pos.filter(p => p.status === "approved" || p.status === "finalized")
  const draftPOs = pos.filter(p => p.status === "draft")
  const rejectedPOs = pos.filter(p => p.status === "rejected")
  const receivedPOs = pos.filter(p => p.status === "in_inventory" || p.status === "imp_inventory")

  // Apply filters
  const filterPOs = (poList: PurchaseOrder[]) => {
    return poList.filter(po => {
      // Search filter
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = !searchQuery ||
        po.poNumber.toLowerCase().includes(searchLower) ||
        po.supplierNames.some(s => s.toLowerCase().includes(searchLower)) ||
        po.createdBy.toLowerCase().includes(searchLower)

      // Date range filter
      const poDate = new Date(po.createdAt)
      const matchesDateFrom = !dateFrom || poDate >= new Date(dateFrom)
      const matchesDateTo = !dateTo || poDate <= new Date(dateTo + "T23:59:59")

      return matchesSearch && matchesDateFrom && matchesDateTo
    })
  }

  const filteredPending = filterPOs(pendingPOs)
  const filteredApproved = filterPOs(approvedPOs)
  const filteredDraft = filterPOs(draftPOs)
  const filteredRejected = filterPOs(rejectedPOs)
  const filteredReceived = filterPOs(receivedPOs)

  const displayPOs = subTab === "pending" ? filteredPending : subTab === "approved" ? filteredApproved : subTab === "draft" ? filteredDraft : subTab === "rejected" ? filteredRejected : filteredReceived
  const recent = displayPOs.slice(0, 8)

  return (
    <>
      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-2.5 space-y-2 mb-3">
          <div className="flex flex-wrap gap-2">
            <div className="w-32 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="PO, supplier..."
                className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <div className="w-32 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer"
              />
            </div>
            <div className="w-32 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] cursor-pointer"
              />
            </div>
            <button
              onClick={() => { setSearchQuery(""); setDateFrom(""); setDateTo("") }}
              className="self-end px-2 py-1 text-[10px] border rounded hover:bg-[hsl(var(--muted))]/10 cursor-pointer transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Sub-tabs */}
        <div className="flex gap-1 border-b border-[hsl(var(--border))]/50">
          {(["pending", "approved", "received", "draft", "rejected"] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                subTab === t
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {t === "pending" ? "Pending" : t === "approved" ? "Approved" : t === "received" ? "Received" : t === "draft" ? "Draft" : "Rejected"}
              {subTab === t && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          ))}
        </div>

        {displayPOs.length === 0 ? null : (
          <div className="rounded-lg border border-[hsl(var(--border))]/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]/50 bg-[hsl(var(--muted))]/40">
                  {["PO #", "Supplier", "Type", "Items", "Created By", "Date", "Status"].map(h => (
                    <th key={h} className="h-8 px-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]/50">
                {recent.map(po => {
                  const poNumberDisplay = (po.poNumber && po.poNumber.trim()) ? po.poNumber : `PO-${po.id.slice(0, 8)}`
                  const supplierNamesDisplay = (po.supplierNames && po.supplierNames.length > 0)
                    ? po.supplierNames.join(", ")
                    : po.quotes?.[0]?.supplierName || "—"
                  const dateDisplay = po.createdAt && !isNaN(new Date(po.createdAt).getTime())
                    ? new Date(po.createdAt).toLocaleDateString()
                    : "—"
                  return (
                    <tr key={po.id} className="hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer" onClick={() => setSelected(po)}>
                      <td className="px-4 py-2.5 font-medium text-[hsl(var(--primary))]">{poNumberDisplay}</td>
                      <td className="px-4 py-2.5 text-xs">{supplierNamesDisplay}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={po.type === "local" ? "success" : "info"} className="text-[10px] px-1.5 py-0">{po.type}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.items.length}</td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.createdBy || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{dateDisplay}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={STATUS_VARIANT[po.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[po.status]}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <PODetail
          po={selected}
          allSuppliers={suppliers}
          isAdmin={user?.role === "superadmin"}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  )
}

function ERPStats() {
  const [stats, setStats] = useState({
    staff: 0,
    clients: 0,
    products: 0,
    quotations: 0,
    orders: 0,
    inventoryItems: 0,
    financeTotal: 0,
    totalPOValue: 0,
    totalOrdersValue: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [staffRes, clientsRes, productsRes, quotationsRes, ordersRes, inventoryRes, financeRes, poRes, clientOrdersRes] = await Promise.all([
          fetch('/api/hrm/staff').then(r => r.json()).catch(() => []),
          fetch('/api/db/clients').then(r => r.json()).catch(() => []),
          fetch('/api/products').then(r => r.json()).catch(() => []),
          fetch('/api/db/quotations').then(r => r.json()).catch(() => []),
          fetch('/api/db/orders').then(r => r.json()).catch(() => []),
          fetch('/api/inventory/stock').then(r => r.json()).catch(() => []),
          fetch('/api/finance/records').then(r => r.json()).catch(() => []),
          getPOs().catch(() => []),
          fetch('/api/db/client-orders').then(r => r.json()).catch(() => []),
        ])

        const inventoryItems = Array.isArray(inventoryRes)
          ? inventoryRes
          : (Array.isArray((inventoryRes as any)?.data) ? (inventoryRes as any).data : [])

        // Calculate finance total for current month
        const now = new Date()
        const financeTotal = Array.isArray(financeRes)
          ? financeRes
              .filter((r: any) => {
                const date = new Date(r.createdAt || r.created_at || r.date)
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
              })
              .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0)
          : 0

        // Calculate total PO value
        const totalPOValue = Array.isArray(poRes)
          ? poRes.reduce((sum: number, po: any) => {
              const poTotal = po.items?.reduce((itemSum: number, item: any) => itemSum + (Number(item.totalPrice) || 0), 0) || 0
              return sum + poTotal
            }, 0)
          : 0

        // Calculate total client orders value
        const totalOrdersValue = Array.isArray(clientOrdersRes)
          ? clientOrdersRes.reduce((sum: number, order: any) => {
              return sum + (Number(order.totalAmount) || Number(order.total) || 0)
            }, 0)
          : 0

        setStats({
          staff: Array.isArray(staffRes) ? staffRes.length : 0,
          clients: Array.isArray(clientsRes) ? clientsRes.length : 0,
          products: Array.isArray(productsRes) ? productsRes.length : 0,
          quotations: Array.isArray(quotationsRes) ? quotationsRes.length : 0,
          orders: Array.isArray(ordersRes) ? ordersRes.length : 0,
          inventoryItems: inventoryItems.length,
          financeTotal,
          totalPOValue,
          totalOrdersValue,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const formatCurrency = (value: number) => {
    return `Rs. ${value.toLocaleString()}`
  }

  const coreCards = [
    { label: "Staff", value: stats.staff, icon: Users, href: "/hrm", accent: "bg-blue-500", iconBg: "bg-blue-500/10" },
    { label: "Clients", value: stats.clients, icon: Building2, href: "/crm", accent: "bg-violet-500", iconBg: "bg-violet-500/10" },
    { label: "Products", value: stats.products, icon: Package, href: "/website", accent: "bg-orange-500", iconBg: "bg-orange-500/10" },
    { label: "Quotations", value: stats.quotations, icon: FileText, href: "/crm", accent: "bg-emerald-500", iconBg: "bg-emerald-500/10" },
    { label: "Orders", value: stats.orders, icon: ShoppingCart, href: "/crm", accent: "bg-pink-500", iconBg: "bg-pink-500/10" },
    { label: "Inventory", value: stats.inventoryItems, icon: BarChart3, href: "/inventory", accent: "bg-cyan-500", iconBg: "bg-cyan-500/10" },
  ]

  const financeCards = [
    { label: "Expenses this month", value: formatCurrency(stats.financeTotal), icon: DollarSign, href: "/finance", accent: "bg-emerald-500", iconBg: "bg-emerald-500/10 text-emerald-700" },
    { label: "Total PO value", value: formatCurrency(stats.totalPOValue), icon: DollarSign, href: "/purchase", accent: "bg-amber-500", iconBg: "bg-amber-500/10 text-amber-700" },
    { label: "Total orders value", value: formatCurrency(stats.totalOrdersValue), icon: DollarSign, href: "/crm", accent: "bg-rose-500", iconBg: "bg-rose-500/10 text-rose-700" },
  ]

  return (
    <DashboardSection
      title="Overview"
      description="Key counts and financial snapshot across Voltrix ERP"
    >
      <StatCardGrid cards={coreCards} loading={loading} />
      <FinanceHighlightGrid cards={financeCards} loading={loading} />
    </DashboardSection>
  )
}

function FinanceAndOpsMiniCharts() {
  const [loading, setLoading] = useState(true)
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14)
  const [pettyCashByEmployee, setPettyCashByEmployee] = useState<Array<{ name: string; amount: number; role: string }>>([])
  const [deliveredTrend, setDeliveredTrend] = useState<Array<{ day: string; amount: number; orderIds: string[] }>>([])
  const [deliveredTotal, setDeliveredTotal] = useState(0)
  const [deliveredCount, setDeliveredCount] = useState(0)
  const [inventoryTrend, setInventoryTrend] = useState<Array<{ day: string; quantity: number; names: string[] }>>([])
  const [poStatusData, setPOStatusData] = useState<Array<{ name: string; count: number }>>([])
  const [ticketTrend, setTicketTrend] = useState<Array<{ day: string; opened: number; closed: number }>>([])
  const chartPalette = ["#93c5fd", "#86efac", "#fde68a", "#c4b5fd", "#fbcfe8", "#99f6e4", "#bfdbfe"]

  useEffect(() => {
    let mounted = true

    async function loadData() {
      try {
        const [allocationsRes, ordersRes, ticketsRes, poList, inventoryRes] = await Promise.all([
          fetch("/api/db/petty-cash-allocations").then(r => r.json()).catch(() => []),
          fetch("/api/db/orders").then(r => r.json()).catch(() => []),
          fetch("/api/db/tickets").then(r => r.json()).catch(() => []),
          getPOs().catch(() => []),
          fetch("/api/inventory/stock").then(r => r.json()).catch(() => []),
        ])

        if (!mounted) return

        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        const monthlyAllocations = (Array.isArray(allocationsRes) ? allocationsRes : []).filter((a: any) => {
          const d = new Date(a.allocatedAt)
          return !Number.isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear
        })

        const employeeMap = new Map<string, { amount: number; role: string }>()
        for (const item of monthlyAllocations) {
          const key = String(item.employeeName || "Unknown")
          const existing = employeeMap.get(key) || { amount: 0, role: String(item.employeeRole || "—") }
          employeeMap.set(key, { amount: existing.amount + (Number(item.amount) || 0), role: existing.role })
        }
        const pettyData = Array.from(employeeMap.entries())
          .map(([name, val]) => ({ name, amount: val.amount, role: val.role }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8)
        setPettyCashByEmployee(pettyData)

        const dayStart = new Date(now)
        dayStart.setHours(0, 0, 0, 0)
        const deliveredDayMap = new Map<string, { amount: number; orderIds: string[] }>()
        const inventoryDayMap = new Map<string, { quantity: number; names: string[] }>()
        const ticketDayMap = new Map<string, { opened: number; closed: number }>()
        for (let i = rangeDays - 1; i >= 0; i--) {
          const d = new Date(dayStart)
          d.setDate(dayStart.getDate() - i)
          const key = d.toISOString().slice(0, 10)
          deliveredDayMap.set(key, { amount: 0, orderIds: [] })
          inventoryDayMap.set(key, { quantity: 0, names: [] })
          ticketDayMap.set(key, { opened: 0, closed: 0 })
        }

        for (const order of Array.isArray(ordersRes) ? ordersRes : []) {
          const dateRaw = order.fulfillmentDate || order.deliveryDate || order.createdAt || order.created_at
          if (!dateRaw) continue
          const d = new Date(dateRaw)
          if (Number.isNaN(d.getTime())) continue
          d.setHours(0, 0, 0, 0)
          const key = d.toISOString().slice(0, 10)
          if (!deliveredDayMap.has(key)) continue
          if (String(order.status || "").toLowerCase() === "delivered") {
            const prev = deliveredDayMap.get(key) || { amount: 0, orderIds: [] }
            deliveredDayMap.set(key, {
              amount: prev.amount + (Number(order.total) || 0),
              orderIds: [...prev.orderIds, String(order.orderNumber || order.id || "—")],
            })
          }
        }

        const deliveredSeries = Array.from(deliveredDayMap.entries()).map(([key, value]) => ({
          day: new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          amount: value.amount,
          orderIds: value.orderIds,
        }))
        setDeliveredTrend(deliveredSeries)
        setDeliveredTotal(deliveredSeries.reduce((sum, row) => sum + row.amount, 0))
        setDeliveredCount((Array.isArray(ordersRes) ? ordersRes : []).filter((o: any) => String(o.status || "").toLowerCase() === "delivered").length)

        const inventoryItems = Array.isArray(inventoryRes)
          ? inventoryRes
          : (Array.isArray((inventoryRes as any)?.data) ? (inventoryRes as any).data : [])

        for (const item of inventoryItems) {
          const createdRaw = item.createdAt || item.created_at
          const d = new Date(createdRaw)
          if (Number.isNaN(d.getTime())) continue
          d.setHours(0, 0, 0, 0)
          const key = d.toISOString().slice(0, 10)
          if (!inventoryDayMap.has(key)) continue
          const prev = inventoryDayMap.get(key) || { quantity: 0, names: [] }
          inventoryDayMap.set(key, {
            quantity: prev.quantity + (Number(item.receivedQty || item.received_qty || item.availableQty || item.available_qty || 0)),
            names: [...prev.names, String(item.description || item.name || "Inventory item")],
          })
        }
        setInventoryTrend(
          Array.from(inventoryDayMap.entries()).map(([key, value]) => ({
            day: new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            quantity: value.quantity,
            names: value.names,
          }))
        )

        const poStatus = Array.isArray(poList) ? poList : []
        setPOStatusData([
          { name: "Pending", count: poStatus.filter((p: any) => p.status === "sent_to_admin" || p.status === "imp_pending_approval").length },
          { name: "Approved", count: poStatus.filter((p: any) => p.status === "approved" || p.status === "finalized" || p.status === "imp_approved").length },
          { name: "Received", count: poStatus.filter((p: any) => p.status === "in_inventory" || p.status === "imp_inventory").length },
          { name: "Draft", count: poStatus.filter((p: any) => p.status === "draft" || p.status === "imp_admin_draft").length },
          { name: "Rejected", count: poStatus.filter((p: any) => p.status === "rejected" || p.status === "imp_rejected").length },
        ])

        for (const ticket of Array.isArray(ticketsRes) ? ticketsRes : []) {
          const created = new Date(ticket.createdAt || ticket.created_at)
          if (!Number.isNaN(created.getTime())) {
            created.setHours(0, 0, 0, 0)
            const key = created.toISOString().slice(0, 10)
            if (ticketDayMap.has(key)) {
              const prev = ticketDayMap.get(key)!
              ticketDayMap.set(key, { ...prev, opened: prev.opened + 1 })
            }
          }
          const closedAt = ticket.closedAt || ticket.closed_at
          if (closedAt) {
            const closed = new Date(closedAt)
            if (!Number.isNaN(closed.getTime())) {
              closed.setHours(0, 0, 0, 0)
              const key = closed.toISOString().slice(0, 10)
              if (ticketDayMap.has(key)) {
                const prev = ticketDayMap.get(key)!
                ticketDayMap.set(key, { ...prev, closed: prev.closed + 1 })
              }
            }
          }
        }
        setTicketTrend(
          Array.from(ticketDayMap.entries()).map(([key, value]) => ({
            day: new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            opened: value.opened,
            closed: value.closed,
          }))
        )
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadData()
    const interval = setInterval(loadData, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [rangeDays])

  return (
    <DashboardSection
      title="Analytics"
      description={`Trends and activity for the last ${rangeDays} days`}
      action={<RangeToggle value={rangeDays} onChange={setRangeDays} />}
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Delivered order amount"
          subtitle={`Revenue from delivered orders`}
          tall
          footer={
            <span className="flex flex-wrap gap-4 justify-between">
              <span><strong className="text-[hsl(var(--foreground))]">{formatRsFull(deliveredTotal)}</strong> delivered</span>
              <span><strong className="text-[hsl(var(--foreground))]">{deliveredCount}</strong> orders</span>
            </span>
          }
        >
          {loading ? (
            <ChartLoading />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={deliveredTrend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="miniDeliveredFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1faca6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1faca6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={formatRsAxis} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={42} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value) => formatRsFull(Number(value ?? 0))}
                  labelFormatter={(label, payload) => {
                    const ids = ((payload?.[0]?.payload as { orderIds?: string[] } | undefined)?.orderIds || [])
                      .slice(0, 3)
                      .join(", ")
                    const day = String(label ?? "")
                    return ids ? `${day} · ${ids}` : day
                  }}
                />
                <Area type="monotone" dataKey="amount" stroke="#1faca6" strokeWidth={2.5} fill="url(#miniDeliveredFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Inventory added" subtitle="Stock received over time" tall>
          {loading ? (
            <ChartLoading />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inventoryTrend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => `${Number(v ?? 0).toLocaleString()} qty`} />
                <Line type="monotone" dataKey="quantity" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Petty cash" subtitle="Allocations this month">
          {loading ? (
            <ChartLoading />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pettyCashByEmployee.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatRsAxis} />
                <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => String(v).split(" ").slice(0, 2).join(" ")} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatRsFull(Number(v ?? 0))} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {pettyCashByEmployee.slice(0, 6).map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={chartPalette[idx % chartPalette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="PO status" subtitle="Distribution by status">
          {loading ? (
            <ChartLoading />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={poStatusData} dataKey="count" nameKey="name" innerRadius={36} outerRadius={72} paddingAngle={3} onClick={() => { window.location.href = "/purchase" }}>
                  {poStatusData.map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={chartPalette[idx % chartPalette.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Support tickets" subtitle="Opened vs closed">
          {loading ? (
            <ChartLoading />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ticketTrend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="opened" stroke="#f59e0b" fill="#f59e0b22" strokeWidth={2} />
                <Area type="monotone" dataKey="closed" stroke="#10b981" fill="#10b98118" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </DashboardSection>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [approvalTab, setApprovalTab] = useState<"orders" | "po" | "transfers" | "petty">("orders")
  const [showPOFilters, setShowPOFilters] = useState(false)
  const [showApprovals, setShowApprovals] = useState(true)
  const branchTransferPending = useBranchTransferPendingCount()
  const pettyCashPending = usePettyCashPendingCount()

  if (!user) return null

  if (user.role !== "superadmin") {
    return (
      <>
        <Topbar title="Dashboard" description={`Welcome, ${user.name}`} />
        <ComingSoon title="Dashboard" />
      </>
    )
  }

  return (
    <>
      <Topbar
        title="Dashboard"
        description={`Welcome, ${user.name}`}
        action={<UsersPanel />}
      />
      <DashboardShell>
        <div className="flex items-center gap-3 rounded-2xl border border-[#1faca6]/20 bg-gradient-to-r from-[#1faca6]/10 via-[hsl(var(--card))] to-[hsl(var(--card))] px-4 py-3 shadow-sm">
          <div className="rounded-xl bg-[#1faca6]/15 p-2.5">
            <LayoutDashboard className="h-5 w-5 text-[#1faca6]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Executive overview</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Live metrics, trends, and pending approvals for Voltrix Batteries
            </p>
          </div>
        </div>

        <ERPStats />
        <FinanceAndOpsMiniCharts />

        <section className="rounded-2xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/[0.12]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-xl bg-amber-500/15 p-2.5 shrink-0">
                <ClipboardCheck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-base font-semibold text-[hsl(var(--foreground))]">Approvals</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  CRM orders · Purchase orders · Branch transfers · Petty cash
                </p>
              </div>
              {pettyCashPending > 0 && (
                <span className="shrink-0 text-[11px] font-bold rounded-full bg-amber-500 text-white px-2.5 py-1">
                  {pettyCashPending} petty cash
                </span>
              )}
              {branchTransferPending > 0 && (
                <span className="shrink-0 text-[11px] font-bold rounded-full bg-[#1faca6] text-white px-2.5 py-1">
                  {branchTransferPending} transfers
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant={showApprovals ? "outline" : "default"}
              className="h-9 px-4 text-xs shrink-0"
              onClick={() => setShowApprovals((prev) => !prev)}
            >
              {showApprovals ? "Collapse" : "Expand"}
            </Button>
          </div>

          {showApprovals && (
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))]/50 mb-5">
                {(
                  [
                    { id: "orders" as const, label: "CRM Orders" },
                    { id: "po" as const, label: "Purchase Orders" },
                    { id: "transfers" as const, label: "Branch Transfers", count: branchTransferPending },
                    { id: "petty" as const, label: "Petty Cash", count: pettyCashPending },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setApprovalTab(tab.id)}
                    className={`shrink-0 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      approvalTab === tab.id
                        ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-[#1faca6]/30"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {tab.label}
                    {"count" in tab && tab.count > 0 && (
                      <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))]/50 bg-[hsl(var(--background))]/50 p-3 sm:p-4 min-h-[200px]">
                {approvalTab === "orders" ? (
                  <ClientOrdersApproval />
                ) : approvalTab === "po" ? (
                  <POsWidget showFilters={showPOFilters} setShowFilters={setShowPOFilters} />
                ) : approvalTab === "transfers" ? (
                  <DashboardBranchTransferApprovals />
                ) : (
                  <DashboardPettyCashApprovals />
                )}
              </div>
            </div>
          )}
        </section>
      </DashboardShell>
    </>
  )
}
