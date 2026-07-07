"use client"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Upload, X, FileText } from "lucide-react"
import { getSuppliers, type Supplier } from "@/lib/purchase"
import {
  deletePurchaseLedgerEntry,
  formatLedgerProject,
  getNextLedgerNumber,
  getPurchaseLedgerEntries,
  PURCHASE_CATEGORIES,
  PURCHASE_TRANSACTION_TYPES,
  savePurchaseLedgerEntry,
  type PurchaseCategory,
  type PurchaseLedgerEntry,
  type PurchaseLinkMode,
  type PurchaseTransactionType,
} from "@/lib/purchase-ledger"
import { uploadFile } from "@/lib/upload"

const inputCls =
  "w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-[hsl(var(--foreground))]">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{hint}</p>}
  </div>
)

function fmtMoney(n: number) {
  return `Rs. ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
}

interface OrderOption {
  id: string
  orderNumber: string
  clientName: string
  items: Array<{ description?: string; name?: string; qty?: number }>
}

export function PurchaseLedgerManager() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<PurchaseLedgerEntry[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterLinkMode, setFilterLinkMode] = useState<string>("all")

  const [ledgerNumber, setLedgerNumber] = useState("PL-0001")
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [linkMode, setLinkMode] = useState<PurchaseLinkMode>("general")
  const [projectName, setProjectName] = useState("")
  const [orderId, setOrderId] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [productName, setProductName] = useState("")
  const [transactionType, setTransactionType] = useState<PurchaseTransactionType>("purchase")
  const [category, setCategory] = useState<PurchaseCategory>("expense")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [accountDetails, setAccountDetails] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState("")

  const totalAmount = useMemo(() => {
    const q = parseFloat(quantity) || 0
    const p = parseFloat(unitPrice) || 0
    return q * p
  }, [quantity, unitPrice])

  const selectedOrder = orders.find(o => o.id === orderId)
  const selectedSupplier = suppliers.find(s => s.id === supplierId)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [ledgerRows, supplierRows, orderRes] = await Promise.all([
        getPurchaseLedgerEntries(),
        getSuppliers(),
        fetch("/api/db/orders?statusGroup=approved"),
      ])
      setEntries(ledgerRows)
      setSuppliers(supplierRows)
      if (orderRes.ok) {
        const orderData = await orderRes.json()
        setOrders((orderData ?? []).map((o: Record<string, unknown>) => ({
          id: o.id as string,
          orderNumber: o.orderNumber as string,
          clientName: o.clientName as string,
          items: Array.isArray(o.items) ? o.items as OrderOption["items"] : [],
        })))
      }
      setLoading(false)
    }
    void load()
  }, [])

  function resetForm() {
    setProjectName("")
    setOrderId("")
    setSupplierId("")
    setProductName("")
    setTransactionType("purchase")
    setCategory("expense")
    setQuantity("1")
    setUnitPrice("")
    setNotes("")
    setDueDate("")
    setAccountDetails("")
    setProofFile(null)
    setProofPreview("")
    setLinkMode("general")
    setTransactionDate(new Date().toISOString().slice(0, 10))
  }

  async function openNewForm() {
    resetForm()
    const next = await getNextLedgerNumber()
    setLedgerNumber(next)
    setShowForm(true)
  }

  function onSupplierChange(id: string) {
    setSupplierId(id)
    const supplier = suppliers.find(s => s.id === id)
    if (!supplier) return
    const parts = [supplier.bankAccountName, supplier.bankIban].filter(Boolean)
    if (parts.length) setAccountDetails(parts.join(" · "))
  }

  function onOrderChange(id: string) {
    setOrderId(id)
    const order = orders.find(o => o.id === id)
    if (!order) return
    const firstItem = order.items[0]
    if (firstItem) {
      setProductName(firstItem.description || firstItem.name || "")
      if (firstItem.qty) setQuantity(String(firstItem.qty))
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      let paymentProofUrl = ""
      let paymentProofName = ""
      if (proofFile) {
        paymentProofUrl = await uploadFile(proofFile, "payment-proofs")
        paymentProofName = proofFile.name
      }

      const saved = await savePurchaseLedgerEntry({
        ledgerNumber,
        transactionDate,
        linkMode,
        projectName: linkMode === "project" ? projectName : "",
        orderId: linkMode === "order" ? orderId : null,
        orderNumber: linkMode === "order" ? (selectedOrder?.orderNumber ?? "") : "",
        supplierId: supplierId || null,
        supplierName: selectedSupplier?.name ?? "",
        productName,
        transactionType,
        category,
        quantity: parseFloat(quantity) || 0,
        unitPrice: parseFloat(unitPrice) || 0,
        totalAmount,
        notes,
        dueDate,
        accountDetails,
        paymentProofUrl,
        paymentProofName,
        createdBy: user.name,
      })

      if (saved) {
        setEntries(prev => [saved, ...prev])
        setShowForm(false)
        resetForm()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this purchase ledger entry?")) return
    await deletePurchaseLedgerEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const filtered = entries.filter(e => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false
    if (filterLinkMode !== "all" && e.linkMode !== filterLinkMode) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Purchase Ledger</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Record project-based, order-based, and general purchases with categories and payment proof.
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => void openNewForm()}>
          <Plus className="h-3.5 w-3.5" /> New purchase
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filterLinkMode} onChange={e => setFilterLinkMode(e.target.value)} className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs">
          <option value="all">All link types</option>
          <option value="project">Project based</option>
          <option value="order">Order based</option>
          <option value="general">General</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs">
          <option value="all">All categories</option>
          {PURCHASE_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">New purchase entry</p>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Ledger No." hint="Auto-generated">
              <input readOnly value={ledgerNumber} className={inputCls + " bg-[hsl(var(--muted))]/30"} />
            </Field>
            <Field label="Date" hint="Defaults to today">
              <input type="date" required value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Link type">
              <select value={linkMode} onChange={e => setLinkMode(e.target.value as PurchaseLinkMode)} className={inputCls}>
                <option value="general">General</option>
                <option value="project">Project based</option>
                <option value="order">Order based</option>
              </select>
            </Field>

            {linkMode === "project" && (
              <Field label="Project">
                <input required value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name" className={inputCls} />
              </Field>
            )}

            {linkMode === "order" && (
              <Field label="Order" hint="Auto-fills product from first order line">
                <select required value={orderId} onChange={e => onOrderChange(e.target.value)} className={inputCls}>
                  <option value="">Select order</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>{o.orderNumber} — {o.clientName}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Supplier">
              <select value={supplierId} onChange={e => onSupplierChange(e.target.value)} className={inputCls}>
                <option value="">Select supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Product name">
              <input required value={productName} onChange={e => setProductName(e.target.value)} placeholder="Product or service" className={inputCls} />
            </Field>

            <Field label="Transaction type">
              <select value={transactionType} onChange={e => setTransactionType(e.target.value as PurchaseTransactionType)} className={inputCls}>
                {PURCHASE_TRANSACTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Category">
              <select value={category} onChange={e => setCategory(e.target.value as PurchaseCategory)} className={inputCls}>
                {PURCHASE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Quantity">
              <input type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputCls} />
            </Field>

            <Field label="Unit price">
              <input type="number" min="0" step="any" required value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className={inputCls} />
            </Field>

            <Field label="Total amount" hint="Auto: quantity × unit price">
              <input readOnly value={fmtMoney(totalAmount)} className={inputCls + " bg-[hsl(var(--muted))]/30 font-medium"} />
            </Field>

            <Field label="Due date">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </Field>

            <Field label="Account details" hint="Auto-filled from supplier bank info">
              <input value={accountDetails} onChange={e => setAccountDetails(e.target.value)} placeholder="Bank account / IBAN" className={inputCls} />
            </Field>
          </div>

          <Field label="Note">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls + " h-auto py-2"} />
          </Field>

          <Field label="Payment proof">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 h-9 px-3 rounded-md border text-xs cursor-pointer hover:bg-[hsl(var(--muted))]/30">
                <Upload className="h-3.5 w-3.5" /> Upload proof
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  setProofFile(file)
                  setProofPreview(file?.name ?? "")
                }} />
              </label>
              {proofPreview && <span className="text-xs text-[hsl(var(--muted-foreground))]">{proofPreview}</span>}
            </div>
          </Field>

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs cursor-pointer">
              {saving ? "Saving..." : "Save entry"}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-xs min-w-[1200px]">
          <thead>
            <tr className="border-b bg-[hsl(var(--muted))]/40">
              {[
                "Ledger No.", "Date", "Project / Order", "Supplier", "Product Name",
                "Transaction Type", "Category", "Qty", "Unit Price", "Total",
                "Note", "Due Date", "Account Details", "Payment Proof", "",
              ].map(h => (
                <th key={h} className="h-9 px-2 text-left font-medium text-[hsl(var(--muted-foreground))] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={15} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={15} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">No purchase entries yet. Click &quot;New purchase&quot; to add one.</td></tr>
            )}
            {filtered.map(entry => (
              <tr key={entry.id} className="hover:bg-[hsl(var(--muted))]/20">
                <td className="px-2 py-2 font-medium text-[#1faca6]">{entry.ledgerNumber}</td>
                <td className="px-2 py-2 whitespace-nowrap">{entry.transactionDate}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-0.5">
                    <Badge variant="outline" className="text-[10px] w-fit">{entry.linkMode}</Badge>
                    <span>{formatLedgerProject(entry)}</span>
                  </div>
                </td>
                <td className="px-2 py-2">{entry.supplierName || "—"}</td>
                <td className="px-2 py-2">{entry.productName}</td>
                <td className="px-2 py-2 capitalize">{entry.transactionType}</td>
                <td className="px-2 py-2 capitalize">{entry.category.replace("_", " ")}</td>
                <td className="px-2 py-2">{entry.quantity}</td>
                <td className="px-2 py-2">{fmtMoney(entry.unitPrice)}</td>
                <td className="px-2 py-2 font-medium">{fmtMoney(entry.totalAmount)}</td>
                <td className="px-2 py-2 max-w-[140px] truncate" title={entry.notes}>{entry.notes || "—"}</td>
                <td className="px-2 py-2 whitespace-nowrap">{entry.dueDate || "—"}</td>
                <td className="px-2 py-2 max-w-[160px] truncate" title={entry.accountDetails}>{entry.accountDetails || "—"}</td>
                <td className="px-2 py-2">
                  {entry.paymentProofUrl ? (
                    <a href={entry.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#1faca6] hover:underline">
                      <FileText className="h-3 w-3" /> View
                    </a>
                  ) : "—"}
                </td>
                <td className="px-2 py-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 cursor-pointer" onClick={() => void handleDelete(entry.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
