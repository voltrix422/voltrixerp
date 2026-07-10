"use client"
import { useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, X, Loader2 } from "lucide-react"
import { saveSupplier, type Supplier } from "@/lib/purchase"
import { formatSupplierAccountDetails, normalizeSupplierBankNames, SUPPLIER_TYPE_OPTIONS } from "@/lib/supplier-bank"
import { SupplierBankFields } from "@/components/purchase/supplier-bank-fields"
import { useToast } from "@/components/ui/toast"

const inputCls =
  "w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

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
      onSubmit={e => {
        e.preventDefault()
        e.stopPropagation()
        onSave({
          ...form,
          bankNames: normalizeSupplierBankNames(form.bankNames),
        })
      }}
      className="space-y-3"
    >
      <p className="text-sm font-semibold">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[11px] font-medium">Supplier name *</label>
          <input required value={form.name} onChange={e => set("name", e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium">Type</label>
          <select value={form.type} onChange={e => set("type", e.target.value)} className={inputCls}>
            {SUPPLIER_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium">Phone / WhatsApp</label>
          <input value={form.contact} onChange={e => set("contact", e.target.value)} placeholder="+92 300 0000000" className={inputCls} />
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
      </div>
      <SupplierBankFields
        compact
        accountTitle={form.accountTitle || ""}
        bankNames={form.bankNames && form.bankNames.length > 0 ? form.bankNames : [""]}
        bankIban={form.bankIban || ""}
        onAccountTitleChange={value => setForm(prev => ({ ...prev, accountTitle: value }))}
        onBankNamesChange={names => setForm(prev => ({ ...prev, bankNames: names }))}
        onBankIbanChange={value => setForm(prev => ({ ...prev, bankIban: value }))}
      />
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
  accountTitle: "",
  bankNames: [""],
  bankIban: "",
  image: "",
})

export function SupplierPicker({
  suppliers,
  supplierId,
  supplierName = "",
  purchaseScopeId,
  onSupplierIdChange,
  onSupplierNameChange,
  onSuppliersChange,
  onAccountDetailsChange,
  compact = false,
}: {
  suppliers: Supplier[]
  supplierId: string
  supplierName?: string
  purchaseScopeId: string
  onSupplierIdChange: (id: string) => void
  onSupplierNameChange?: (name: string) => void
  onSuppliersChange: (suppliers: Supplier[]) => void
  onAccountDetailsChange?: (details: string) => void
  compact?: boolean
}) {
  const [quickOpen, setQuickOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<"select" | "type">(() =>
    onSupplierNameChange && supplierName && !supplierId ? "type" : "select"
  )
  const { toast } = useToast()

  const selected = suppliers.find(s => s.id === supplierId)

  function selectSupplier(id: string) {
    onSupplierIdChange(id)
    const supplier = suppliers.find(s => s.id === id)
    onAccountDetailsChange?.(formatSupplierAccountDetails(supplier))
  }

  async function handleQuickAdd(data: Omit<Supplier, "id">) {
    setSaving(true)
    try {
      const supplier: Supplier = { ...data, id: Date.now().toString() }
      await saveSupplier(supplier, purchaseScopeId)
      onSuppliersChange([...suppliers, supplier])
      selectSupplier(supplier.id)
      setMode("select")
      setQuickOpen(false)
      toast({ type: "success", title: "Supplier created", message: `${supplier.name} added.`, duration: 3000 })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create supplier."
      toast({ type: "error", title: "Error", message, duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(data: Omit<Supplier, "id">) {
    if (!selected) return
    setSaving(true)
    try {
      const supplier: Supplier = { ...data, id: selected.id }
      await saveSupplier(supplier, purchaseScopeId)
      onSuppliersChange(suppliers.map(s => s.id === supplier.id ? supplier : s))
      selectSupplier(supplier.id)
      setEditOpen(false)
      toast({ type: "success", title: "Supplier updated", message: `${supplier.name} saved.`, duration: 3000 })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update supplier."
      toast({ type: "error", title: "Error", message, duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-medium text-[hsl(var(--foreground))]">Supplier</label>
          {onSupplierNameChange && (
            <div className="flex rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => setMode("select")}
                className={`px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${mode === "select" ? "bg-[#1faca6] text-white" : "bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40"}`}
              >
                Select
              </button>
              <button
                type="button"
                onClick={() => setMode("type")}
                className={`px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${mode === "type" ? "bg-[#1faca6] text-white" : "bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40"}`}
              >
                Type name
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {mode === "type" && onSupplierNameChange ? (
            <input
              value={supplierName}
              onChange={e => onSupplierNameChange(e.target.value)}
              placeholder="Type supplier name"
              className={inputCls + " flex-1 min-w-0"}
            />
          ) : (
            <select
              value={supplierId}
              onChange={e => selectSupplier(e.target.value)}
              className={inputCls + " flex-1 min-w-0"}
            >
              <option value="">Select supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2 shrink-0">
            <Button type="button" size="sm" variant="outline" className="h-8 text-[10px] flex-1 sm:flex-none cursor-pointer" onClick={() => setQuickOpen(true)}>
              <Plus className="h-3 w-3" /> Quick add
            </Button>
            {mode === "select" && selected && (
              <Button type="button" size="sm" variant="outline" className="h-8 text-[10px] flex-1 sm:flex-none cursor-pointer" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
          </div>
        </div>
        {!compact && (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Quick add a supplier now, then edit full profile anytime.
          </p>
        )}
      </div>

      {quickOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setQuickOpen(false)}>
          <div className="w-full max-w-md rounded-lg border bg-[hsl(var(--card))] shadow-xl p-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQuickOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SupplierQuickForm
              title="Quick add supplier"
              initial={emptySupplier()}
              onSave={data => void handleQuickAdd(data)}
              onCancel={() => setQuickOpen(false)}
              saving={saving}
            />
          </div>
        </div>,
        document.body,
      )}

      {editOpen && selected && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-md rounded-lg border bg-[hsl(var(--card))] shadow-xl p-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                accountTitle: selected.accountTitle || "",
                bankNames: selected.bankNames?.length ? selected.bankNames : selected.bankAccountName ? [selected.bankAccountName] : [""],
                bankIban: selected.bankIban || "",
                image: selected.image || "",
              }}
              onSave={data => void handleEdit(data)}
              onCancel={() => setEditOpen(false)}
              saving={saving}
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
