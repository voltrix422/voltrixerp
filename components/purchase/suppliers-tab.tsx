"use client"
import { useEffect, useMemo, useState } from "react"
import { getSuppliers, saveSupplier, deleteSupplier, type Supplier } from "@/lib/purchase"
import { getPurchaseLedgerEntries, formatLedgerItemsSummary, formatLedgerProject, formatLinkModeLabel, type PurchaseLedgerEntry } from "@/lib/purchase-ledger"
import { LedgerEntryDetailModal } from "@/components/purchase/ledger-entry-detail-modal"
import {
  downloadPurchaseLedgerEntryExcel,
  downloadPurchaseLedgerEntryPDF,
} from "@/lib/purchase-ledger-export"
import {
  assignSupplierPurchaseRanks,
  getEntriesForSupplier,
  sortSuppliersByPurchases,
  type SupplierPurchaseInfo,
} from "@/lib/supplier-purchase-stats"
import { formatSupplierAccountDetails, normalizeSupplierBankNames, SUPPLIER_TYPE_OPTIONS, supplierTypeLabel } from "@/lib/supplier-bank"
import { SupplierBankFields } from "@/components/purchase/supplier-bank-fields"
import { formatCurrency } from "@/lib/pos"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDialog } from "@/components/ui/dialog-provider"
import { useToast } from "@/components/ui/toast"
import {
  Plus, Search, X, Phone, Mail, MapPin, Building2, Loader2, Pencil, Trash2,
  Landmark, CreditCard, Package, Receipt, Crown, FileText,
} from "lucide-react"

