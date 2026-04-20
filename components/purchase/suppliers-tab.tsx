"use client"
import { useState, useEffect } from "react"
import { getSuppliers, saveSupplier, deleteSupplier, type Supplier } from "@/lib/purchase"
// DB access via /api/db routes (Prisma)
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, X, Phone, Mail, MapPin, Building2, Loader2, Landmark, CreditCard } from "lucide-react"
import { useDialog } from "@/components/ui/dialog-provider"
import { useToast } from "@/components/ui/toast"

const empty = (): Omit<Supplier, "id"> => ({
  name: "", type: "local", contact: "", email: "", address: "", company: "", bankAccountName: "", bankIban: "", image: "",
})

// ── Supplier Form ────────────────────────────────────────────────
function SupplierForm({ initial, onSave, onCancel, isLoading }: {
  initial: Omit<Supplier, "id">
  onSave: (s: Omit<Supplier, "id">) => void
  onCancel: () => void
  isLoading?: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}
      className="border rounded-lg p-4 space-y-3 bg-[hsl(var(--muted))]/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Profile Image</label>
          <div className="flex items-center gap-3">
            {form.image ? (
              <div className="relative">
                <img src={form.image} alt="Supplier" className="h-16 w-16 rounded-full object-cover border" />
                <button
                  type="button"
                  onClick={() => set("image", "")}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center">
                <Building2 className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onloadend = () => {
                    set("image", reader.result as string)
                  }
                  reader.readAsDataURL(file)
                }
              }}
              className="text-xs text-[hsl(var(--muted-foreground))] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-[hsl(var(--muted))] file:text-[hsl(var(--foreground))] hover:file:bg-[hsl(var(--muted))]/80"
            />
          </div>
        </div>
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
        <Button type="submit" size="sm" className="h-8 cursor-pointer" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              Saving...
            </>
          ) : (
            "Save Supplier"
          )}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" onClick={onCancel} disabled={isLoading}>Cancel</Button>
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
  const [showFullImage, setShowFullImage] = useState(false)

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Header with avatar and name */}
          <div className="relative px-6 pt-6 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {supplier.image ? (
                  <img
                    src={supplier.image}
                    alt={supplier.name}
                    className="h-20 w-20 rounded-full object-cover border-2 cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                    onClick={() => setShowFullImage(true)}
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-2xl font-bold shadow-sm">
                    {supplier.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-lg font-semibold">{supplier.name}</p>
                  {supplier.company && (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{supplier.company}</p>
                  )}
                  <div className="mt-2">
                    <Badge variant={supplier.type === "local" ? "success" : "info"} className="text-[10px] px-2 py-0.5">
                      {supplier.type}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 cursor-pointer" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Details */}
          <div className="px-6 pb-4 space-y-2.5">
            {supplier.contact && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[hsl(var(--muted))]/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--background))]">
                  <Phone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">Phone / WhatsApp</p>
                  <p className="text-sm font-medium truncate">{supplier.contact}</p>
                </div>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[hsl(var(--muted))]/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--background))]">
                  <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">Email</p>
                  <p className="text-sm font-medium truncate">{supplier.email}</p>
                </div>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[hsl(var(--muted))]/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--background))]">
                  <MapPin className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">Address</p>
                  <p className="text-sm font-medium leading-snug">{supplier.address}</p>
                </div>
              </div>
            )}
            {(supplier.bankAccountName || supplier.bankIban) && (
              <div className="border-t pt-2.5 mt-1">
                {supplier.bankAccountName && (
                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[hsl(var(--muted))]/30">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--background))]">
                      <Landmark className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">Bank Account</p>
                      <p className="text-sm font-medium">{supplier.bankAccountName}</p>
                    </div>
                  </div>
                )}
                {supplier.bankIban && (
                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[hsl(var(--muted))]/30 mt-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--background))]">
                      <CreditCard className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">IBAN</p>
                      <p className="text-sm font-mono font-medium break-all">{supplier.bankIban}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
            <Button size="sm" variant="outline" className="h-9 text-xs cursor-pointer" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" className="h-9 text-xs ml-auto cursor-pointer" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>

      {/* Full-size image modal */}
      {showFullImage && supplier.image && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowFullImage(false)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={supplier.image} alt={supplier.name} className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 bg-black/50 text-white hover:bg-black/70 cursor-pointer"
              onClick={() => setShowFullImage(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Main Tab ─────────────────────────────────────────────────────
export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const { confirm } = useDialog()
  const { toast } = useToast()

  useEffect(() => {
    getSuppliers().then(s => { setSuppliers(s); setLoading(false) })
    const interval = setInterval(() => getSuppliers().then(setSuppliers), 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleAdd(data: Omit<Supplier, "id">) {
    setSaving(true)
    console.log("🔄 Creating supplier...", data.name)
    const s: Supplier = { ...data, id: Date.now().toString() }
    try {
      await saveSupplier(s)
      console.log("✅ Supplier created successfully:", s.name)
      setSuppliers(prev => [...prev, s])
      setAdding(false)
      toast({
        type: "success",
        title: "Supplier Created",
        message: `${s.name} has been added successfully.`,
        duration: 3000,
      })
    } catch (error) {
      console.error("❌ Error creating supplier:", error)
      toast({
        type: "error",
        title: "Error",
        message: "Failed to create supplier. Please try again.",
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id: string, data: Omit<Supplier, "id">) {
    setSaving(true)
    console.log("🔄 Updating supplier...", data.name)
    const s: Supplier = { ...data, id }
    try {
      await saveSupplier(s)
      console.log("✅ Supplier updated successfully:", s.name)
      setSuppliers(prev => prev.map(x => x.id === id ? s : x))
      setEditId(null)
      setViewSupplier(s)
      toast({
        type: "success",
        title: "Supplier Updated",
        message: `${s.name} has been updated successfully.`,
        duration: 3000,
      })
    } catch (error) {
      console.error("❌ Error updating supplier:", error)
      toast({
        type: "error",
        title: "Error",
        message: "Failed to update supplier. Please try again.",
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
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
        <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => { setAdding(true); setEditId(null) }}>
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
              <SupplierForm initial={empty()} onSave={handleAdd} onCancel={() => setAdding(false)} isLoading={saving} />
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
              initial={{ name: editingSupplier.name, type: editingSupplier.type, contact: editingSupplier.contact, email: editingSupplier.email, address: editingSupplier.address, company: editingSupplier.company, bankAccountName: editingSupplier.bankAccountName, bankIban: editingSupplier.bankIban, image: editingSupplier.image || "" }}
              onSave={data => handleEdit(editId, data)}
              onCancel={() => setEditId(null)}
              isLoading={saving}
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
