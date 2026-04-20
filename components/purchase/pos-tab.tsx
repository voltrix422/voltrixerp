"use client"
import { useState, useEffect, useRef } from "react"
import { getPOs, savePO, deletePO, getSuppliers, STATUS_LABELS, STATUS_VARIANT, type PurchaseOrder, type Supplier } from "@/lib/purchase"
// DB access via /api/db routes (Prisma)
import { type User } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { POForm } from "@/components/purchase/po-form"
import { PODetail } from "@/components/purchase/po-detail"
import { DirectPOForm } from "@/components/purchase/direct-po-form"
import { ImportedPODetail } from "@/components/purchase/imported-po-detail"
import { useDialog } from "@/components/ui/dialog-provider"
import { Plus, Trash2, Loader2, ChevronDown, Download } from "lucide-react"
import { downloadPO } from "@/lib/po-download"

interface Props { user: User | null }

export function POsTab({ user }: Props) {
  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<"local" | "imported">("local")
  const [showDirectForm, setShowDirectForm] = useState(false)
  const [showDropdown, setShowDropdown] = useState<"local" | "imported" | null>(null)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [downloadMenuPO, setDownloadMenuPO] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<"pending" | "approved" | "draft" | "rejected" | "received" | "direct" | "imported">("pending")
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const adminDropdownRef = useRef<HTMLDivElement>(null)
  const { confirm } = useDialog()

  useEffect(() => {
    Promise.all([getPOs(), getSuppliers()]).then(([p, s]) => {
      setPOs(p); setSuppliers(s); setLoading(false)
    })

    // Poll for PO changes (replaces Supabase realtime)
    const interval = setInterval(() => getPOs().then(setPOs), 30000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const clickedOutsideNonAdmin = dropdownRef.current && !dropdownRef.current.contains(target)
      const clickedOutsideAdmin = adminDropdownRef.current && !adminDropdownRef.current.contains(target)

      if (clickedOutsideNonAdmin && showDropdown === "local") {
        setShowDropdown(null)
      }
      if (clickedOutsideAdmin && showDropdown === "local") {
        setShowDropdown(null)
      }
      setDownloadMenuPO(null)
    }
    if (showDropdown || downloadMenuPO) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showDropdown, downloadMenuPO])

  const isAdmin = user?.role === "superadmin";

  const pendingPOs = pos.filter(p => p.status === "sent_to_admin")
  const approvedPOs = pos.filter(p => p.status === "approved" || p.status === "finalized")
  const draftPOs = pos.filter(p => p.status === "draft")
  const rejectedPOs = pos.filter(p => p.status === "rejected")
  const receivedPOs = pos.filter(p => p.status === "in_inventory" || p.status === "imp_inventory")
  const directPOs = pos.filter(p => p.status === "direct" && p.type === "local")
  const importedPOs = pos.filter(p => p.type === "imported")

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
  const filteredDirect = filterPOs(directPOs)
  const filteredImported = filterPOs(importedPOs)

  const displayPOs = {
    pending: filteredPending,
    approved: filteredApproved,
    draft: filteredDraft,
    rejected: filteredRejected,
    received: filteredReceived,
    direct: filteredDirect,
    imported: filteredImported
  }[subTab]

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
    <div className="p-6 space-y-2">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      ) : (
        <>
          <div className="space-y-0 my-4">
            {/* Action buttons */}
            <div className="flex items-center justify-end">
            <div className="flex gap-2">
              {/* Filters */}
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
              {!isAdmin && (
                <div className="relative" ref={dropdownRef}>
                  <Button size="sm" className="h-8 text-xs gap-1 cursor-pointer" onClick={() => setShowDropdown(showDropdown === "local" ? null : "local")}>
                    <Plus className="h-3.5 w-3.5" /> Local PO <ChevronDown className="h-3 w-3" />
                  </Button>
                  {showDropdown === "local" && (
                    <div className="absolute right-0 top-9 z-20 w-44 rounded-lg border bg-[hsl(var(--card))] shadow-lg overflow-hidden">
                      <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors cursor-pointer"
                        onClick={() => { setFormType("local"); setShowForm(true); setShowDropdown(null) }}>
                        <p className="font-medium">Detail PO</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Multi-supplier, quotes, approval</p>
                      </button>
                      <div className="border-t" />
                      <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors cursor-pointer"
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
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 cursor-pointer" onClick={() => setShowDropdown(showDropdown === "local" ? null : "local")}>
                      <Plus className="h-3.5 w-3.5" /> Local PO <ChevronDown className="h-3 w-3" />
                    </Button>
                    {showDropdown === "local" && (
                      <div className="absolute right-0 top-9 z-20 w-44 rounded-lg border bg-[hsl(var(--card))] shadow-lg overflow-hidden">
                        <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors cursor-pointer"
                          onClick={() => { setFormType("local"); setShowForm(true); setShowDropdown(null) }}>
                          <p className="font-medium">Detail PO</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Multi-supplier, quotes, approval</p>
                        </button>
                        <div className="border-t" />
                        <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors cursor-pointer"
                          onClick={() => { setShowDirectForm(true); setShowDropdown(null) }}>
                          <p className="font-medium">Direct PO</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">One supplier, goes to Finance</p>
                        </button>
                      </div>
                    )}
                  </div>
                  <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={async () => {
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
            {(["pending", "approved", "received", "draft", "rejected", "direct", "imported"] as const).map(t => (
              <button key={t} onClick={() => setSubTab(t)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${
                  subTab === t
                    ? "text-[hsl(var(--foreground))] bg-[hsl(var(--muted))]/10"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/10"
                }`}>
                {t === "pending" ? "Pending" : t === "approved" ? "Approved" : t === "received" ? "Received" : t === "draft" ? "Draft" : t === "rejected" ? "Rejected" : t === "direct" ? "Direct" : "Imported"}
                <span className="ml-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                  ({t === "pending" ? filteredPending.length : t === "approved" ? filteredApproved.length : t === "received" ? filteredReceived.length : t === "draft" ? filteredDraft.length : t === "rejected" ? filteredRejected.length : t === "direct" ? filteredDirect.length : filteredImported.length})
                </span>
                {subTab === t && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {displayPOs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium">No purchase orders</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              {subTab === "received" ? "No received purchase orders in inventory" : "Create your first PO using the button above."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-[hsl(var(--muted))]/40">
                  {["PO #", "Supplier", "Type", "Items", "Created By", "Date", "Status", ""].map(h => (
                    <th key={h} className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{h}</th>
                  ))}
                </tr>
              </thead>
                <tbody className="divide-y">
                  {displayPOs.map(po => {
                    const poNumberDisplay = (po.poNumber && po.poNumber.trim()) ? po.poNumber : `PO-${po.id.slice(0, 8)}`
                    const supplierNamesDisplay = (po.supplierNames && po.supplierNames.length > 0)
                      ? po.supplierNames.join(", ")
                      : po.quotes?.[0]?.supplierName || "—"
                    const dateDisplay = po.createdAt && !isNaN(new Date(po.createdAt).getTime())
                      ? new Date(po.createdAt).toLocaleDateString()
                      : "—"
                    return (
                      <tr key={po.id} onClick={() => setSelectedPO(po)}
                        className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer">
                        <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{poNumberDisplay}</td>
                        <td className="px-4 py-2.5 text-xs font-medium">{supplierNamesDisplay}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={po.type === "local" ? "success" : "info"} className="text-[10px] px-1.5 py-0">{po.type}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.items.length}</td>
                        <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.createdBy || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{dateDisplay}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={STATUS_VARIANT[po.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[po.status]}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {/* Download dropdown */}
                          <div className="relative">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                              onClick={e => { e.stopPropagation(); setDownloadMenuPO(downloadMenuPO === po.id ? null : po.id) }}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            {downloadMenuPO === po.id && (
                              <div className="absolute right-0 top-7 z-30 w-48 rounded-lg border bg-[hsl(var(--card))] shadow-lg overflow-hidden"
                                onClick={e => e.stopPropagation()}>
                                <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors cursor-pointer"
                                  onClick={() => { downloadPO(po, true); setDownloadMenuPO(null) }}>
                                  <p className="font-medium">With Supplier</p>
                                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Includes supplier name(s)</p>
                                </button>
                                <div className="border-t" />
                                <button className="w-full px-4 py-2.5 text-xs text-left hover:bg-[hsl(var(--muted))]/40 transition-colors cursor-pointer"
                                  onClick={() => { downloadPO(po, false); setDownloadMenuPO(null) }}>
                                  <p className="font-medium">Without Supplier</p>
                                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Items only, no supplier info</p>
                                </button>
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(var(--muted-foreground))] hover:text-red-500 cursor-pointer"
                            onClick={e => handleDelete(po.id, e)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
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