const empty = (): Omit<Supplier, "id"> => ({
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

function SupplierForm({ initial, onSave, onCancel, isLoading }: {
  initial: Omit<Supplier, "id">
  onSave: (s: Omit<Supplier, "id">) => void
  onCancel: () => void
  isLoading?: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => {
      e.preventDefault()
      onSave({
        ...form,
        bankNames: normalizeSupplierBankNames(form.bankNames),
      })
    }} className="border rounded-lg p-4 space-y-3 bg-[hsl(var(--muted))]/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Supplier name *</label>
          <input required value={form.name} onChange={e => set("name", e.target.value)} className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Company</label>
          <input value={form.company} onChange={e => set("company", e.target.value)} className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Type</label>
          <select value={form.type} onChange={e => set("type", e.target.value)} className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm">
            {SUPPLIER_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Phone / WhatsApp</label>
          <input value={form.contact} onChange={e => set("contact", e.target.value)} className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Email</label>
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Address</label>
          <input value={form.address} onChange={e => set("address", e.target.value)} className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm" />
        </div>
      </div>
      <SupplierBankFields
        accountTitle={form.accountTitle || ""}
        bankNames={form.bankNames && form.bankNames.length > 0 ? form.bankNames : [""]}
        bankIban={form.bankIban || ""}
        onAccountTitleChange={value => setForm(f => ({ ...f, accountTitle: value }))}
        onBankNamesChange={names => setForm(f => ({ ...f, bankNames: names }))}
        onBankIbanChange={value => setForm(f => ({ ...f, bankIban: value }))}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-8 cursor-pointer" disabled={isLoading}>
          {isLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Saving...</> : "Save supplier"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" onClick={onCancel} disabled={isLoading}>Cancel</Button>
      </div>
    </form>
  )
}

function SupplierDetail({
  supplier,
  purchaseInfo,
  allEntries,
  onClose,
  onEdit,
  onDelete,
}: {
  supplier: Supplier
  purchaseInfo?: SupplierPurchaseInfo
  allEntries: PurchaseLedgerEntry[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [ledgerEntryId, setLedgerEntryId] = useState<string | null>(null)

  const supplierEntries = useMemo(
    () => getEntriesForSupplier(allEntries, supplier),
    [allEntries, supplier],
  )

  const ledgerEntry = useMemo(
    () => (ledgerEntryId ? allEntries.find(e => e.id === ledgerEntryId) ?? null : null),
    [allEntries, ledgerEntryId],
  )

  const filteredEntries = useMemo(() => {
    return supplierEntries
      .filter(entry => {
        if (dateFrom && entry.transactionDate < dateFrom) return false
        if (dateTo && entry.transactionDate > dateTo) return false
        return true
      })
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
  }, [supplierEntries, dateFrom, dateTo])

  const entriesTotal = filteredEntries.reduce((s, e) => s + e.totalAmount, 0)
  const entriesPaid = filteredEntries.reduce((s, e) => s + e.amountPaid, 0)
  const entriesDue = filteredEntries.reduce((s, e) => s + e.amountDue, 0)
  const isTopSupplier = purchaseInfo?.purchaseRank != null && purchaseInfo.purchaseRank > 0 && purchaseInfo.purchaseRank <= 3

  const bankNames = (supplier.bankNames?.length ? supplier.bankNames : supplier.bankAccountName ? [supplier.bankAccountName] : []).join(", ")

  const infoItems = [
    { icon: Phone, label: "Phone", value: supplier.contact },
    { icon: Mail, label: "Email", value: supplier.email },
    { icon: MapPin, label: "Address", value: supplier.address },
    { icon: Building2, label: "Company", value: supplier.company },
    { icon: Landmark, label: "Account title", value: supplier.accountTitle },
    { icon: Landmark, label: "Bank name", value: bankNames },
    { icon: CreditCard, label: "IBAN", value: supplier.bankIban },
  ]

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-t-xl sm:rounded-lg border bg-[hsl(var(--card))] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b shrink-0">
          {supplier.image ? (
            <img src={supplier.image} alt={supplier.name} className="h-12 w-12 rounded-full object-cover border shrink-0" />
          ) : (
            <div className="h-12 w-12 rounded-full border bg-[#1faca6]/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-[#1faca6]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold truncate">{supplier.name}</h2>
              {isTopSupplier && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  <Crown className="h-3 w-3 fill-amber-500 text-amber-500" />
                  Top {purchaseInfo!.purchaseRank} supplier
                </span>
              )}
              <Badge
                variant={supplier.type === "local" ? "success" : supplier.type === "trade" ? "warning" : "info"}
                className="text-[10px]"
              >
                {supplierTypeLabel(supplier.type)}
              </Badge>
            </div>
            {supplier.company && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{supplier.company}</p>}
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
              {purchaseInfo?.entryCount ?? 0} ledger entries
              {(purchaseInfo?.totalPurchases ?? 0) > 0 && (
                <> · <span className="font-semibold text-[#1faca6]">{formatCurrency(purchaseInfo!.totalPurchases)}</span> total</>
              )}
              {(purchaseInfo?.totalDue ?? 0) > 0 && (
                <> · <span className="font-semibold text-amber-600">{formatCurrency(purchaseInfo!.totalDue)}</span> due</>
              )}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 sm:px-5 py-3 border-b">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {infoItems.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-md border px-2.5 py-2 min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                    <Icon className="h-3 w-3 shrink-0" /> {label}
                  </p>
                  <p className="text-xs font-medium truncate mt-0.5">{value?.trim() || "—"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 sm:px-5 py-3 border-b">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                <Receipt className="h-3.5 w-3.5 text-[#1faca6]" />
                Purchase ledger
              </div>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs" />
              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs" />
              {(dateFrom || dateTo) && (
                <button type="button" onClick={() => { setDateFrom(""); setDateTo("") }} className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer">
                  Clear
                </button>
              )}
              <div className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0 tabular-nums ml-auto">
                <span className="font-semibold text-[hsl(var(--foreground))]">{filteredEntries.length}</span> entries
                {filteredEntries.length > 0 && (
                  <> · <span className="font-semibold text-[#1faca6]">{formatCurrency(entriesTotal)}</span>
                  {entriesDue > 0 && <> · <span className="text-amber-600">{formatCurrency(entriesDue)} due</span></>}
                  </>
                )}
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-xs text-[hsl(var(--muted-foreground))]">
                <Package className="h-8 w-8 mx-auto opacity-30 mb-2" />
                {supplierEntries.length === 0 ? "No purchase ledger entries linked to this supplier yet." : "No entries in this filter."}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="hidden sm:grid sm:grid-cols-[100px_minmax(0,1fr)_88px_88px_88px_88px_72px] gap-2 px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  <span>Ledger</span>
                  <span>Items / project</span>
                  <span>Date</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">Paid</span>
                  <span className="text-right">Due</span>
                  <span>Proof</span>
                </div>
                <ul className="divide-y max-h-[240px] overflow-y-auto">
                  {filteredEntries.map(entry => (
                    <li
                      key={entry.id}
                      className="px-3 py-2.5 hover:bg-[hsl(var(--muted))]/10 cursor-pointer sm:grid sm:grid-cols-[100px_minmax(0,1fr)_88px_88px_88px_88px_72px] sm:gap-2 sm:items-center"
                      onClick={() => setLedgerEntryId(entry.id)}
                    >
                      <p className="text-xs font-semibold text-[#1faca6] font-mono">{entry.ledgerNumber}</p>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{formatLedgerItemsSummary(entry)}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                          {formatLinkModeLabel(entry.linkMode)} · {formatLedgerProject(entry)}
                        </p>
                      </div>
                      <p className="text-[11px] tabular-nums">{entry.transactionDate}</p>
                      <p className="text-[11px] text-right tabular-nums font-medium">{formatCurrency(entry.totalAmount)}</p>
                      <p className="text-[11px] text-right tabular-nums text-emerald-600">{formatCurrency(entry.amountPaid)}</p>
                      <p className="text-[11px] text-right tabular-nums text-amber-600">{formatCurrency(entry.amountDue)}</p>
                      <div onClick={e => e.stopPropagation()}>
                        {entry.paymentProofUrl ? (
                          <a href={entry.paymentProofUrl} target="_blank" rel="noreferrer" className="text-[#1faca6] hover:underline inline-flex items-center gap-1 text-[10px]">
                            <FileText className="h-3 w-3" /> View
                          </a>
                        ) : entry.payments.some(p => p.proofUrl) ? (
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{entry.payments.length} payments</span>
                        ) : "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-t shrink-0 bg-[hsl(var(--muted))]/10">
          <Button size="sm" variant="outline" className="h-9 text-xs cursor-pointer" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit profile
          </Button>
          <Button size="sm" variant="ghost" className="h-9 text-xs text-red-500 hover:text-red-600 cursor-pointer" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="h-9 text-xs ml-auto cursor-pointer" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>

    {ledgerEntry && (
      <LedgerEntryDetailModal
        entry={ledgerEntry}
        onClose={() => setLedgerEntryId(null)}
        readOnly
        onExportExcel={() => downloadPurchaseLedgerEntryExcel(ledgerEntry)}
        onExportPdf={() => void downloadPurchaseLedgerEntryPDF(ledgerEntry)}
      />
    )}
    </>
  )
}

export function SuppliersTab({ purchaseScopeId }: { purchaseScopeId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [entries, setEntries] = useState<PurchaseLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const { confirm } = useDialog()
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [supplierRows, entryRows] = await Promise.all([
        getSuppliers(purchaseScopeId),
        getPurchaseLedgerEntries(purchaseScopeId),
      ])
      setSuppliers(supplierRows)
      setEntries(entryRows)
      setLoading(false)
    }
    void load()
    const interval = setInterval(() => {
      Promise.all([getSuppliers(purchaseScopeId), getPurchaseLedgerEntries(purchaseScopeId)]).then(([s, e]) => {
        setSuppliers(s)
        setEntries(e)
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [purchaseScopeId])

  const statsMap = useMemo(
    () => assignSupplierPurchaseRanks(suppliers, entries),
    [suppliers, entries],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const matched = suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.company.toLowerCase().includes(q) ||
      s.contact.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    )
    return sortSuppliersByPurchases(matched, statsMap)
  }, [suppliers, search, statsMap])

  async function handleAdd(data: Omit<Supplier, "id">) {
    setSaving(true)
    const s: Supplier = { ...data, id: Date.now().toString() }
    try {
      await saveSupplier(s, purchaseScopeId)
      setSuppliers(prev => [...prev, s])
      setAdding(false)
      toast({ type: "success", title: "Supplier created", message: `${s.name} added.`, duration: 3000 })
    } catch {
      toast({ type: "error", title: "Error", message: "Failed to create supplier.", duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id: string, data: Omit<Supplier, "id">) {
    setSaving(true)
    const s: Supplier = { ...data, id }
    try {
      await saveSupplier(s, purchaseScopeId)
      setSuppliers(prev => prev.map(x => x.id === id ? s : x))
      setEditId(null)
      setSelected(s)
      toast({ type: "success", title: "Supplier updated", message: `${s.name} saved.`, duration: 3000 })
    } catch {
      toast({ type: "error", title: "Error", message: "Failed to update supplier.", duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      type: "confirm",
      title: "Delete supplier",
      message: "This supplier will be permanently removed.",
      confirmLabel: "Delete",
    })
    if (!ok) return
    await deleteSupplier(id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
    setSelected(null)
  }

  const editingSupplier = suppliers.find(s => s.id === editId)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-48">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search suppliers..."
            className="w-full h-9 pl-6 pr-2 border-b-2 border-t-0 border-x-0 border-[hsl(var(--border))] bg-transparent text-sm focus:outline-none focus:border-[hsl(var(--primary))]"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {loading ? "Loading..." : `${suppliers.length} supplier${suppliers.length !== 1 ? "s" : ""}`}
          </p>
          <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => { setAdding(true); setEditId(null) }}>
            <Plus className="h-3.5 w-3.5" /> Add supplier
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--muted-foreground))] mx-auto" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading suppliers...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {suppliers.length === 0 ? "No suppliers yet. Add your first supplier." : "No suppliers match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
          {filtered.map(supplier => {
            const stats = statsMap.get(supplier.id)
            const isTop = stats?.purchaseRank != null && stats.purchaseRank > 0 && stats.purchaseRank <= 3
            return (
              <div
                key={supplier.id}
                onClick={() => setSelected(supplier)}
                className="group relative flex flex-col items-center text-center space-y-2 cursor-pointer"
              >
                {isTop && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <Crown className="h-3 w-3 fill-amber-500 text-amber-500" />
                    Top {stats!.purchaseRank}
                  </div>
                )}
                {supplier.image ? (
                  <img src={supplier.image} alt={supplier.name} className={`h-16 w-16 rounded-full object-cover shadow-md ${isTop ? "ring-2 ring-amber-400 ring-offset-2" : ""}`} />
                ) : (
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center shadow-md ${
                    isTop
                      ? "bg-gradient-to-br from-amber-200 via-amber-100 to-amber-50 ring-2 ring-amber-400 ring-offset-2"
                      : "bg-gradient-to-br from-[#1faca6]/30 via-[#1faca6]/20 to-[#1faca6]/10"
                  }`}>
                    <Building2 className={`h-8 w-8 ${isTop ? "text-amber-700" : "text-[#1faca6]"}`} />
                  </div>
                )}
                <p className={`text-xs font-semibold truncate w-full px-1 ${isTop ? "text-amber-700 dark:text-amber-300" : ""}`}>
                  {supplier.name}
                </p>
                {supplier.company && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate w-full px-1">{supplier.company}</p>
                )}
                {(stats?.totalPurchases ?? 0) > 0 && (
                  <p className="text-[10px] font-medium text-[#1faca6] tabular-nums">{formatCurrency(stats!.totalPurchases)}</p>
                )}
                {(stats?.entryCount ?? 0) > 0 && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{stats!.entryCount} entries</p>
                )}
                <Badge
                  variant={supplier.type === "local" ? "success" : supplier.type === "trade" ? "warning" : "info"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {supplierTypeLabel(supplier.type)}
                </Badge>
              </div>
            )
          })}
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setAdding(false)}>
          <div className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <p className="text-sm font-semibold">Add supplier</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAdding(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-5">
              <SupplierForm initial={empty()} onSave={handleAdd} onCancel={() => setAdding(false)} isLoading={saving} />
            </div>
          </div>
        </div>
      )}

      {editId && editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditId(null)}>
          <div className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Edit supplier</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
            </div>
            <SupplierForm
              initial={{
                name: editingSupplier.name,
                type: editingSupplier.type,
                contact: editingSupplier.contact,
                email: editingSupplier.email,
                address: editingSupplier.address,
                company: editingSupplier.company,
                accountTitle: editingSupplier.accountTitle || "",
                bankNames: editingSupplier.bankNames?.length ? editingSupplier.bankNames : editingSupplier.bankAccountName ? [editingSupplier.bankAccountName] : [""],
                bankIban: editingSupplier.bankIban || "",
                image: editingSupplier.image || "",
              }}
              onSave={data => handleEdit(editId, data)}
              onCancel={() => setEditId(null)}
              isLoading={saving}
            />
          </div>
        </div>
      )}

      {selected && !editId && (
        <SupplierDetail
          supplier={selected}
          purchaseInfo={statsMap.get(selected.id)}
          allEntries={entries}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditId(selected.id); setSelected(null) }}
          onDelete={() => handleDelete(selected.id)}
        />
      )}
    </div>
  )
}
