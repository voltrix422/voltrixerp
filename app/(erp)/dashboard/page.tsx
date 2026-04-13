"use client"
import { useState, useEffect } from "react"
import { Topbar } from "@/components/layout/topbar"
import { UsersPanel } from "@/components/layout/users-panel"
import { useAuth } from "@/components/auth-provider"
import { getPOs, savePO, getSuppliers, STATUS_LABELS, STATUS_VARIANT, type PurchaseOrder, type Supplier } from "@/lib/purchase"
import { supabase } from "@/lib/supabase"
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

  useEffect(() => {
    Promise.all([getPOs(), getSuppliers()]).then(([p, s]) => {
      setPOs(p); setSuppliers(s)
    })
    const channel = supabase
      .channel("dashboard_pos")
      .on("postgres_changes", { event: "*", schema: "public", table: "erp_purchase_orders" }, () => {
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
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
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

  const recent = pos.slice(0, 8)

  return (
    <>
      <div className="space-y-3">
        {pos.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No purchase orders yet</p>
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
                {recent.map(po => (
                  <tr key={po.id} className="hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer" onClick={() => setSelected(po)}>
                    <td className="px-4 py-2.5 font-medium text-[hsl(var(--primary))]">{po.poNumber}</td>
                    <td className="px-4 py-2.5 text-xs">{po.supplierNames.join(", ")}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={po.type === "local" ? "success" : "info"} className="text-[10px] px-1.5 py-0">{po.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.items.length}</td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.createdBy}</td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{new Date(po.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[po.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[po.status]}</Badge>
                    </td>
                  </tr>
                ))}
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
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
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
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
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
