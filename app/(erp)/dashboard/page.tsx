"use client"
import { useState, useEffect } from "react"
import { Topbar } from "@/components/layout/topbar"
import { UsersPanel } from "@/components/layout/users-panel"
import { useAuth } from "@/components/auth-provider"
import { getPOs, savePO, getSuppliers, STATUS_LABELS, STATUS_VARIANT, type PurchaseOrder, type Supplier } from "@/lib/purchase"
// DB access via /api/db routes (Prisma)
import { PODetail } from "@/components/purchase/po-detail"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ComingSoon } from "@/components/layout/coming-soon"
import { Eye } from "lucide-react"

import { useToast } from "@/components/ui/toast"
import { ClientOrdersApproval } from "@/components/dashboard/client-orders-approval"

function POsWidget({ onPendingChange }: { onPendingChange?: (count: number, openFirst: () => void) => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [notified, setNotified] = useState(false)
  const [subTab, setSubTab] = useState<"pending" | "approved" | "draft" | "rejected" | "received">("pending")
  const [showFilters, setShowFilters] = useState(false)
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
      <div className="space-y-3 my-4">
        {/* Filters */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-md cursor-pointer transition-all border ${
              showFilters
                ? "bg-[#1faca6] border-[#1faca6] text-white shadow-sm hover:bg-[#1a968f]"
                : "bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>Filters</span>
            {showFilters ? (
              <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-2.5 space-y-2">
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

        {/* Sub-tabs */}
        <div className="flex gap-1 border-b border-[hsl(var(--border))]">
          {(["pending", "approved", "received", "draft", "rejected"] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                subTab === t
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {t === "pending" ? "Pending" : t === "approved" ? "Approved" : t === "received" ? "Received" : t === "draft" ? "Draft" : "Rejected"}
              <span className="ml-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                ({t === "pending" ? filteredPending.length : t === "approved" ? filteredApproved.length : t === "received" ? filteredReceived.length : t === "draft" ? filteredDraft.length : filteredRejected.length})
              </span>
              {subTab === t && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          ))}
        </div>

        {displayPOs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {subTab === "pending" ? "No pending purchase orders" : subTab === "received" ? "No received purchase orders in inventory" : "No approved purchase orders"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[hsl(var(--muted))]/40">
                  {["PO #", "Supplier", "Type", "Items", "Created By", "Date", "Status"].map(h => (
                    <th key={h} className="h-8 px-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
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

export default function DashboardPage() {
  const { user } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)
  const [openFirstPending, setOpenFirstPending] = useState<(() => void) | null>(null)
  const [activeTab, setActiveTab] = useState<"orders" | "pos">("orders")

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
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-4">
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                activeTab === "orders"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Client Orders
              {activeTab === "orders" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("pos")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                activeTab === "pos"
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Purchase Orders
              {activeTab === "pos" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "orders" && <ClientOrdersApproval />}
          {activeTab === "pos" && (
            <POsWidget onPendingChange={(count, openFirst) => {
              setPendingCount(count)
              setOpenFirstPending(() => openFirst)
            }} />
          )}
        </div>
      </div>
    </>
  )
}
