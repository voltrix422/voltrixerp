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
        <div className="flex gap-1">
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

export default function DashboardPage() {
  const { user } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)
  const [openFirstPending, setOpenFirstPending] = useState<(() => void) | null>(null)
  const [activeTab, setActiveTab] = useState<"orders" | "pos">("orders")
  const [showFilters, setShowFilters] = useState(false)

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
        pendingCount={pendingCount}
        onPendingClick={() => openFirstPending?.()}
      />
      <div className="flex-1 overflow-auto bg-[hsl(var(--background))]">
        <div className="p-8 max-w-7xl">
          {/* ERP Stats Overview */}
          <ERPStats />

          {/* Tabs */}
          <div className="flex items-center justify-between mb-2 px-6">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("orders")}
                className={`px-4 py-3 text-sm font-medium transition-colors relative cursor-pointer ${
                  activeTab === "orders"
                    ? "text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                Client Orders
                {activeTab === "orders" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a9f9a]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("pos")}
                className={`px-4 py-3 text-sm font-medium transition-colors relative cursor-pointer ${
                  activeTab === "pos"
                    ? "text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                Purchase Orders
                {activeTab === "pos" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a9f9a]" />
                )}
              </button>
            </div>
            {activeTab === "pos" && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="bg-[hsl(var(--card))] p-6 rounded-xl mt-2">
            {activeTab === "orders" && <ClientOrdersApproval />}
            {activeTab === "pos" && (
              <POsWidget showFilters={showFilters} setShowFilters={setShowFilters} onPendingChange={(count, openFirst) => {
                setPendingCount(count)
                setOpenFirstPending(() => openFirst)
              }} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
