"use client"
import { useState, useEffect, useRef } from "react"
import { getPOs, savePO, deletePO, getSuppliers, STATUS_LABELS, STATUS_VARIANT, type PurchaseOrder, type Supplier } from "@/lib/purchase"
import { supabase } from "@/lib/supabase"
import { type User } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { POForm } from "@/components/purchase/po-form"
import { PODetail } from "@/components/purchase/po-detail"
import { DirectPOForm } from "@/components/purchase/direct-po-form"
import { ImportedPODetail } from "@/components/purchase/imported-po-detail"
import { useDialog } from "@/components/ui/dialog-provider"
import { Plus, Trash2, Loader2, ChevronDown } from "lucide-react"

interface Props { user: User | null }

export function POsTab({ user }: Props) {
  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<"local" | "imported">("local")
  const [showDirectForm, setShowDirectForm] = useState(false)
  const [showDropdown, setShowDropdown] = useState<"local" | "imported" | null>(null)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const adminDropdownRef = useRef<HTMLDivElement>(null)
  const { confirm } = useDialog()

  useEffect(() => {
    Promise.all([getPOs(), getSuppliers()]).then(([p, s]) => {
      setPOs(p); setSuppliers(s); setLoading(false)
    })

    // Realtime for POs
    const channel = supabase
      .channel("purchase_orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "erp_purchase_orders" }, () => {
        getPOs().then(setPOs)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const clickedOutsideNonAdmin = dropdownRef.current && !dropdownRef.current.contains(target)
      const clickedOutsideAdmin = adminDropdownRef.current && !adminDropdownRef.current.contains(target)
      
      if (clickedOutsideNonAdmin && clickedOutsideAdmin) {
        setShowDropdown(null)
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showDropdown])

  const isAdmin = user?.role === "superadmin"

  async function handleCreate(data: Omit<PurchaseOrder, "id">) {
    const newPO: PurchaseOrder = { ...data, id: Date.now().toString() }
    await savePO(newPO)
    setPOs(prev => [newPO, ...prev])
    setShowForm(false)
  }

  async function handleUpdate(updated: PurchaseOrder) {
    await savePO(updated)
    setPOs(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSelectedPO(updated)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await confirm({
      type: "confirm",
      title: "Delete Purchase Order",
      message: "This action cannot be undone. The PO will be permanently removed.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    })
    if (!ok) return
    await deletePO(id)
    setPOs(prev => prev.filter(p => p.id !== id))
    if (selectedPO?.id === id) setSelectedPO(null)
  }

  return (
    <div className="p-6 space-y-4">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{pos.length} order{pos.length !== 1 ? "s" : ""}</p>
            <div className="flex gap-2">
              {!isAdmin && (
                <div className="relative" ref={dropdownRef}>
                  <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowDropdown(showDropdown === "local" ? null : "local")}>
                    <Plus className="h-3.5 w-3.5" /> Local PO <ChevronDown className="h-3 w-3" />
                  </Button>
                  {showDropdown === "local" && (
                    <div className="absolute right-0 top-9 z-20 w-44 rounded-lg border bg-[hsl(var(--card))] shadow-lg overflow-hidden">
                      <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors"
                        onClick={() => { setFormType("local"); setShowForm(true); setShowDropdown(null) }}>
                        <p className="font-medium">Detail PO</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Multi-supplier, quotes, approval</p>
                      </button>
                      <div className="border-t" />
                      <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors"
                        onClick={() => { setShowDirectForm(true); setShowDropdown(null) }}>
                        <p className="font-medium">Direct PO</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">One supplier, goes to Finance</p>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {isAdmin && (
                <>
                  <div className="relative" ref={adminDropdownRef}>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setShowDropdown(showDropdown === "local" ? null : "local")}>
                      <Plus className="h-3.5 w-3.5" /> Local PO <ChevronDown className="h-3 w-3" />
                    </Button>
                    {showDropdown === "local" && (
                      <div className="absolute right-0 top-9 z-20 w-44 rounded-lg border bg-[hsl(var(--card))] shadow-lg overflow-hidden">
                        <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors"
                          onClick={() => { setFormType("local"); setShowForm(true); setShowDropdown(null) }}>
                          <p className="font-medium">Detail PO</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Multi-supplier, quotes, approval</p>
                        </button>
                        <div className="border-t" />
                        <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors"
                          onClick={() => { setShowDirectForm(true); setShowDropdown(null) }}>
                          <p className="font-medium">Direct PO</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">One supplier, goes to Finance</p>
                        </button>
                      </div>
                    )}
                  </div>
                  <Button size="sm" className="h-8 text-xs" onClick={async () => {
                    const { generatePONumber } = await import("@/lib/purchase")
                    const poNumber = await generatePONumber()
                    const newPO: PurchaseOrder = {
                      id: Date.now().toString(),
                      poNumber,
                      type: "imported",
                      supplierIds: [], supplierNames: [],
                      items: [], notes: "", status: "imp_admin_draft",
                      createdBy: user!.name, createdAt: new Date().toISOString(),
                      adminNote: "", sentToSupplier: false, deliveryDate: "",
                      receivingLocation: "", suppliersSent: [], quotes: [],
                      payments: [], adminDocuments: [], financeDocuments1: [],
                      purchaseDocuments: [], financeDocuments2: [],
                      importedItems: [], flowHistory: [],
                    }
                    await savePO(newPO)
                    setPOs(prev => [newPO, ...prev])
                    setSelectedPO(newPO)
                  }}>
                    <Plus className="h-3.5 w-3.5" /> Imported PO
                  </Button>
                </>
              )}
            </div>
          </div>

          {pos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-medium">No purchase orders</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Create your first PO using the button above.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-[hsl(var(--muted))]/40">
                    {["PO #", "Supplier", "Type", "Items", "Date", "Status", ""].map(h => (
                      <th key={h} className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pos.map(po => (
                    <tr key={po.id} onClick={() => setSelectedPO(po)}
                      className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer">
                      <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{po.poNumber}</td>
                      <td className="px-4 py-2.5 text-xs font-medium">{po.supplierNames.join(", ")}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={po.type === "local" ? "success" : "info"} className="text-[10px] px-1.5 py-0">{po.type}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.items.length}</td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={STATUS_VARIANT[po.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[po.status]}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(var(--muted-foreground))] hover:text-red-500"
                          onClick={e => handleDelete(po.id, e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showForm && user && (
        <POForm type={formType} createdBy={user.name} onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {showDirectForm && user && (
        <DirectPOForm
          suppliers={suppliers}
          createdBy={user.name}
          onSave={async (data) => {
            const newPO: PurchaseOrder = { ...data, id: Date.now().toString() }
            await savePO(newPO)
            setPOs(prev => [newPO, ...prev])
            setShowDirectForm(false)
          }}
          onCancel={() => setShowDirectForm(false)}
        />
      )}

      {selectedPO && selectedPO.type === "imported" && (
        <ImportedPODetail
          po={selectedPO}
          isAdmin={isAdmin}
          role={isAdmin ? "admin" : user?.modules?.includes("finance") ? "finance" : "purchase"}
          onClose={() => setSelectedPO(null)}
          onUpdate={handleUpdate}
        />
      )}

      {selectedPO && selectedPO.type !== "imported" && (
        <PODetail
          po={selectedPO}
          allSuppliers={suppliers}
          isAdmin={isAdmin}
          onClose={() => setSelectedPO(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
