"use client"
import { useState, useEffect } from "react"
import { getSuppliers, saveSupplier, deleteSupplier, type Supplier } from "@/lib/purchase"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, X, Phone, Mail, MapPin, Building2, Loader2, Landmark, CreditCard } from "lucide-react"
import { useDialog } from "@/components/ui/dialog-provider"

const empty = (): Omit<Supplier, "id"> => ({
  name: "", type: "local", contact: "", email: "", address: "", company: "", bankAccountName: "", bankIban: "",
})

// ── Supplier Form ────────────────────────────────────────────────
function SupplierForm({ initial, onSave, onCancel }: {
  initial: Omit<Supplier, "id">
  onSave: (s: Omit<Supplier, "id">) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}
      className="border rounded-lg p-4 space-y-3 bg-[hsl(var(--muted))]/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Supplier Name *</label>
          <input required value={form.name} onChange={e => set("name", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Company</label>
          <input value={form.company} onChange={e => set("company", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Type *</label>
          <select required value={form.type} onChange={e => set("type", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]">
            <option value="local">Local</option>
            <option value="imported">Imported</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">WhatsApp / Phone *</label>
          <input required value={form.contact} onChange={e => set("contact", e.target.value)}
            placeholder="+92 300 0000000"
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Email</label>
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Address</label>
          <input value={form.address} onChange={e => set("address", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Bank Account Name</label>
          <input value={form.bankAccountName || ""} onChange={e => set("bankAccountName", e.target.value)}
            placeholder="e.g. Ali Traders Ltd"
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Bank IBAN</label>
          <input value={form.bankIban || ""} onChange={e => set("bankIban", e.target.value)}
            placeholder="e.g. PK36SCBL0000001123456789"
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-8">Save Supplier</Button>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

// ── Supplier Detail Popup ────────────────────────────────────────
function SupplierDetail({ supplier, onClose, onEdit, onDelete }: {
  supplier: Supplier
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-sm font-bold">
              {supplier.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">{supplier.name}</p>
              {supplier.company && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{supplier.company}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={supplier.type === "local" ? "success" : "info"} className="text-[10px]">
              {supplier.type}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {supplier.contact && (
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
                <Phone className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Phone / WhatsApp</p>
                <p className="text-sm font-medium">{supplier.contact}</p>
              </div>
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
                <Mail className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Email</p>
                <p className="text-sm font-medium">{supplier.email}</p>
              </div>
            </div>
          )}
          {supplier.company && (
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
                <Building2 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Company</p>
                <p className="text-sm font-medium">{supplier.company}</p>
              </div>
            </div>
          )}
          {supplier.address && (
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
                <MapPin className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Address</p>
                <p className="text-sm font-medium leading-snug">{supplier.address}</p>
              </div>
            </div>
          )}
          {(supplier.bankAccountName || supplier.bankIban) && (
            <>
              <div className="border-t pt-3" />
              {supplier.bankAccountName && (
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
                    <Landmark className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Bank Account</p>
                    <p className="text-sm font-medium">{supplier.bankAccountName}</p>
                  </div>
                </div>
              )}
              {supplier.bankIban && (
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
                    <CreditCard className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">IBAN</p>
                    <p className="text-sm font-mono font-medium break-all">{supplier.bankIban}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t bg-[hsl(var(--muted))]/20">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs ml-auto" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Tab ─────────────────────────────────────────────────────
export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null)
  const { confirm } = useDialog()

  useEffect(() => {
    getSuppliers().then(s => { setSuppliers(s); setLoading(false) })
    const channel = supabase
      .channel("suppliers_tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "erp_suppliers" }, () => {
        getSuppliers().then(setSuppliers)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleAdd(data: Omit<Supplier, "id">) {
    const s: Supplier = { ...data, id: Date.now().toString() }
    await saveSupplier(s)
    setSuppliers(prev => [...prev, s])
    setAdding(false)
  }

  async function handleEdit(id: string, data: Omit<Supplier, "id">) {
    const s: Supplier = { ...data, id }
    await saveSupplier(s)
    setSuppliers(prev => prev.map(x => x.id === id ? s : x))
    setEditId(null)
    setViewSupplier(s)
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      type: "confirm",
      title: "Delete Supplier",
      message: "This supplier will be permanently removed.",
      confirmLabel: "Delete",
    })
    if (!ok) return
    await deleteSupplier(id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
    setViewSupplier(null)
  }

  const editingSupplier = suppliers.find(s => s.id === editId)

  return (
    <div className="p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {loading ? "Loading..." : `${suppliers.length} supplier${suppliers.length !== 1 ? "s" : ""} registered`}
        </p>
        <Button size="sm" className="h-8 text-xs" onClick={() => { setAdding(true); setEditId(null) }}>
          <Plus className="h-3.5 w-3.5" /> Add Supplier
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading suppliers...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && suppliers.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-2">
          <p className="text-sm font-medium">No suppliers yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Add your first supplier using the button above.</p>
        </div>
      )}

      {/* List */}
      {!loading && suppliers.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                {["Name", "Company", "Type", "Contact", ""].map(h => (
                  <th key={h} className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {suppliers.map(s => (
                <tr key={s.id}
                  onClick={() => { setViewSupplier(s); setEditId(null) }}
                  className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer">
                  <td className="px-4 py-2.5 text-xs font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{s.company || "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={s.type === "local" ? "success" : "info"} className="text-[10px] px-1.5 py-0">{s.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{s.contact}</td>
                  <td className="px-4 py-2.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(var(--muted-foreground))] hover:text-red-500"
                      onClick={e => { e.stopPropagation(); handleDelete(s.id) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setAdding(false)}>
          <div className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <p className="text-sm font-semibold">Add Supplier</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAdding(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5">
              <SupplierForm initial={empty()} onSave={handleAdd} onCancel={() => setAdding(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editId && editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditId(null)}>
          <div className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Edit Supplier</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SupplierForm
              initial={{ name: editingSupplier.name, type: editingSupplier.type, contact: editingSupplier.contact, email: editingSupplier.email, address: editingSupplier.address, company: editingSupplier.company, bankAccountName: editingSupplier.bankAccountName, bankIban: editingSupplier.bankIban }}
              onSave={data => handleEdit(editId, data)}
              onCancel={() => setEditId(null)}
            />
          </div>
        </div>
      )}

      {/* Detail popup */}
      {viewSupplier && !editId && (
        <SupplierDetail
          supplier={viewSupplier}
          onClose={() => setViewSupplier(null)}
          onEdit={() => { setEditId(viewSupplier.id); setViewSupplier(null) }}
          onDelete={() => handleDelete(viewSupplier.id)}
        />
      )}
    </div>
  )
}
