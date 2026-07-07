"use client"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Upload, X, FileText, Wallet, Receipt, Package, CreditCard, Pencil } from "lucide-react"
import { getSuppliers, type Supplier } from "@/lib/purchase"
import {
  addPurchaseLedgerPayment,
  calcLineTotal,
  calcUnitPrice,
  deletePurchaseLedgerEntry,
  formatLedgerItemsSummary,
  formatLedgerProject,
  getNextLedgerNumber,
  getPurchaseLedgerEntries,
  newLedgerItem,
  PURCHASE_CATEGORIES,
  PURCHASE_TRANSACTION_TYPES,
  savePurchaseLedgerEntry,
  sumItemTotals,
  sumPayments,
  type PurchaseCategory,
  type PurchaseLedgerEntry,
  type PurchaseLedgerItem,
  type PurchaseLedgerPayment,
  type PurchaseLinkMode,
  type PurchaseTransactionType,
} from "@/lib/purchase-ledger"
import { uploadFile } from "@/lib/upload"
import { SupplierPicker } from "@/components/purchase/supplier-picker"

const inputCls =
  "w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1 min-w-0">
    <label className="text-[11px] font-medium text-[hsl(var(--foreground))]">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">{hint}</p>}
  </div>
)

const DottedRule = () => (
  <div className="border-t border-dotted border-[hsl(var(--border))]" aria-hidden />
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

type ItemEditField = "quantity" | "unitPrice" | "lineTotal"

function updateItemField(
  items: PurchaseLedgerItem[],
  id: string,
  field: ItemEditField,
  rawValue: string,
): PurchaseLedgerItem[] {
  return items.map(item => {
    if (item.id !== id) return item
    const next = { ...item }
    if (field === "quantity") {
      next.quantity = parseFloat(rawValue) || 0
      next.lineTotal = calcLineTotal(next)
    } else if (field === "unitPrice") {
      next.unitPrice = parseFloat(rawValue) || 0
      next.lineTotal = calcLineTotal(next)
    } else {
      next.lineTotal = parseFloat(rawValue) || 0
      next.unitPrice = calcUnitPrice(next)
    }
    return next
  })
}

function categoryLabel(value: PurchaseCategory) {
  return PURCHASE_CATEGORIES.find(c => c.value === value)?.label ?? value.replace("_", " ")
}

function transactionTypeLabel(value: PurchaseTransactionType) {
  return PURCHASE_TRANSACTION_TYPES.find(t => t.value === value)?.label ?? value
}

function DetailCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border px-2.5 py-2 min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</p>
      <div className="text-xs font-medium mt-0.5 break-words">{children}</div>
    </div>
  )
}

