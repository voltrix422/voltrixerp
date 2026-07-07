"use client"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Upload, X, FileText, Wallet } from "lucide-react"
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
  type PurchaseCategory,
  type PurchaseLedgerEntry,
  type PurchaseLedgerItem,
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
  const amountDueNow = Math.max(0, grandTotal - payingNow)

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

  async function openNewForm() {
    resetForm()
    const next = await getNextLedgerNumber()
    setLedgerNumber(next)
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
      const payments = []
      if (payingNow > 0) {
        let proofUrl = ""
        let proofName = ""
        if (proofFile) {
          proofUrl = await uploadFile(proofFile, "payment-proofs")
          proofName = proofFile.name
        }
        payments.push({
          id: Date.now().toString(),
          amount: payingNow,
          date: transactionDate,
          proofUrl,
          proofName,
          notes: "Initial payment",
          createdAt: new Date().toISOString(),
          createdBy: user.name,
        })
      }

      const normalizedItems = lineItems
        .filter(i => i.productName.trim())
        .map(i => ({
          ...i,
          lineTotal: i.lineTotal || calcLineTotal(i),
          unitPrice: i.unitPrice || calcUnitPrice(i),
        }))

      const saved = await savePurchaseLedgerEntry({
        ledgerNumber,
        transactionDate,
        linkMode,
        projectName: linkMode === "project" ? projectName : "",
        orderId: linkMode === "order" ? orderId : null,
        orderNumber: linkMode === "order" ? (selectedOrder?.orderNumber ?? "") : "",
        supplierId: supplierId || null,
        supplierName: selectedSupplier?.name ?? "",
        productName: normalizedItems[0]?.productName ?? "",
        transactionType,
        category,
        quantity: normalizedItems.reduce((s, i) => s + i.quantity, 0),
        unitPrice: normalizedItems[0]?.unitPrice ?? 0,
        totalAmount: sumItemTotals(normalizedItems),
        amountPaid: payingNow,
        amountDue: Math.max(0, sumItemTotals(normalizedItems) - payingNow),
        items: normalizedItems,
        payments,
        notes,
        dueDate,
        accountDetails,
        paymentProofUrl: payments[0]?.proofUrl ?? "",
        paymentProofName: payments[0]?.proofName ?? "",
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="w-full sm:max-w-6xl max-h-[94vh] flex flex-col rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0 bg-[hsl(var(--muted))]/15">
              <div>
                <p className="text-sm font-semibold">New purchase entry</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Multiple items · partial payments · auto totals</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setShowForm(false)}>
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
                    <div className="min-w-0">
                      <label className="text-[10px] font-medium text-[hsl(var(--foreground))] block mb-0.5">Paying now</label>
                      <input type="number" min="0" step="any" value={amountPayingNow} onChange={e => setAmountPayingNow(e.target.value)} placeholder="0" className={inputCls} />
                      <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5">e.g. 50,000</p>
                    </div>
                    <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--card))] px-2.5 py-1.5 min-h-8">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Amount due</p>
                      <p className="text-xs font-semibold sm:mt-0.5 text-amber-700 dark:text-amber-400">{fmtMoney(amountDueNow)}</p>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                  <Field label="Note">
                    <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." className={inputCls} />
                  </Field>
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
                </div>
              </div>

              <div className="flex gap-2 px-5 py-3 border-t shrink-0 bg-[hsl(var(--muted))]/10">
                <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs flex-1 sm:flex-none sm:min-w-[120px] cursor-pointer">
                  {saving ? "Saving..." : "Save entry"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
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
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
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
