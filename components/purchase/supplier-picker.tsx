"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, X, Loader2 } from "lucide-react"
import { saveSupplier, type Supplier } from "@/lib/purchase"

const inputCls =
  "w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

function accountDetailsFromSupplier(supplier?: Supplier | null) {
  if (!supplier) return ""
  return [supplier.bankAccountName, supplier.bankIban].filter(Boolean).join(" · ")
}

function SupplierQuickForm({
  initial,
  title,
  onSave,
  onCancel,
  saving,
}: {
  initial: Omit<Supplier, "id">
  title: string
  onSave: (data: Omit<Supplier, "id">) => void
  onCancel: () => void
  saving?: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSave(form) }}
      className="space-y-3"
    >
      <p className="text-sm font-semibold">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[11px] font-medium">Supplier name *</label>
          <input required value={form.name} onChange={e => set("name", e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium">Type *</label>
          <select required value={form.type} onChange={e => set("type", e.target.value)} className={inputCls}>
            <option value="local">Local</option>
            <option value="imported">Imported</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium">Phone / WhatsApp *</label>
          <input required value={form.contact} onChange={e => set("contact", e.target.value)} placeholder="+92 300 0000000" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium">Company</label>
          <input value={form.company} onChange={e => set("company", e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium">Email</label>
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[11px] font-medium">Address</label>
          <input value={form.address} onChange={e => set("address", e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium">Bank account name</label>
          <input value={form.bankAccountName || ""} onChange={e => set("bankAccountName", e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium">Bank IBAN</label>
          <input value={form.bankIban || ""} onChange={e => set("bankIban", e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="h-8 text-xs flex-1 cursor-pointer" disabled={saving}>
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Saving...</> : "Save supplier"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

const emptySupplier = (): Omit<Supplier, "id"> => ({
  name: "",
  type: "local",
  contact: "",
  email: "",
  address: "",
  company: "",
  bankAccountName: "",
  bankIban: "",
  image: "",
})

export function SupplierPicker({
  suppliers,
  supplierId,
  onSupplierIdChange,
  onSuppliersChange,
  onAccountDetailsChange,
}: {
  suppliers: Supplier[]
  supplierId: string
  onSupplierIdChange: (id: string) => void
  onSuppliersChange: (suppliers: Supplier[]) => void
  onAccountDetailsChange?: (details: string) => void
}) {
  const [quickOpen, setQuickOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const selected = suppliers.find(s => s.id === supplierId)

  function selectSupplier(id: string) {
    onSupplierIdChange(id)
    const supplier = suppliers.find(s => s.id === id)
    onAccountDetailsChange?.(accountDetailsFromSupplier(supplier))
  }

  async function handleQuickAdd(data: Omit<Supplier, "id">) {
    setSaving(true)
    try {
      const supplier: Supplier = { ...data, id: Date.now().toString() }
      await saveSupplier(supplier)
      onSuppliersChange([...suppliers, supplier])
      selectSupplier(supplier.id)
      setQuickOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(data: Omit<Supplier, "id">) {
    if (!selected) return
    setSaving(true)
    try {
      const supplier: Supplier = { ...data, id: selected.id }
      await saveSupplier(supplier)
      onSuppliersChange(suppliers.map(s => s.id === supplier.id ? supplier : s))
      selectSupplier(supplier.id)
      setEditOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-[hsl(var(--foreground))]">Supplier</label>
        <div className="flex gap-2">
          <select
            value={supplierId}
            onChange={e => selectSupplier(e.target.value)}
            className={inputCls + " flex-1"}
          >
            <option value="">Select supplier</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" className="h-8 text-[10px] shrink-0 cursor-pointer" onClick={() => setQuickOpen(true)}>
            <Plus className="h-3 w-3" /> Quick add
          </Button>
          {selected && (
            <Button type="button" size="sm" variant="outline" className="h-8 text-[10px] shrink-0 cursor-pointer" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
        </div>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Quick add a supplier now, then edit full profile anytime.
        </p>
      </div>

      {quickOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setQuickOpen(false)}>
          <div className="w-full max-w-md rounded-lg border bg-[hsl(var(--card))] shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQuickOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SupplierQuickForm
              title="Quick add supplier"
              initial={emptySupplier()}
              onSave={handleQuickAdd}
              onCancel={() => setQuickOpen(false)}
              saving={saving}
            />
          </div>
        </div>
      )}

      {editOpen && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-md rounded-lg border bg-[hsl(var(--card))] shadow-xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SupplierQuickForm
              title={`Edit supplier — ${selected.name}`}
              initial={{
                name: selected.name,
                type: selected.type,
                contact: selected.contact,
                email: selected.email,
                address: selected.address,
                company: selected.company,
                bankAccountName: selected.bankAccountName || "",
                bankIban: selected.bankIban || "",
                image: selected.image || "",
              }}
              onSave={handleEdit}
              onCancel={() => setEditOpen(false)}
              saving={saving}
            />
          </div>
        </div>
      )}
    </>
  )
}