function LedgerEntryDetailModal({
  entry,
  onClose,
  onEdit,
  onPayDue,
  onDelete,
}: {
  entry: PurchaseLedgerEntry
  onClose: () => void
  onEdit: () => void
  onPayDue: () => void
  onDelete: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-4xl max-h-[92vh] rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b shrink-0">
          <div className="h-11 w-11 rounded-lg border bg-[#1faca6]/10 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-[#1faca6]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold font-mono text-[#1faca6]">{entry.ledgerNumber}</h2>
              <Badge variant="outline" className="text-[10px] capitalize">{entry.linkMode}</Badge>
              <Badge variant="outline" className="text-[10px]">{categoryLabel(entry.category)}</Badge>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {entry.transactionDate}
              {entry.dueDate && <> · Due {entry.dueDate}</>}
              {entry.createdBy && <> · by {entry.createdBy}</>}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <DetailCell label="Supplier">{entry.supplierName || "—"}</DetailCell>
            <DetailCell label="Project / Order">{formatLedgerProject(entry)}</DetailCell>
            <DetailCell label="Transaction type">{transactionTypeLabel(entry.transactionType)}</DetailCell>
            <DetailCell label="Due date">{entry.dueDate || "—"}</DetailCell>
            <DetailCell label="Account details">{entry.accountDetails || "—"}</DetailCell>
            <DetailCell label="Note">{entry.notes?.trim() || "—"}</DetailCell>
          </div>

          <section className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2 border-b bg-[hsl(var(--muted))]/25 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-[#1faca6]" />
              <p className="text-xs font-semibold">Line items</p>
            </div>
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_72px_96px_108px] gap-2 px-3 py-1.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-b bg-[hsl(var(--muted))]/10">
              <span>Product</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit price</span>
              <span className="text-right">Line total</span>
            </div>
            <ul className="divide-y">
              {entry.items.map(item => (
                <li key={item.id} className="grid grid-cols-12 sm:grid-cols-[minmax(0,1fr)_72px_96px_108px] gap-2 px-3 py-2 text-xs items-center">
                  <span className="col-span-12 sm:col-span-1 font-medium">{item.productName}</span>
                  <span className="col-span-4 sm:col-span-1 sm:text-right tabular-nums">{item.quantity}</span>
                  <span className="col-span-4 sm:col-span-1 sm:text-right tabular-nums">{fmtMoney(item.unitPrice)}</span>
                  <span className="col-span-4 sm:col-span-1 sm:text-right font-medium tabular-nums">{fmtMoney(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t bg-[hsl(var(--muted))]/10">
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Grand total</span>
              <span className="text-sm font-semibold text-[#1faca6]">{fmtMoney(entry.totalAmount)}</span>
            </div>
          </section>

          <section className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Payment summary</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border bg-[hsl(var(--card))] px-2.5 py-2 text-center">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Total</p>
                <p className="text-sm font-semibold mt-0.5">{fmtMoney(entry.totalAmount)}</p>
              </div>
              <div className="rounded-md border bg-[hsl(var(--card))] px-2.5 py-2 text-center">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Paid</p>
                <p className="text-sm font-semibold mt-0.5 text-emerald-600">{fmtMoney(entry.amountPaid)}</p>
              </div>
              <div className="rounded-md border bg-[hsl(var(--card))] px-2.5 py-2 text-center">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Due</p>
                <p className="text-sm font-semibold mt-0.5 text-amber-700 dark:text-amber-400">{fmtMoney(entry.amountDue)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2 border-b bg-[hsl(var(--muted))]/25 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-[#1faca6]" />
              <p className="text-xs font-semibold">Payments</p>
            </div>
            {entry.payments.length === 0 && !entry.paymentProofUrl ? (
              <p className="px-3 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {entry.payments.map(p => (
                  <li key={p.id} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-emerald-600">{fmtMoney(p.amount)}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {p.date}
                        {p.notes && <> · {p.notes}</>}
                        {p.createdBy && <> · {p.createdBy}</>}
                      </p>
                    </div>
                    {p.proofUrl && (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#1faca6] hover:underline shrink-0">
                        <FileText className="h-3.5 w-3.5" /> View proof
                      </a>
                    )}
                  </li>
                ))}
                {entry.payments.length === 0 && entry.paymentProofUrl && (
                  <li className="px-3 py-2.5">
                    <a href={entry.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#1faca6] hover:underline">
                      <FileText className="h-3.5 w-3.5" /> {entry.paymentProofName || "Payment proof"}
                    </a>
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-wrap gap-2 px-4 sm:px-5 py-3 border-t shrink-0 bg-[hsl(var(--muted))]/10">
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          {entry.amountDue > 0 && (
            <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={onPayDue}>
              <Wallet className="h-3.5 w-3.5" /> Pay due
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 cursor-pointer" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
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

  const [payEntry, setPayEntry] = useState<PurchaseLedgerEntry | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [payProofFile, setPayProofFile] = useState<File | null>(null)
  const [payProofPreview, setPayProofPreview] = useState("")
  const [paySaving, setPaySaving] = useState(false)
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [existingPayments, setExistingPayments] = useState<PurchaseLedgerPayment[]>([])
  const [originalCreatedBy, setOriginalCreatedBy] = useState("")
  const [supplierNameFallback, setSupplierNameFallback] = useState("")

  const [ledgerNumber, setLedgerNumber] = useState("PL-0001")
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [linkMode, setLinkMode] = useState<PurchaseLinkMode>("general")
  const [projectName, setProjectName] = useState("")
  const [orderId, setOrderId] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [lineItems, setLineItems] = useState<PurchaseLedgerItem[]>([newLedgerItem()])
  const [transactionType, setTransactionType] = useState<PurchaseTransactionType>("purchase")
  const [category, setCategory] = useState<PurchaseCategory>("expense")
  const [amountPayingNow, setAmountPayingNow] = useState("")
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [accountDetails, setAccountDetails] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState("")

  const grandTotal = useMemo(() => sumItemTotals(lineItems), [lineItems])
  const payingNow = parseFloat(amountPayingNow) || 0
  const existingPaid = useMemo(() => sumPayments(existingPayments), [existingPayments])
  const amountDueNow = editingEntryId
    ? Math.max(0, grandTotal - existingPaid)
    : Math.max(0, grandTotal - payingNow)
  const isEditing = Boolean(editingEntryId)

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
    setEditingEntryId(null)
    setExistingPayments([])
    setOriginalCreatedBy("")
    setSupplierNameFallback("")
    setProjectName("")
    setOrderId("")
    setSupplierId("")
    setLineItems([newLedgerItem()])
    setTransactionType("purchase")
    setCategory("expense")
    setAmountPayingNow("")
    setNotes("")
    setDueDate("")
    setAccountDetails("")
    setProofFile(null)
    setProofPreview("")
    setLinkMode("general")
    setTransactionDate(new Date().toISOString().slice(0, 10))
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  async function openNewForm() {
    resetForm()
    const next = await getNextLedgerNumber()
    setLedgerNumber(next)
    setShowForm(true)
  }

  function openEditForm(entry: PurchaseLedgerEntry) {
    setEditingEntryId(entry.id)
    setExistingPayments(entry.payments)
    setOriginalCreatedBy(entry.createdBy)
    setSupplierNameFallback(entry.supplierName || "")
    setLedgerNumber(entry.ledgerNumber)
    setTransactionDate(entry.transactionDate)
    setLinkMode(entry.linkMode)
    setProjectName(entry.projectName || "")
    setOrderId(entry.orderId || "")
    setSupplierId(
      entry.supplierId
      || suppliers.find(s => s.name === entry.supplierName)?.id
      || "",
    )
    setLineItems(
      entry.items.length > 0
        ? entry.items.map(item => ({ ...item }))
        : [newLedgerItem({
          productName: entry.productName,
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
          lineTotal: entry.totalAmount,
        })],
    )
    setTransactionType(entry.transactionType)
    setCategory(entry.category)
    setNotes(entry.notes || "")
    setDueDate(entry.dueDate || "")
    setAccountDetails(entry.accountDetails || "")
    setAmountPayingNow("")
    setProofFile(null)
    setProofPreview("")
    setDetailEntryId(null)
    setShowForm(true)
  }

  function onOrderChange(id: string) {
    setOrderId(id)
    const order = orders.find(o => o.id === id)
    if (!order || order.items.length === 0) return
    setLineItems(order.items.map((item, index) => newLedgerItem({
      id: `order-${index}-${Date.now()}`,
      productName: item.description || item.name || "",
      quantity: item.qty || 1,
      unitPrice: 0,
      lineTotal: 0,
    })))
  }

  function onSupplierAccountDetails(details: string) {
    if (details) setAccountDetails(details)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (lineItems.length === 0 || !lineItems.some(i => i.productName.trim())) return
    setSaving(true)
    try {
      const normalizedItems = lineItems
        .filter(i => i.productName.trim())
        .map(i => ({
          ...i,
          lineTotal: i.lineTotal || calcLineTotal(i),
          unitPrice: i.unitPrice || calcUnitPrice(i),
        }))

      const totalAmount = sumItemTotals(normalizedItems)
      let payments: PurchaseLedgerPayment[] = []
      let amountPaid = 0
      let amountDue = totalAmount

      if (isEditing) {
        payments = existingPayments
        amountPaid = sumPayments(payments)
        amountDue = Math.max(0, totalAmount - amountPaid)
      } else if (payingNow > 0) {
        let proofUrl = ""
        let proofName = ""
        if (proofFile) {
          proofUrl = await uploadFile(proofFile, "payment-proofs")
          proofName = proofFile.name
        }
        payments = [{
          id: Date.now().toString(),
          amount: payingNow,
          date: transactionDate,
          proofUrl,
          proofName,
          notes: "Initial payment",
          createdAt: new Date().toISOString(),
          createdBy: user.name,
        }]
        amountPaid = payingNow
        amountDue = Math.max(0, totalAmount - payingNow)
      }

      const saved = await savePurchaseLedgerEntry({
        ...(isEditing ? { id: editingEntryId! } : {}),
        ledgerNumber,
        transactionDate,
        linkMode,
        projectName: linkMode === "project" ? projectName : "",
        orderId: linkMode === "order" ? orderId : null,
        orderNumber: linkMode === "order" ? (selectedOrder?.orderNumber ?? "") : "",
        supplierId: supplierId || null,
        supplierName: selectedSupplier?.name ?? supplierNameFallback,
        productName: normalizedItems[0]?.productName ?? "",
        transactionType,
        category,
        quantity: normalizedItems.reduce((s, i) => s + i.quantity, 0),
        unitPrice: normalizedItems[0]?.unitPrice ?? 0,
        totalAmount,
        amountPaid,
        amountDue,
        items: normalizedItems,
        payments,
        notes,
        dueDate,
        accountDetails,
        paymentProofUrl: payments[0]?.proofUrl ?? "",
        paymentProofName: payments[0]?.proofName ?? "",
        createdBy: isEditing ? originalCreatedBy : user.name,
      })

      if (saved) {
        setEntries(prev => isEditing
          ? prev.map(row => row.id === saved.id ? saved : row)
          : [saved, ...prev])
        const wasEditing = isEditing
        closeForm()
        if (wasEditing) setDetailEntryId(saved.id)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this purchase ledger entry?")) return
    await deletePurchaseLedgerEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
    if (detailEntryId === id) setDetailEntryId(null)
  }

  function openPayModal(entry: PurchaseLedgerEntry) {
    setPayEntry(entry)
    setPayAmount(String(entry.amountDue || 0))
    setPayNotes("")
    setPayProofFile(null)
    setPayProofPreview("")
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !payEntry) return
    const amount = parseFloat(payAmount) || 0
    if (amount <= 0) return
    setPaySaving(true)
    try {
      let proofUrl = ""
      let proofName = ""
      if (payProofFile) {
        proofUrl = await uploadFile(payProofFile, "payment-proofs")
        proofName = payProofFile.name
      }
      const updated = await addPurchaseLedgerPayment(payEntry.id, {
        amount,
        date: new Date().toISOString().slice(0, 10),
        proofUrl,
        proofName,
        notes: payNotes,
        createdBy: user.name,
      })
      if (updated) {
        setEntries(prev => prev.map(row => row.id === updated.id ? updated : row))
        setPayEntry(null)
      }
    } finally {
      setPaySaving(false)
    }
  }

  const filtered = entries.filter(e => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false
    if (filterLinkMode !== "all" && e.linkMode !== filterLinkMode) return false
    return true
  })

  const detailEntry = useMemo(
    () => (detailEntryId ? entries.find(e => e.id === detailEntryId) ?? null : null),
    [entries, detailEntryId],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Purchase Ledger</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Multiple items, auto unit/total math, and partial payments with due tracking.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4" onClick={closeForm}>
          <div className="w-full sm:max-w-6xl max-h-[94vh] flex flex-col rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0 bg-[hsl(var(--muted))]/15">
              <div>
                <p className="text-sm font-semibold">{isEditing ? "Edit purchase entry" : "New purchase entry"}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {isEditing ? "Update entry details · payments kept as recorded" : "Multiple items · partial payments · auto totals"}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={closeForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto px-5 py-4 space-y-3">
                <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-2 gap-y-2">
                  <Field label="Ledger No." hint="Auto-generated">
                    <input readOnly value={ledgerNumber} className={inputCls + " bg-[hsl(var(--muted))]/30"} />
                  </Field>
                  <Field label="Date" hint="Today">
                    <input type="date" required value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Link type">
                    <select value={linkMode} onChange={e => setLinkMode(e.target.value as PurchaseLinkMode)} className={inputCls}>
                      <option value="general">General</option>
                      <option value="project">Project based</option>
                      <option value="order">Order based</option>
                    </select>
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
                  <Field label="Due date">
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
                  </Field>
                </section>

                <DottedRule />

                {linkMode === "project" && (
                  <Field label="Project">
                    <input required value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name" className={inputCls + " max-w-md"} />
                  </Field>
                )}
                {linkMode === "order" && (
                  <Field label="Order" hint="Loads items into lines">
                    <select required value={orderId} onChange={e => onOrderChange(e.target.value)} className={inputCls + " max-w-md"}>
                      <option value="">Select order</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>{o.orderNumber} — {o.clientName}</option>
                      ))}
                    </select>
                  </Field>
                )}

                <section className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 px-3 py-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 items-start">
                    <SupplierPicker
                      suppliers={suppliers}
                      supplierId={supplierId}
                      onSupplierIdChange={setSupplierId}
                      onSuppliersChange={setSuppliers}
                      onAccountDetailsChange={onSupplierAccountDetails}
                      compact
                    />
                    <Field label="Account details" hint="From supplier bank info">
                      <input value={accountDetails} onChange={e => setAccountDetails(e.target.value)} placeholder="Bank account / IBAN" className={inputCls} />
                    </Field>
                  </div>
                </section>

                <section className="rounded-lg border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-[hsl(var(--muted))]/25">
                    <div>
                      <p className="text-xs font-semibold">Line items</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Qty × unit price ↔ line total</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => setLineItems(prev => [...prev, newLedgerItem()])}>
                      <Plus className="h-3 w-3" /> Add item
                    </Button>
                  </div>
                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_88px_120px_128px_36px] gap-3 px-3 py-1.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-b bg-[hsl(var(--muted))]/10">
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Unit price</span>
                    <span>Line total</span>
                    <span />
                  </div>
                  <div className="divide-y">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-12 sm:grid-cols-[minmax(0,1fr)_88px_120px_128px_36px] gap-3 px-3 py-2 items-center">
                        <div className="col-span-12 sm:col-span-1">
                          <label className="text-[10px] text-[hsl(var(--muted-foreground))] sm:hidden mb-0.5 block">Product</label>
                          <input required value={item.productName} onChange={e => setLineItems(prev => prev.map(row => row.id === item.id ? { ...row, productName: e.target.value } : row))} placeholder={`Item ${index + 1}`} className={inputCls} />
                        </div>
                        <div className="col-span-4 sm:col-span-1">
                          <label className="text-[10px] text-[hsl(var(--muted-foreground))] sm:hidden mb-0.5 block">Qty</label>
                          <input type="number" min="0" step="any" value={item.quantity || ""} onChange={e => setLineItems(prev => updateItemField(prev, item.id, "quantity", e.target.value))} className={inputCls} />
                        </div>
                        <div className="col-span-4 sm:col-span-1">
                          <label className="text-[10px] text-[hsl(var(--muted-foreground))] sm:hidden mb-0.5 block">Unit price</label>
                          <input type="number" min="0" step="any" value={item.unitPrice || ""} onChange={e => setLineItems(prev => updateItemField(prev, item.id, "unitPrice", e.target.value))} className={inputCls} />
                        </div>
                        <div className="col-span-4 sm:col-span-1">
                          <label className="text-[10px] text-[hsl(var(--muted-foreground))] sm:hidden mb-0.5 block">Line total</label>
                          <input type="number" min="0" step="any" value={item.lineTotal || ""} onChange={e => setLineItems(prev => updateItemField(prev, item.id, "lineTotal", e.target.value))} className={inputCls} />
                        </div>
                        <div className="col-span-12 sm:col-span-1 flex sm:justify-center">
                          {lineItems.length > 1 ? (
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-500 shrink-0" onClick={() => setLineItems(prev => prev.filter(row => row.id !== item.id))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : <span className="hidden sm:block w-8" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-2 px-3 py-2 border-t bg-[hsl(var(--muted))]/10">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Grand total</span>
                    <span className="text-sm font-semibold text-[#1faca6]">{fmtMoney(grandTotal)}</span>
                  </div>
                </section>

                <section className="rounded-lg border bg-[hsl(var(--muted))]/10 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Payment</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--card))] px-2.5 py-1.5 min-h-8">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Grand total</p>
                      <p className="text-xs font-semibold sm:mt-0.5">{fmtMoney(grandTotal)}</p>
                    </div>
                    {isEditing ? (
                      <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--card))] px-2.5 py-1.5 min-h-8">
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Paid</p>
                        <p className="text-xs font-semibold sm:mt-0.5 text-emerald-600">{fmtMoney(existingPaid)}</p>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <label className="text-[10px] font-medium text-[hsl(var(--foreground))] block mb-0.5">Paying now</label>
                        <input type="number" min="0" step="any" value={amountPayingNow} onChange={e => setAmountPayingNow(e.target.value)} placeholder="0" className={inputCls} />
                        <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5">e.g. 50,000</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--card))] px-2.5 py-1.5 min-h-8">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Amount due</p>
                      <p className="text-xs font-semibold sm:mt-0.5 text-amber-700 dark:text-amber-400">{fmtMoney(amountDueNow)}</p>
                    </div>
                  </div>
                  {isEditing && (
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-2">Use Pay due from the ledger to add more payments.</p>
                  )}
                </section>

                <div className={`grid gap-2 items-end ${isEditing ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-[1fr_auto]"}`}>
                  <Field label="Note">
                    <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." className={inputCls} />
                  </Field>
                  {!isEditing && (
                    <div className="min-w-0 sm:min-w-[220px]">
                      <label className="text-[11px] font-medium text-[hsl(var(--foreground))] block mb-1">Payment proof</label>
                      <label className="inline-flex items-center gap-2 h-8 px-3 rounded-md border text-xs cursor-pointer hover:bg-[hsl(var(--muted))]/30 w-full">
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{proofPreview || "Upload screenshot"}</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                          const file = e.target.files?.[0] ?? null
                          setProofFile(file)
                          setProofPreview(file?.name ?? "")
                        }} />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 px-5 py-3 border-t shrink-0 bg-[hsl(var(--muted))]/10">
                <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs flex-1 sm:flex-none sm:min-w-[120px] cursor-pointer">
                  {saving ? "Saving..." : isEditing ? "Save changes" : "Save entry"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailEntry && (
        <LedgerEntryDetailModal
          entry={detailEntry}
          onClose={() => setDetailEntryId(null)}
          onEdit={() => openEditForm(detailEntry)}
          onPayDue={() => {
            openPayModal(detailEntry)
          }}
          onDelete={() => void handleDelete(detailEntry.id)}
        />
      )}

      {payEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setPayEntry(null)}>
          <div className="w-full max-w-md rounded-lg border bg-[hsl(var(--card))] shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <p className="text-sm font-semibold">Add payment</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{payEntry.ledgerNumber} · Due {fmtMoney(payEntry.amountDue)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPayEntry(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleAddPayment} className="p-4 space-y-3">
              <Field label="Payment amount">
                <input type="number" min="0" step="any" required value={payAmount} onChange={e => setPayAmount(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Note">
                <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="e.g. Second installment" className={inputCls} />
              </Field>
              <Field label="Payment proof screenshot">
                <label className="inline-flex items-center gap-2 h-8 px-3 rounded-md border text-xs cursor-pointer hover:bg-[hsl(var(--muted))]/30">
                  <Upload className="h-3.5 w-3.5" /> Upload proof
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                    const file = e.target.files?.[0] ?? null
                    setPayProofFile(file)
                    setPayProofPreview(file?.name ?? "")
                  }} />
                </label>
                {payProofPreview && <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 truncate">{payProofPreview}</p>}
              </Field>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={paySaving} className="h-8 text-xs flex-1 cursor-pointer">
                  {paySaving ? "Saving..." : "Record payment"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setPayEntry(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-xs min-w-[1300px]">
          <thead>
            <tr className="border-b bg-[hsl(var(--muted))]/40">
              {[
                "Ledger No.", "Date", "Project / Order", "Supplier", "Items",
                "Category", "Total", "Paid", "Due", "Due Date", "Payments", "",
              ].map(h => (
                <th key={h} className="h-9 px-2 text-left font-medium text-[hsl(var(--muted-foreground))] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">No purchase entries yet. Click &quot;New purchase&quot; to add one.</td></tr>
            )}
            {filtered.map(entry => (
              <tr
                key={entry.id}
                className="hover:bg-[hsl(var(--muted))]/20 cursor-pointer"
                onClick={() => setDetailEntryId(entry.id)}
              >
                <td className="px-2 py-2 font-medium text-[#1faca6]">{entry.ledgerNumber}</td>
                <td className="px-2 py-2 whitespace-nowrap">{entry.transactionDate}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-0.5">
                    <Badge variant="outline" className="text-[10px] w-fit">{entry.linkMode}</Badge>
                    <span>{formatLedgerProject(entry)}</span>
                  </div>
                </td>
                <td className="px-2 py-2">{entry.supplierName || "—"}</td>
                <td className="px-2 py-2 max-w-[180px]">
                  <p className="truncate" title={formatLedgerItemsSummary(entry)}>{formatLedgerItemsSummary(entry)}</p>
                  {entry.items.length > 1 && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{entry.items.length} items</p>
                  )}
                </td>
                <td className="px-2 py-2 capitalize">{entry.category.replace("_", " ")}</td>
                <td className="px-2 py-2 font-medium">{fmtMoney(entry.totalAmount)}</td>
                <td className="px-2 py-2 text-emerald-600">{fmtMoney(entry.amountPaid)}</td>
                <td className="px-2 py-2 text-amber-600 font-medium">{fmtMoney(entry.amountDue)}</td>
                <td className="px-2 py-2 whitespace-nowrap">{entry.dueDate || "—"}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-1">
                    {entry.payments.map(p => (
                      <div key={p.id} className="flex items-center gap-1">
                        <span>{fmtMoney(p.amount)}</span>
                        {p.proofUrl && (
                          <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-[#1faca6] hover:underline">
                            <FileText className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                    {entry.payments.length === 0 && entry.paymentProofUrl && (
                      <a href={entry.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#1faca6] hover:underline">
                        <FileText className="h-3 w-3" /> Proof
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" title="Edit" onClick={() => openEditForm(entry)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {entry.amountDue > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => openPayModal(entry)}>
                        <Wallet className="h-3 w-3" /> Pay due
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 cursor-pointer" onClick={() => void handleDelete(entry.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
