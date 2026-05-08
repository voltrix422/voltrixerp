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
import { Users, Building2, Package, FileText, ShoppingCart, BarChart3, DollarSign } from "lucide-react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

        // Calculate finance total for current month
        const now = new Date()
        const financeTotal = Array.isArray(financeRes)
          ? financeRes
              .filter((r: any) => {
                const date = new Date(r.date)
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
          ? clientOrdersRes.reduce((sum: number, order: any) => sum + (Number(order.totalAmount) || 0), 0)
          : 0

        setStats({
          staff: Array.isArray(staffRes) ? staffRes.length : 0,
          clients: Array.isArray(clientsRes) ? clientsRes.length : 0,
          products: Array.isArray(productsRes) ? productsRes.length : 0,
          quotations: Array.isArray(quotationsRes) ? quotationsRes.length : 0,
          orders: Array.isArray(ordersRes) ? ordersRes.length : 0,
          inventoryItems: Array.isArray(inventoryRes) ? inventoryRes.length : 0,
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

  const statCards = [
    { label: "Staff", value: stats.staff, icon: Users, color: "text-blue-500", bgColor: "bg-blue-50", href: "/hrm" },
    { label: "Clients", value: stats.clients, icon: Building2, color: "text-purple-500", bgColor: "bg-purple-50", href: "/crm" },
    { label: "Products", value: stats.products, icon: Package, color: "text-orange-500", bgColor: "bg-orange-50", href: "/website" },
    { label: "Quotations", value: stats.quotations, icon: FileText, color: "text-green-500", bgColor: "bg-green-50", href: "/website" },
    { label: "Orders", value: stats.orders, icon: ShoppingCart, color: "text-pink-500", bgColor: "bg-pink-50", href: "/dashboard" },
    { label: "Inventory", value: stats.inventoryItems, icon: BarChart3, color: "text-cyan-500", bgColor: "bg-cyan-50", href: "/inventory" },
    { label: "Expenses This Month", value: formatCurrency(stats.financeTotal), icon: DollarSign, color: "text-emerald-500", bgColor: "bg-emerald-50", href: "/finance" },
    { label: "Total POs", value: formatCurrency(stats.totalPOValue), icon: DollarSign, color: "text-amber-500", bgColor: "bg-amber-50", href: "/purchase" },
    { label: "Total Orders", value: formatCurrency(stats.totalOrdersValue), icon: DollarSign, color: "text-rose-500", bgColor: "bg-rose-50", href: "/dashboard" },
  ]

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="rounded-lg border border-[hsl(var(--border))]/50 bg-[hsl(var(--card))] overflow-hidden">
        <div className="grid grid-cols-9 divide-x divide-[hsl(var(--border))]/50">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.label} href={card.href} className="block">
                <div className="p-2 text-center hover:bg-[hsl(var(--muted))]/10 transition-colors cursor-pointer">
                  <p className="text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{card.label}</p>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] tabular-nums tracking-tight mt-0.5">
                    {loading ? "—" : card.value}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type DeliveredChartPoint = {
  label: string
  amount: number
}

function DeliveredOrdersAmountChart() {
  const [orders, setOrders] = useState<Array<{ status?: string; total?: number; createdAt?: string; deliveryDate?: string; fulfillmentDate?: string }>>([])
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadOrders() {
      try {
        const data = await fetch("/api/db/orders").then(r => r.json()).catch(() => [])
        if (!mounted) return
        setOrders(Array.isArray(data) ? data : [])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadOrders()
    const interval = setInterval(loadOrders, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)

  const byDay = new Map<string, number>()
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(dayStart)
    d.setDate(dayStart.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    byDay.set(key, 0)
  }

  for (const order of orders) {
    if (order.status !== "delivered") continue
    const sourceDate = order.fulfillmentDate || order.deliveryDate || order.createdAt
    if (!sourceDate) continue

    const d = new Date(sourceDate)
    if (Number.isNaN(d.getTime())) continue
    d.setHours(0, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    if (!byDay.has(key)) continue
    byDay.set(key, (byDay.get(key) || 0) + (Number(order.total) || 0))
  }

  const data: DeliveredChartPoint[] = Array.from(byDay.entries()).map(([dateKey, amount]) => {
    const d = new Date(dateKey)
    return {
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      amount,
    }
  })

  const totalAmount = data.reduce((sum, p) => sum + p.amount, 0)
  const deliveredCount = orders.filter(o => o.status === "delivered").length

  return (
    <div className="mt-4 rounded-xl border border-[hsl(var(--border))]/50 bg-[hsl(var(--card))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Delivered Order Amount</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Delivered value trend for the last {rangeDays} days
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-[hsl(var(--muted))]/20 p-1">
          {([7, 14, 30] as const).map(days => (
            <button
              key={days}
              onClick={() => setRangeDays(days)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors cursor-pointer ${
                rangeDays === days
                  ? "bg-[#1faca6] text-white"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {days}D
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Delivered Amount</p>
          <p className="text-sm font-bold mt-0.5">Rs. {totalAmount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Delivered Orders</p>
          <p className="text-sm font-bold mt-0.5">{deliveredCount}</p>
        </div>
      </div>

      <div className="mt-4 h-64 w-full">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
            Loading chart...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="deliveredAmountFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1faca6" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#1faca6" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value) => `Rs ${Number(value).toLocaleString()}`}
              />
              <Tooltip
                formatter={(value) => `Rs. ${Number(value ?? 0).toLocaleString()}`}
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#1faca6"
                strokeWidth={2.5}
                fill="url(#deliveredAmountFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

type MiniChartCardProps = {
  title: string
  subtitle: string
  children: React.ReactNode
}

function MiniChartCard({ title, subtitle, children }: MiniChartCardProps) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))]/60 bg-[hsl(var(--card))] p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{subtitle}</p>
      </div>
      <div className="h-48">{children}</div>
    </div>
  )
}

function FinanceAndOpsMiniCharts() {
  const [loading, setLoading] = useState(true)
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14)
  const [pettyCashByEmployee, setPettyCashByEmployee] = useState<Array<{ name: string; amount: number; role: string }>>([])
  const [orderTrend, setOrderTrend] = useState<Array<{ day: string; amount: number }>>([])
  const [poStatusData, setPOStatusData] = useState<Array<{ name: string; count: number }>>([])
  const [ticketStatusData, setTicketStatusData] = useState<Array<{ name: string; value: number; color: string }>>([])

  useEffect(() => {
    let mounted = true

    async function loadData() {
      try {
        const [allocationsRes, ordersRes, ticketsRes, poList] = await Promise.all([
          fetch("/api/db/petty-cash-allocations").then(r => r.json()).catch(() => []),
          fetch("/api/db/orders").then(r => r.json()).catch(() => []),
          fetch("/api/db/tickets").then(r => r.json()).catch(() => []),
          getPOs().catch(() => []),
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
        const dayMap = new Map<string, number>()
        for (let i = rangeDays - 1; i >= 0; i--) {
          const d = new Date(dayStart)
          d.setDate(dayStart.getDate() - i)
          dayMap.set(d.toISOString().slice(0, 10), 0)
        }

        for (const order of Array.isArray(ordersRes) ? ordersRes : []) {
          const dateRaw = order.createdAt || order.created_at
          if (!dateRaw) continue
          const d = new Date(dateRaw)
          if (Number.isNaN(d.getTime())) continue
          d.setHours(0, 0, 0, 0)
          const key = d.toISOString().slice(0, 10)
          if (!dayMap.has(key)) continue
          dayMap.set(key, (dayMap.get(key) || 0) + (Number(order.total) || 0))
        }

        setOrderTrend(
          Array.from(dayMap.entries()).map(([key, amount]) => ({
            day: new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            amount,
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

        const tickets = Array.isArray(ticketsRes) ? ticketsRes : []
        const open = tickets.filter((t: any) => t.status === "open").length
        const closed = tickets.filter((t: any) => t.status === "closed").length
        const fulfilled = tickets.filter((t: any) => ["fulfilled", "resolved", "done"].includes(String(t.status || "").toLowerCase())).length
        setTicketStatusData([
          { name: "Open", value: open, color: "#f59e0b" },
          { name: "Closed", value: closed, color: "#10b981" },
          { name: "Fulfilled", value: fulfilled, color: "#3b82f6" },
        ])
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
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <MiniChartCard
        title="Petty Cash Allocations"
        subtitle={`Current month by employee (hover for details)`}
      >
        <div className="mb-2 flex items-center justify-end gap-1">
          {([7, 14, 30] as const).map((days) => (
            <button
              key={days}
              onClick={() => setRangeDays(days)}
              className={`px-2 py-0.5 text-[10px] rounded border ${
                rangeDays === days
                  ? "bg-[#1faca6] text-white border-[#1faca6]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {days}D
            </button>
          ))}
        </div>
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">Loading petty cash...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pettyCashByEmployee} margin={{ top: 5, right: 15, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={50} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={(v) => `Rs ${Number(v).toLocaleString()}`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                formatter={(value: any) => `Rs. ${Number(value).toLocaleString()}`}
                labelFormatter={(label: any, payload: any) => `${label} (${payload?.[0]?.payload?.role || "—"})`}
              />
              <Bar dataKey="amount" fill="#1faca6" radius={[6, 6, 0, 0]} onClick={() => { window.location.href = "/finance" }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </MiniChartCard>

      <MiniChartCard
        title="Order Amount Trend"
        subtitle={`Last ${rangeDays} days total order values`}
      >
        <div className="mb-2 flex items-center justify-end gap-1">
          {([7, 14, 30] as const).map((days) => (
            <button
              key={days}
              onClick={() => setRangeDays(days)}
              className={`px-2 py-0.5 text-[10px] rounded border ${
                rangeDays === days
                  ? "bg-[#1faca6] text-white border-[#1faca6]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {days}D
            </button>
          ))}
        </div>
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">Loading order trend...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={orderTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `Rs ${Number(v).toLocaleString()}`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: any) => `Rs. ${Number(value).toLocaleString()}`} />
              <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 2 }} onClick={() => { window.location.href = "/crm" }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </MiniChartCard>

      <MiniChartCard
        title="PO Status Graph"
        subtitle="Pending, approved, received, draft, rejected"
      >
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">Loading PO status...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={poStatusData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} onClick={() => { window.location.href = "/purchase" }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </MiniChartCard>

      <MiniChartCard
        title="Tickets Overview"
        subtitle="Open, closed and fulfilled tickets"
      >
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">Loading tickets...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ticketStatusData}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
                onClick={() => { window.location.href = "/tickets" }}
              >
                {ticketStatusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconSize={9} wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </MiniChartCard>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [approvalTab, setApprovalTab] = useState<"po" | "orders">("po")
  const [showPOFilters, setShowPOFilters] = useState(false)

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
      <div className="flex-1 overflow-auto bg-[hsl(var(--background))]">
        <div className="p-8 max-w-7xl">
                    
          {/* ERP Stats Overview */}
          <ERPStats />
          <DeliveredOrdersAmountChart />
          <FinanceAndOpsMiniCharts />

          {/* Approval Flow Section */}
          <div className="bg-[hsl(var(--card))] p-6 rounded-xl mt-2">
            <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] pb-2 mb-4">
              <button
                onClick={() => setApprovalTab("po")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  approvalTab === "po"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/40"
                }`}
              >
                PO Confirmation
              </button>
              <button
                onClick={() => setApprovalTab("orders")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  approvalTab === "orders"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/40"
                }`}
              >
                Order CRM Confirmation
              </button>
            </div>

            {approvalTab === "po" ? (
              <POsWidget
                showFilters={showPOFilters}
                setShowFilters={setShowPOFilters}
              />
            ) : (
              <ClientOrdersApproval />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
