"use client"
import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { getClients, saveClient, deleteClient, type Client, CLIENT_STATUS_COLORS, CLIENT_STATUS_LABELS } from "@/lib/crm"
import { initialClientStatus, type CrmWorkspaceScope } from "@/lib/crm-workspace"
import { matchesOwnerRecord, resolveOwnerUserId } from "@/lib/crm-workspace"
import { isBranchPosClientHiddenFromErp } from "@/lib/branch-pos"
import { SalesAgentSourceBadge } from "@/components/crm/sales-agent-source-badge"
import { useAuth } from "@/components/auth-provider"
import { isErpAdmin } from "@/lib/auth"
import { useToast } from "@/components/ui/toast"
import { uploadFile } from "@/lib/upload"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, Search, X, Upload, Trash2, User, Mail, Phone, Globe, MapPin, Building2, Calendar, Truck, Loader2, Package, Crown, Download, Hash } from "lucide-react"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import {
  downloadAllClientsDetailExcel,
  downloadClientDetailExcel,
  downloadClientsExcel,
  type ClientSalesExportMeta,
} from "@/lib/crm-excel-export"
import {
  assignSalesRanks,
  buildClientSalesMap,
  sortClientsBySales,
  type ClientSalesInfo,
} from "@/lib/client-sales-stats"
import { getOrders, type Order } from "@/lib/orders"
import { formatCurrency } from "@/lib/pos"
import { formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"

export function ClientsList({ currentUser, currentUserId, workspace }: { currentUser: string; currentUserId?: string; workspace?: CrmWorkspaceScope }) {
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [deleteConfirmClient, setDeleteConfirmClient] = useState<Client | null>(null)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingAllDetails, setExportingAllDetails] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    Promise.all([getClients(), getOrders()]).then(([c, o]) => {
      const withoutPos = c.filter((client) => !isBranchPosClientHiddenFromErp(client))
      const scoped = workspace?.ownerUserId
        ? withoutPos.filter(client => matchesOwnerRecord(client.ownerUserId, workspace.ownerUserId))
        : withoutPos
      setClients(scoped)
      setOrders(o)
      setLoading(false)
    })
  }, [workspace?.ownerUserId])

  const salesMap = useMemo(() => {
    const base = buildClientSalesMap(orders)
    return assignSalesRanks(clients, base)
  }, [clients, orders])

  const salesExportMap = useMemo(() => {
    const map = new Map<string, ClientSalesExportMeta>()
    for (const [id, info] of salesMap) {
      map.set(id, {
        totalSales: info.totalSales,
        orderCount: info.orderCount,
        salesRank: info.salesRank,
      })
    }
    return map
  }, [salesMap])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const matched = clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.ntn.toLowerCase().includes(q)
    )
    return sortClientsBySales(matched, salesMap)
  }, [clients, search, salesMap])

  function exportListExcel() {
    setExportingExcel(true)
    try {
      downloadClientsExcel(filtered, currentUser, salesExportMap)
      toast({
        title: "Download started",
        message: `${filtered.length} client(s) exported for Excel.`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not export clients.", type: "error" })
    } finally {
      setExportingExcel(false)
    }
  }

  function exportAllDetailsExcel() {
    setExportingAllDetails(true)
    try {
      downloadAllClientsDetailExcel(filtered, orders, currentUser, salesExportMap)
      toast({
        title: "Download started",
        message: `Full details for ${filtered.length} client(s) exported.`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not export client details.", type: "error" })
    } finally {
      setExportingAllDetails(false)
    }
  }

  function exportSingleClient(client: Client, e?: React.MouseEvent) {
    e?.stopPropagation()
    const stats = salesMap.get(client.id)
    const clientOrders = orders.filter((o) => o.clientId === client.id && o.status === "delivered")
    try {
      downloadClientDetailExcel(client, clientOrders, currentUser, stats)
      toast({
        title: "Download started",
        message: `${client.name} exported with ${clientOrders.length} order(s).`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not export client.", type: "error" })
    }
  }

  return (
    <div className="space-y-5 rounded-[18px] bg-[#f5f5f7] dark:bg-transparent p-3 sm:p-4 -m-3 sm:-m-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 min-w-0">
        <div className="relative w-full sm:max-w-xs min-w-0 sm:mr-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b] pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full h-9 pl-9 pr-3 rounded-full border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] text-[13px] tracking-tight shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 cursor-text"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <CrmExcelExportButton
            onExport={exportListExcel}
            exporting={exportingExcel}
            disabled={loading || filtered.length === 0}
            label="Export List"
            className="h-8 rounded-full text-[11px] px-3.5 border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[11px] gap-1.5 cursor-pointer shrink-0 rounded-full border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
            disabled={loading || filtered.length === 0 || exportingAllDetails}
            onClick={exportAllDetailsExcel}
          >
            <Download className="h-3.5 w-3.5" />
            {exportingAllDetails ? "Exporting…" : "All Details"}
          </Button>
          {!workspace?.readOnly && (
            <Button
              size="sm"
              className="h-8 text-[11px] px-3.5 cursor-pointer rounded-full bg-[#1d1d1f] hover:bg-black text-white dark:bg-white dark:text-[#1d1d1f]"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add client
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-3">
            <div className="h-12 w-12 rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading clients...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <User className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {clients.length === 0 
              ? "No clients found" 
              : "No clients found"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2 sm:gap-2.5">
          {filtered.map(client => {
            const sales = salesMap.get(client.id)
            const isTopClient = sales?.salesRank != null && sales.salesRank > 0 && sales.salesRank <= 3
            return (
            <div
              key={client.id}
              onClick={() => setSelected(client)}
              className="group relative flex flex-col items-center text-center gap-1.5 cursor-pointer rounded-[18px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#fefefe] dark:bg-[hsl(var(--card))] p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-black/[0.1] hover:shadow-sm transition-all"
            >
              <button
                type="button"
                title={`Export ${client.name}`}
                onClick={(e) => exportSingleClient(client, e)}
                className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full border border-black/[0.06] bg-white/90 dark:bg-[hsl(var(--muted))]/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#f5f5f7] cursor-pointer"
              >
                <Download className="h-3 w-3 text-[#86868b]" />
              </button>

              {isTopClient && (
                <div className="flex items-center gap-0.5 text-[9px] font-semibold tracking-tight text-amber-700/85 dark:text-amber-400/90">
                  <Crown className="h-2.5 w-2.5 fill-amber-500/70 text-amber-600/80 shrink-0" />
                  <span className="tabular-nums">#{sales!.salesRank}</span>
                </div>
              )}

              {/* Avatar */}
              {client.imageUrl ? (
                <img 
                  src={client.imageUrl} 
                  alt={client.name} 
                  className={`h-14 w-14 rounded-full object-cover ring-1 ring-black/[0.06] ${
                    isTopClient ? "ring-amber-300/50" : ""
                  }`}
                />
              ) : (
                <div
                  className={`h-14 w-14 rounded-full flex items-center justify-center ring-1 ring-black/[0.06] ${
                    isTopClient ? "bg-amber-50 dark:bg-amber-950/25 ring-amber-200/50" : "bg-[#f2f2f7] dark:bg-[hsl(var(--muted))]/40"
                  }`}
                >
                  <User className={`h-7 w-7 ${isTopClient ? "text-amber-700/80" : "text-[#86868b]"}`} />
                </div>
              )}
              
              {/* Name */}
              <p className="text-[13px] font-semibold tracking-tight truncate w-full px-0.5 text-[#1d1d1f] dark:text-[hsl(var(--foreground))] capitalize leading-tight mt-0.5">
                {client.name}
              </p>

              {(sales?.totalSales ?? 0) > 0 && (
                <p className="text-[11px] font-medium tabular-nums text-[#86868b] dark:text-emerald-400/75">
                  {formatCurrency(sales!.totalSales)}
                </p>
              )}

              <ClientNtnInput
                client={client}
                readOnly={!!workspace?.readOnly}
                onSaved={(updated) => {
                  setClients(prev => prev.map(x => x.id === updated.id ? updated : x))
                }}
              />

              <div className="flex flex-col items-center gap-0.5 w-full px-0.5 pt-0.5">
                {client.ownerUserId && (
                  <SalesAgentSourceBadge agentName={client.createdBy} kind="client" className="max-w-full" />
                )}
                {client.status !== "active" && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${CLIENT_STATUS_COLORS[client.status]}`}>
                    {CLIENT_STATUS_LABELS[client.status]}
                  </span>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <ClientForm
          currentUser={currentUser}
          currentUserId={currentUserId}
          workspace={workspace}
          onClose={() => setShowForm(false)}
          onSave={c => {
            setClients(prev => [c, ...prev.filter(x => x.id !== c.id)])
            setShowForm(false)
          }}
        />
      )}

      {selected && (
        <ClientDetail
          client={selected}
          workspace={workspace}
          salesInfo={salesMap.get(selected.id)}
          allOrders={orders}
          currentUser={currentUser}
          onClose={() => setSelected(null)}
          onUpdate={c => {
            setClients(prev => prev.map(x => x.id === c.id ? c : x))
            setSelected(c)
          }}
          onDelete={id => {
            setClients(prev => prev.filter(x => x.id !== id))
            setSelected(null)
          }}
          onRequestDelete={() => setDeleteConfirmClient(selected)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirmClient}
        title="Delete Client"
        message="Are you sure you want to delete this client?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirmClient) {
            deleteClient(deleteConfirmClient.id).then(() => {
              setClients(prev => prev.filter(x => x.id !== deleteConfirmClient.id))
            })
          }
          setDeleteConfirmClient(null)
          setSelected(null)
        }}
        onCancel={() => setDeleteConfirmClient(null)}
      />
    </div>
  )
}

function ClientForm({ currentUser, currentUserId, workspace, existing, onClose, onSave }: {
  currentUser: string
  currentUserId?: string
  workspace?: CrmWorkspaceScope
  existing?: Client
  onClose: () => void
  onSave: (c: Client) => void
}) {
  const [name, setName] = useState(existing?.name || "")
  const [company, setCompany] = useState(existing?.company || "")
  const [email, setEmail] = useState(existing?.email || "")
  const [phone, setPhone] = useState(existing?.phone || "")
  const [address, setAddress] = useState(existing?.address || "")
  const [city, setCity] = useState(existing?.city || "")
  const [country, setCountry] = useState(existing?.country || "")
  const [website, setWebsite] = useState(existing?.website || "")
  const [taxId, setTaxId] = useState(existing?.taxId || "")
  const [ntn, setNtn] = useState(existing?.ntn || "")
  const [industry, setIndustry] = useState(existing?.industry || "")
  const [contactPerson, setContactPerson] = useState(existing?.contactPerson || "")
  const [notes, setNotes] = useState(existing?.notes || "")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(existing?.imageUrl || null)
  const [saving, setSaving] = useState(false)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (!name.trim()) return
    setSaving(true)

    let imageUrl: string | undefined
    if (imageFile) {
      try { imageUrl = await uploadFile(imageFile, "client-images") } catch {}
    }

    const client: Client = {
      id: existing?.id || Date.now().toString(),
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      website: website.trim(),
      taxId: taxId.trim(),
      ntn: ntn.trim(),
      industry: industry.trim(),
      contactPerson: contactPerson.trim(),
      imageUrl,
      notes: notes.trim(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      createdBy: existing?.createdBy || currentUser,
      ownerUserId: existing?.ownerUserId || resolveOwnerUserId(workspace?.ownerUserId, currentUserId),
      status: existing?.status || initialClientStatus(workspace),
    }

    await saveClient(client)
    onSave(client)
    setSaving(false)
  }

  const modal = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-xl p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-[22px] bg-[#f5f5f7] dark:bg-[hsl(var(--card))] shadow-2xl overflow-hidden border border-black/[0.06] dark:border-[hsl(var(--border))]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-[hsl(var(--border))] bg-white/80 dark:bg-[hsl(var(--card))]/80 backdrop-blur-sm">
          <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{existing ? "Edit Client" : "Add New Client"}</p>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-black/[0.06]" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Photo Upload Section */}
          <div className="flex items-center gap-3 pb-3 rounded-[16px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] p-3">
            <div className="shrink-0">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-full object-cover ring-1 ring-black/[0.06]" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-[#f2f2f7] dark:bg-[hsl(var(--muted))] flex items-center justify-center ring-1 ring-black/[0.06]">
                  <User className="h-8 w-8 text-[#86868b]" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <input type="file" id="client-image" className="hidden" accept="image/*" onChange={handleImageChange} />
              <label htmlFor="client-image">
                <Button type="button" size="sm" variant="outline" className="h-8 text-[12px] cursor-pointer rounded-full border-black/[0.08] bg-white" asChild>
                  <span className="cursor-pointer">
                    <Upload className="h-3 w-3 mr-1" /> Upload Photo
                  </span>
                </Button>
              </label>
              <p className="text-[10px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))] mt-1">JPG, PNG or GIF (max 5MB)</p>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-2 rounded-[16px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] p-3">
            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide">Basic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Full Name *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Company</label>
                <input value={company} onChange={e => setCompany(e.target.value)}
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Industry</label>
                <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Technology"
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-2 rounded-[16px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] p-3">
            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide">Contact Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Phone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Contact Person</label>
                <input value={contactPerson} onChange={e => setContactPerson(e.target.value)}
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-2 rounded-[16px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] p-3">
            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide">Address Information</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">City</label>
                  <input value={city} onChange={e => setCity(e.target.value)}
                    className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Country</label>
                  <input value={country} onChange={e => setCountry(e.target.value)}
                    className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-2 rounded-[16px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] p-3">
            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide">Additional Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Website</label>
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com"
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Tax ID / VAT</label>
                <input value={taxId} onChange={e => setTaxId(e.target.value)}
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">NTN Number</label>
                <input value={ntn} onChange={e => setNtn(e.target.value)} placeholder="e.g. 1234567-8"
                  className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-black/[0.06] bg-white/90 dark:bg-[hsl(var(--card))]/90 backdrop-blur-sm">
          <Button size="sm" className="h-9 text-[13px] px-5 cursor-pointer rounded-full bg-[#1d1d1f] hover:bg-black text-white dark:bg-white dark:text-[#1d1d1f]" onClick={submit} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : existing ? "Update Client" : "Add Client"}
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-[13px] px-4 cursor-pointer rounded-full border-black/[0.12]" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null
}

function ClientNtnInput({
  client,
  readOnly,
  onSaved,
}: {
  client: Client
  readOnly: boolean
  onSaved: (client: Client) => void
}) {
  const [value, setValue] = useState(client.ntn || "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(client.ntn || "")
  }, [client.id, client.ntn])

  async function commit() {
    const trimmed = value.trim()
    if (trimmed === (client.ntn || "").trim()) return
    setSaving(true)
    const updated = { ...client, ntn: trimmed }
    await saveClient(updated)
    onSaved(updated)
    setSaving(false)
  }

  if (readOnly) {
    if (!client.ntn?.trim()) return null
    return (
      <p className="text-[9px] text-[#aeaeb2] dark:text-[hsl(var(--muted-foreground))]/80 tabular-nums truncate w-full px-0.5">
        NTN {client.ntn}
      </p>
    )
  }

  return (
    <input
      type="text"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      placeholder="NTN"
      disabled={saving}
      className="w-full max-w-[110px] h-6 px-2 rounded-full border border-black/[0.06] bg-white/80 dark:bg-[hsl(var(--background))] text-[9px] text-center text-[#aeaeb2] placeholder:text-[#aeaeb2]/80 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 disabled:opacity-60"
    />
  )
}

function orderDeliveredAt(order: Order): Date | null {
  const raw = order.fulfillmentDate || order.deliveryDate || order.createdAt
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDetailDate(d: Date | null): string {
  if (!d) return "—"
  return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
}

function ClientDetail({ client, workspace, salesInfo, allOrders, currentUser, onClose, onUpdate, onDelete, onRequestDelete }: {
  client: Client
  workspace?: CrmWorkspaceScope
  salesInfo?: ClientSalesInfo
  allOrders?: Order[]
  currentUser?: string
  onClose: () => void
  onUpdate: (c: Client) => void
  onDelete: (id: string) => void
  onRequestDelete?: () => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [clientOrders, setClientOrders] = useState<Order[]>([])
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [exportingClient, setExportingClient] = useState(false)
  const readOnly = !!workspace?.readOnly
  const isTopClient = salesInfo?.salesRank != null && salesInfo.salesRank > 0 && salesInfo.salesRank <= 3
  const isAdmin = isErpAdmin(user?.role)
  const canReview = isAdmin && client.status === "pending_approval" && !!client.ownerUserId

  useEffect(() => {
    if (allOrders) {
      setClientOrders(allOrders.filter((o) => o.clientId === client.id && o.status === "delivered"))
      setOrdersLoading(false)
      return
    }
    let cancelled = false
    setOrdersLoading(true)
    getOrders()
      .then((rows) => {
        if (cancelled) return
        setClientOrders(
          rows.filter((o) => o.clientId === client.id && o.status === "delivered"),
        )
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [client.id, allOrders])

  const filteredOrders = useMemo(() => {
    return clientOrders
      .filter((order) => {
        const delivered = orderDeliveredAt(order)
        if (!delivered) return true
        if (dateFrom) {
          const from = new Date(dateFrom)
          from.setHours(0, 0, 0, 0)
          if (delivered < from) return false
        }
        if (dateTo) {
          const to = new Date(dateTo)
          to.setHours(23, 59, 59, 999)
          if (delivered > to) return false
        }
        return true
      })
      .sort((a, b) => {
        const da = orderDeliveredAt(a)?.getTime() ?? 0
        const db = orderDeliveredAt(b)?.getTime() ?? 0
        return db - da
      })
  }, [clientOrders, dateFrom, dateTo])

  const ordersTotal = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [filteredOrders],
  )

  async function reviewClient(nextStatus: "active" | "rejected") {
    setReviewing(true)
    const updated = { ...client, status: nextStatus }
    await saveClient(updated)
    onUpdate(updated)
    toast({
      title: nextStatus === "active" ? "Client approved" : "Client rejected",
      message: `${client.name} was ${nextStatus === "active" ? "approved" : "rejected"}.`,
      type: "success",
    })
    setReviewing(false)
    onClose()
  }

  async function handleDelete() {
    if (onRequestDelete) {
      onRequestDelete()
      return
    }
    setDeleting(true)
    await deleteClient(client.id)
    onDelete(client.id)
  }

  function handleExportClient() {
    setExportingClient(true)
    try {
      downloadClientDetailExcel(client, filteredOrders, currentUser, salesInfo)
      toast({
        title: "Download started",
        message: `${client.name} exported with ${filteredOrders.length} order(s).`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not export client.", type: "error" })
    } finally {
      setExportingClient(false)
    }
  }

  const infoItems = [
    { icon: Mail, label: "Email", value: client.email },
    { icon: Phone, label: "Phone", value: client.phone },
    { icon: User, label: "Contact", value: client.contactPerson },
    { icon: MapPin, label: "City", value: client.city },
    { icon: Globe, label: "Website", value: client.website, link: client.website },
    { icon: Building2, label: "Tax ID", value: client.taxId },
    { icon: Hash, label: "NTN", value: client.ntn },
  ]

  const detailModal = (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xl p-0 sm:p-4"
          onClick={onClose}
        >
          <div
            className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-t-[22px] sm:rounded-[22px] border border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#f5f5f7] dark:bg-[hsl(var(--card))] flex flex-col overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-black/[0.06] dark:border-[hsl(var(--border))] shrink-0 bg-white/90 dark:bg-[hsl(var(--card))]/90 backdrop-blur-sm">
              {client.imageUrl ? (
                <img
                  src={client.imageUrl}
                  alt={client.name}
                  className="h-12 w-12 rounded-full object-cover ring-1 ring-black/[0.08] shrink-0"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-[#f2f2f7] dark:bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 ring-1 ring-black/[0.08]">
                  <User className="h-6 w-6 text-[#1faca6]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-semibold tracking-tight capitalize truncate text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{client.name}</h2>
                  {isTopClient && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      <Crown className="h-3 w-3 fill-amber-500 text-amber-500" />
                      Top {salesInfo!.salesRank} Client
                    </span>
                  )}
                  {client.ownerUserId && (
                    <SalesAgentSourceBadge agentName={client.createdBy} kind="client" />
                  )}
                  {client.status !== "active" && (
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${CLIENT_STATUS_COLORS[client.status]}`}>
                      {CLIENT_STATUS_LABELS[client.status]}
                    </span>
                  )}
                </div>
                {client.company && (
                  <p className="text-[12px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{client.company}</p>
                )}
                <p className="text-[11px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))] mt-1">
                  Added {new Date(client.createdAt).toLocaleDateString("en-PK")} by {client.createdBy}
                  {client.industry ? ` · ${client.industry}` : ""}
                  {(salesInfo?.totalSales ?? 0) > 0 && (
                    <> · <span className="font-semibold text-[#1faca6]">{formatCurrency(salesInfo!.totalSales)}</span> total sales</>
                  )}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full hover:bg-black/[0.06]" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none">
              {/* Contact strip */}
              <div className="px-4 sm:px-5 py-3 border-b border-black/[0.06] dark:border-[hsl(var(--border))]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {infoItems.map(({ icon: Icon, label, value, link }) => (
                    <div key={label} className="rounded-[12px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2 min-w-0">
                      <p className="text-[11px] font-medium text-[#86868b] flex items-center gap-1">
                        <Icon className="h-3 w-3 shrink-0" />
                        {label}
                      </p>
                      {link && value ? (
                        <a
                          href={link.startsWith("http") ? link : `https://${link}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[13px] text-[#1faca6] hover:underline truncate block mt-0.5"
                        >
                          {value}
                        </a>
                      ) : (
                        <p className="text-[13px] font-medium truncate mt-0.5 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{value?.trim() || "—"}</p>
                      )}
                    </div>
                  ))}
                </div>
                {(client.address || client.notes) && (
                  <div className="mt-2 space-y-1.5 text-[12px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">
                    {client.address && (
                      <p>
                        <span className="font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Address: </span>
                        {client.address}
                        {client.country ? `, ${client.country}` : ""}
                      </p>
                    )}
                    {client.notes && (
                      <p className="line-clamp-2">
                        <span className="font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Notes: </span>
                        {client.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Delivered orders */}
              <div className="px-4 sm:px-5 py-3">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                    <Truck className="h-3.5 w-3.5 text-[#1faca6]" />
                    Delivered orders
                  </div>
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
                      title="From date"
                    />
                    <span className="text-[11px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))]">to</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-9 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
                      title="To date"
                    />
                    {(dateFrom || dateTo) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDateFrom("")
                          setDateTo("")
                        }}
                        className="text-[11px] font-semibold text-[#0071e3] hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))] shrink-0 tabular-nums">
                    <span className="font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{filteredOrders.length}</span> orders
                    {filteredOrders.length > 0 && (
                      <> · <span className="font-semibold text-[#1faca6]">{formatCurrency(ordersTotal)}</span></>
                    )}
                  </div>
                </div>

                {ordersLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--muted-foreground))]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading orders…
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-10 text-center text-xs text-[hsl(var(--muted-foreground))]">
                    <Package className="h-8 w-8 mx-auto opacity-30 mb-2" />
                    {clientOrders.length === 0
                      ? "No delivered orders for this client yet."
                      : "No delivered orders in this date range."}
                  </div>
                ) : (
                  <div className="rounded-[16px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] overflow-hidden">
                    <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_88px_72px_minmax(0,1.2fr)_88px] gap-2 px-3 py-2 border-b border-black/[0.04] text-[11px] font-medium text-[#86868b] bg-[#fafafa] dark:bg-[hsl(var(--muted))]/30">
                      <span>Order</span>
                      <span>Delivered</span>
                      <span className="text-right">Items</span>
                      <span>Products</span>
                      <span className="text-right">Total</span>
                    </div>
                    <ul className="divide-y divide-black/[0.04] max-h-[280px] overflow-y-auto">
                      {filteredOrders.map((order) => {
                        const delivered = orderDeliveredAt(order)
                        const itemSummary = order.items
                          .slice(0, 2)
                          .map((i) => i.description)
                          .join(", ")
                        const extra = order.items.length > 2 ? ` +${order.items.length - 2} more` : ""
                        return (
                          <li
                            key={order.id}
                            className="px-3 py-2.5 text-[13px] hover:bg-[#fafafa] dark:hover:bg-white/5 sm:grid sm:grid-cols-[minmax(0,1fr)_88px_72px_minmax(0,1.2fr)_88px] sm:gap-2 sm:items-center"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#1faca6] font-mono">{order.orderNumber}</p>
                              {(order.fulfillmentDispatcher || order.dispatcher) && (
                                <p className="text-[11px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                                  {order.fulfillmentDispatcher || order.dispatcher}
                                </p>
                              )}
                            </div>
                            <p className="text-[13px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))] tabular-nums flex items-center gap-1 mt-1 sm:mt-0">
                              <Calendar className="h-3 w-3 sm:hidden shrink-0" />
                              {formatDetailDate(delivered)}
                            </p>
                            <p className="text-[13px] text-right tabular-nums mt-0.5 sm:mt-0 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                              {formatCrmItemsQtyLabel(order.items)}
                            </p>
                            <p className="text-[13px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))] truncate mt-0.5 sm:mt-0 col-span-2 sm:col-span-1">
                              {itemSummary}
                              {extra}
                            </p>
                            <p className="text-[13px] font-semibold text-right tabular-nums mt-1 sm:mt-0 text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                              {formatCurrency(order.total || 0)}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-t border-black/[0.06] dark:border-[hsl(var(--border))] shrink-0 bg-white/90 dark:bg-[hsl(var(--card))]/90 backdrop-blur-sm">
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-[12px] cursor-pointer gap-1.5 rounded-full border-black/[0.12]"
                onClick={handleExportClient}
                disabled={exportingClient}
              >
                <Download className="h-3 w-3" />
                {exportingClient ? "Exporting…" : "Export Client"}
              </Button>
              {canReview && (
                <>
                  <Button size="sm" className="h-9 text-[12px] cursor-pointer rounded-full bg-[#1d1d1f] hover:bg-black text-white dark:bg-white dark:text-[#1d1d1f]" onClick={() => reviewClient("active")} disabled={reviewing}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 text-[12px] cursor-pointer rounded-full border-black/[0.12]" onClick={() => reviewClient("rejected")} disabled={reviewing}>
                    Reject
                  </Button>
                </>
              )}
              {!readOnly && (
                <Button size="sm" variant="outline" className="h-9 text-[12px] cursor-pointer rounded-full border-black/[0.12]" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              {!readOnly && (
                <Button size="sm" variant="destructive" className="h-9 text-[12px] cursor-pointer rounded-full" onClick={handleDelete} disabled={deleting}>
                  <Trash2 className="h-3 w-3 mr-1" />
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-9 text-[12px] ml-auto cursor-pointer rounded-full border-black/[0.12]" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
  )

  return (
    <>
      {editing ? (
        <ClientForm
          currentUser={client.createdBy}
          workspace={workspace}
          existing={client}
          onClose={() => setEditing(false)}
          onSave={c => {
            onUpdate(c)
            setEditing(false)
          }}
        />
      ) : (
        typeof document !== "undefined" ? createPortal(detailModal, document.body) : null
      )}
    </>
  )
}
