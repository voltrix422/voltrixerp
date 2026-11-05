"use client"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/components/auth-provider"
import { Plus, Upload, X, FileText, Trash2, Eye, Wallet } from "lucide-react"
import { getPettyCashAllocations, getPettyCashReceipts, type PettyCashAllocation } from "@/lib/petty-cash"
import { FinanceLoans } from "@/components/finance/finance-loans"
import { cn } from "@/lib/utils"

interface FinanceRecord {
  id: string
  title: string
  amount: number
  currency: string
  purpose: string
  category: string
  tag: string
  supplier_name: string
  receipt_person_name: string
  petty_cash_allocation_id?: string
  petty_cash_receipt_id?: string
  petty_cash_label?: string
  proof_url: string
  proof_name: string
  notes: string
  created_by: string
  createdAt: string
  loan_person?: string
  loan_direction?: string
  loan_parent_id?: string
}

const CATEGORIES = ["Payment", "Expense", "Invoice", "Salary", "Tax", "Refund", "Loan", "Other"]
const FILTER_CATEGORIES = [...CATEGORIES, "Loan Given", "Loan Repayment", "Loan Recovery"]
const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED"]

const CATEGORY_STYLES: Record<string, string> = {
  Payment:  "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400",
  Expense:  "bg-red-500/10 text-red-700 border-red-200 dark:text-red-400",
  Invoice:  "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400",
  Salary:   "bg-green-500/10 text-green-700 border-green-200 dark:text-green-400",
  Tax:      "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-400",
  Refund:   "bg-teal-500/10 text-teal-700 border-teal-200 dark:text-teal-400",
  Loan:     "bg-amber-500/10 text-amber-800 border-amber-200 dark:text-amber-400",
  "Loan Given":     "bg-rose-500/10 text-rose-700 border-rose-200 dark:text-rose-400",
  "Loan Repayment": "bg-rose-500/10 text-rose-700 border-rose-200 dark:text-rose-400",
  "Loan Recovery":  "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400",
  Other:    "bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-400",
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-medium text-[#86868b]">{label}</label>
    {children}
  </div>
)

const inputCls =
  "w-full h-10 rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35 transition-colors"

interface FinanceManagerProps {
  search: string
  dateFrom: string
  dateTo: string
  initialCategory?: string
  openAddLoan?: boolean
}

export function FinanceManager({
  search,
  dateFrom,
  dateTo,
  initialCategory,
  openAddLoan,
}: FinanceManagerProps) {
  const { user } = useAuth()
  const [records, setRecords] = useState<FinanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [viewRecord, setViewRecord] = useState<FinanceRecord | null>(null)

  // filters
  const [filterCategory, setFilterCategory] = useState("All")
  const [filterTag, setFilterTag] = useState("All")

  // form
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("PKR")
  const [purpose, setPurpose] = useState("")
  const [category, setCategory] = useState("Payment")
  const [tag, setTag] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [receiptPersonName, setReceiptPersonName] = useState("")
  const [notes, setNotes] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState("")
  const [pettyCashAllocationId, setPettyCashAllocationId] = useState("")
  const [activePettyCash, setActivePettyCash] = useState<Array<PettyCashAllocation & { remaining: number }>>([])
  const [loadingPettyCash, setLoadingPettyCash] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadActivePettyCash() {
    setLoadingPettyCash(true)
    try {
      const timeoutMs = 12000
      const dataPromise = Promise.all([
        getPettyCashAllocations(),
        getPettyCashReceipts(),
      ])
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Petty cash load timed out")), timeoutMs)
      })
      const [allocations, receipts] = await Promise.race([dataPromise, timeoutPromise])

      const usedByAllocation = new Map<string, number>()
      for (const r of receipts) {
        if (r.status === "pending" || r.status === "approved") {
          usedByAllocation.set(
            r.allocationId,
            (usedByAllocation.get(r.allocationId) ?? 0) + r.amount,
          )
        }
      }

      const active = allocations
        .filter(a => a.status === "active")
        .map(a => ({
          ...a,
          remaining: Math.max(0, a.amount - (usedByAllocation.get(a.id) ?? 0)),
        }))
        .filter(a => a.remaining > 0)
      setActivePettyCash(active)
    } catch (error) {
      console.error("Failed to load petty cash:", error)
      setActivePettyCash([])
    } finally {
      setLoadingPettyCash(false)
    }
  }

  useEffect(() => {
    if (!showForm) return
    if (category === "Loan") {
      setPettyCashAllocationId("")
      setLoadingPettyCash(false)
      return
    }
    loadActivePettyCash()
  }, [showForm, category])

  useEffect(() => {
    if (initialCategory && FILTER_CATEGORIES.includes(initialCategory) && !openAddLoan) {
      setFilterCategory(initialCategory)
    }
  }, [initialCategory, openAddLoan])

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await fetch('/api/finance/records')
        const data = await res.json()
        setRecords(data)
      } catch (error) {
        console.error('Failed to fetch records:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchRecords()
  }, [])

  const allTags = Array.from(new Set(records.map(r => r.tag).filter(Boolean)))

  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      r.title.toLowerCase().includes(q) ||
      r.purpose.toLowerCase().includes(q) ||
      r.notes.toLowerCase().includes(q) ||
      r.tag.toLowerCase().includes(q) ||
      (r.supplier_name || "").toLowerCase().includes(q) ||
      (r.receipt_person_name || "").toLowerCase().includes(q) ||
      (r.loan_person || "").toLowerCase().includes(q) ||
      (r.petty_cash_label || "").toLowerCase().includes(q)
    const matchCat = filterCategory === "All" || r.category === filterCategory
    const matchTag = filterTag === "All" || r.tag === filterTag
    const recDate = new Date(r.createdAt)
    const matchFrom = !dateFrom || recDate >= new Date(dateFrom)
    const matchTo   = !dateTo   || recDate <= new Date(dateTo + "T23:59:59")
    return matchSearch && matchCat && matchTag && matchFrom && matchTo
  })

  const totalAll = records.reduce((s, r) => s + r.amount, 0)
  const filteredTotal = filtered.reduce((s, r) => s + r.amount, 0)
  const hasFilters = filterCategory !== "All" || filterTag !== "All"

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    if (file.type.startsWith("image/")) setProofPreview(URL.createObjectURL(file))
    else setProofPreview("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !amount) return

    const parsedAmount = parseFloat(amount)
    if (pettyCashAllocationId) {
      const linked = activePettyCash.find(a => a.id === pettyCashAllocationId)
      if (!linked) {
        setSaveError("Selected petty cash is no longer active")
        return
      }
      if (parsedAmount > linked.remaining + 0.004) {
        setSaveError(`Amount exceeds petty cash remaining (PKR ${linked.remaining.toLocaleString()})`)
        return
      }
    }

    setSaving(true); setSaveError("")
    let proof_url = "", proof_name = ""
    if (proofFile) {
      if (proofFile.size > 2 * 1024 * 1024) { setSaveError("File too large. Max 2MB."); setSaving(false); return }
      proof_name = proofFile.name
      proof_url = await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(proofFile) })
    }
    const record = {
      title, amount: parseFloat(amount), currency, purpose,
      category, tag,
      supplier_name: supplierName.trim(),
      receipt_person_name: receiptPersonName.trim(),
      petty_cash_allocation_id: pettyCashAllocationId,
      proof_url, proof_name, notes,
      created_by: user?.name ?? "Unknown",
    }
    try {
      const res = await fetch('/api/finance/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      })
      const newRecord = await res.json()
      if (!res.ok) {
        setSaveError(newRecord?.error || "Failed to save record")
        setSaving(false)
        return
      }
      setRecords([newRecord, ...records])
      resetForm(); setSaving(false)
    } catch (error) {
      console.error('Failed to save record:', error)
      setSaveError("Failed to save record")
      setSaving(false)
    }
  }

  function resetForm() {
    setTitle(""); setAmount(""); setCurrency("PKR"); setPurpose("")
    setCategory("Payment"); setTag(""); setSupplierName(""); setReceiptPersonName(""); setPettyCashAllocationId(""); setNotes("")
    setProofFile(null); setProofPreview(""); setSaveError(""); setShowForm(false)
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/finance/records?id=${id}`, { method: 'DELETE' })
      const updated = records.filter(r => r.id !== id)
      setRecords(updated)
      if (viewRecord?.id === id) setViewRecord(null)
    } catch (error) {
      console.error('Failed to delete record:', error)
    }
  }

  function clearFilters() {
    setFilterCategory("All"); setFilterTag("All")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium text-[#86868b]">{hasFilters ? "Filtered" : "Total"}</p>
          <p className="text-[28px] font-semibold tracking-[-0.03em] tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))] leading-tight">
            {(hasFilters ? filteredTotal : totalAll).toLocaleString()}
          </p>
          <p className="text-[12px] text-[#86868b] mt-0.5">
            {hasFilters ? `${filtered.length} of ${records.length}` : records.length} records
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 flex-1 sm:flex-none px-3.5 rounded-full text-[12px] font-semibold bg-black/[0.06] text-[#6e6e73] hover:bg-black/[0.1] cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="h-9 flex-1 sm:flex-none px-4 rounded-full text-[12px] font-semibold bg-[#007aff] text-white hover:bg-[#0066d6] cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add Record
          </button>
        </div>
      </div>

      <FinanceLoans
        records={records}
        userName={user?.name ?? "Unknown"}
        autoOpenReceive={!!openAddLoan}
        onCreated={(record) => setRecords(prev => [record as FinanceRecord, ...prev])}
        onDelete={handleDelete}
      />

      {hasFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-8 rounded-full border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] px-3 text-[12px] focus:outline-none"
          >
            <option value="All">All categories</option>
            {FILTER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          {allTags.length > 0 && (
            <select
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              className="h-8 rounded-full border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] px-3 text-[12px] focus:outline-none"
            >
              <option value="All">All tags</option>
              {allTags.map(t => <option key={t}>{t}</option>)}
            </select>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[13px] text-[#86868b]">Loading…</div>
      ) : records.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-black/[0.1] px-4 py-14 text-center">
          <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">No records yet</p>
          <p className="text-[12px] text-[#86868b] mt-1">Add a finance record to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-black/[0.1] px-4 py-10 text-center text-[13px] text-[#86868b]">
          No records match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-black/[0.04] bg-white dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--card))]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem]">
              <thead>
                <tr className="border-b border-black/[0.05] dark:border-[hsl(var(--border))]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#86868b]">Title</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#86868b]">Category</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#86868b]">Tag</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-[#86868b]">Amount</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#86868b]">Date</th>
                  <th className="w-14" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-[hsl(var(--border))]">
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => setViewRecord(r)}
                    className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{r.title}</p>
                      {(r.purpose || r.notes || r.petty_cash_label) && (
                        <p className="text-[11px] text-[#86868b] mt-0.5 truncate max-w-[220px]">
                          {r.petty_cash_label ? `Petty cash: ${r.petty_cash_label}` : (r.purpose || r.notes)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", CATEGORY_STYLES[r.category] ?? CATEGORY_STYLES.Other)}>
                        {r.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.tag ? (
                        <span className="text-[12px] text-[#6e6e73]">{r.tag}</span>
                      ) : (
                        <span className="text-[11px] text-[#aeaeb2]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-[13px] font-semibold tabular-nums">{r.currency} {r.amount.toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12px] text-[#86868b] tabular-nums">
                        {new Date(r.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button
                          type="button"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.06] cursor-pointer"
                          onClick={e => { e.stopPropagation(); setViewRecord(r) }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 cursor-pointer"
                          onClick={e => { e.stopPropagation(); handleDelete(r.id) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[10px] p-0 sm:p-4"
            onClick={resetForm}
          >
            <div
              className="w-full sm:w-[min(520px,calc(100vw-2rem))] rounded-t-[22px] sm:rounded-[22px] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col max-h-[92vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3 sm:px-6 shrink-0">
                <p className="text-[20px] font-semibold tracking-[-0.03em]">
                  {category === "Loan" ? "Add loan" : "Add record"}
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto px-5 sm:px-6 pb-4 space-y-3.5 flex-1 min-h-0">
                  {category === "Loan" && (
                    <p className="text-[12px] text-[#9a6700] bg-[#ff9f0a]/12 rounded-[10px] px-3 py-2 leading-relaxed">
                      Loans also appear in the Loans section below. Use Overview toggles to include or exclude them from cash.
                    </p>
                  )}
                  <Field label="Title">
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      required
                      placeholder={category === "Loan" ? "e.g. Bank loan" : "e.g. Office rent"}
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Amount">
                      <input value={amount} onChange={e => setAmount(e.target.value)} required type="number" min="0" step="0.01" placeholder="0" className={inputCls} />
                    </Field>
                    <Field label="Currency">
                      <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Category">
                      <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Tag">
                      <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Optional" className={inputCls} />
                    </Field>
                  </div>
                  {category !== "Loan" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Supplier">
                        <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Optional" className={inputCls} />
                      </Field>
                      <Field label="Receipt by">
                        <input value={receiptPersonName} onChange={e => setReceiptPersonName(e.target.value)} placeholder="Optional" className={inputCls} />
                      </Field>
                    </div>
                  )}
                  {category !== "Loan" && (
                    <Field label="Petty cash">
                      <select
                        value={pettyCashAllocationId}
                        onChange={e => setPettyCashAllocationId(e.target.value)}
                        className={inputCls}
                        disabled={loadingPettyCash}
                      >
                        <option value="">None</option>
                        {activePettyCash.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.employeeName} — PKR {a.remaining.toLocaleString()} left
                          </option>
                        ))}
                      </select>
                      {pettyCashAllocationId && (() => {
                        const linked = activePettyCash.find(a => a.id === pettyCashAllocationId)
                        if (!linked) return null
                        return (
                          <p className="text-[11px] text-[#007aff] mt-1 flex items-center gap-1">
                            <Wallet className="h-3 w-3" />
                            Posts PKR {amount || "0"} to this petty cash
                            {parseFloat(amount || "0") > linked.remaining && (
                              <span className="text-[#ff3b30]"> · exceeds remaining</span>
                            )}
                          </p>
                        )
                      })()}
                    </Field>
                  )}
                  <Field label="Purpose">
                    <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Optional" className={inputCls} />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional"
                      className="w-full rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35 resize-none"
                    />
                  </Field>
                  <Field label="Proof">
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="rounded-[12px] border border-dashed border-black/[0.12] bg-white dark:bg-[hsl(var(--card))] p-4 text-center cursor-pointer hover:border-[#007aff]/40"
                    >
                      {proofPreview ? (
                        <img src={proofPreview} alt="proof" className="max-h-28 mx-auto rounded-lg object-contain" />
                      ) : proofFile ? (
                        <div className="flex items-center justify-center gap-2 text-[12px] text-[#86868b]">
                          <FileText className="h-4 w-4" />{proofFile.name}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-[#86868b]">
                          <Upload className="h-5 w-5" />
                          <p className="text-[12px]">Image or PDF · max 2MB</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                    {proofFile && (
                      <button type="button" onClick={() => { setProofFile(null); setProofPreview("") }}
                        className="text-[11px] text-[#ff3b30] hover:underline mt-1.5 cursor-pointer">Remove</button>
                    )}
                  </Field>
                </div>
                <div className="shrink-0 px-5 sm:px-6 py-3.5 border-t border-black/[0.06] space-y-2">
                  {saveError && <p className="text-[12px] text-[#ff3b30]">{saveError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={resetForm} className="flex-1 h-10 rounded-full bg-black/[0.06] text-[13px] font-semibold cursor-pointer">Cancel</button>
                    <button type="submit" disabled={saving} className="flex-1 h-10 rounded-full bg-[#007aff] text-white text-[13px] font-semibold disabled:opacity-60 cursor-pointer">
                      {saving ? "Saving…" : category === "Loan" ? "Save loan" : "Save"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {viewRecord &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[10px] p-0 sm:p-4"
            onClick={() => setViewRecord(null)}
          >
            <div
              className="w-full sm:w-[min(440px,calc(100vw-2rem))] rounded-t-[22px] sm:rounded-[22px] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between px-5 pt-4 pb-3 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[20px] font-semibold tracking-[-0.03em] truncate">{viewRecord.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", CATEGORY_STYLES[viewRecord.category] ?? CATEGORY_STYLES.Other)}>
                      {viewRecord.category}
                    </span>
                    {viewRecord.tag && <span className="text-[12px] text-[#86868b]">{viewRecord.tag}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewRecord(null)}
                  className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>

              <div className="px-5 sm:px-6 pb-5 space-y-3">
                <div className="rounded-[14px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.04] px-4 py-3.5">
                  <p className="text-[11px] text-[#86868b]">Amount</p>
                  <p className="text-[24px] font-semibold tabular-nums mt-0.5">
                    {viewRecord.currency} {viewRecord.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="overflow-hidden rounded-[14px] border border-black/[0.04] bg-white dark:bg-[hsl(var(--card))] divide-y divide-black/[0.05]">
                  {viewRecord.loan_person && (
                    <div className="px-4 py-3">
                      <p className="text-[11px] text-[#86868b]">Person</p>
                      <p className="text-[13px] font-medium mt-0.5">{viewRecord.loan_person}</p>
                    </div>
                  )}
                  {viewRecord.supplier_name && (
                    <div className="px-4 py-3">
                      <p className="text-[11px] text-[#86868b]">Supplier</p>
                      <p className="text-[13px] font-medium mt-0.5">{viewRecord.supplier_name}</p>
                    </div>
                  )}
                  {viewRecord.receipt_person_name && (
                    <div className="px-4 py-3">
                      <p className="text-[11px] text-[#86868b]">Receipt by</p>
                      <p className="text-[13px] font-medium mt-0.5">{viewRecord.receipt_person_name}</p>
                    </div>
                  )}
                  {viewRecord.petty_cash_label && (
                    <div className="px-4 py-3">
                      <p className="text-[11px] text-[#86868b]">Petty cash</p>
                      <p className="text-[13px] font-medium mt-0.5">{viewRecord.petty_cash_label}</p>
                    </div>
                  )}
                  {viewRecord.purpose && (
                    <div className="px-4 py-3">
                      <p className="text-[11px] text-[#86868b]">Purpose</p>
                      <p className="text-[13px] mt-0.5 whitespace-pre-wrap break-words">{viewRecord.purpose}</p>
                    </div>
                  )}
                  {viewRecord.notes && (
                    <div className="px-4 py-3">
                      <p className="text-[11px] text-[#86868b]">Notes</p>
                      <p className="text-[13px] mt-0.5 whitespace-pre-wrap break-words">{viewRecord.notes}</p>
                    </div>
                  )}
                  <div className="px-4 py-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-[#86868b]">Added by</p>
                      <p className="text-[13px] font-medium mt-0.5">{viewRecord.created_by}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#86868b]">Date</p>
                      <p className="text-[13px] font-medium mt-0.5 tabular-nums">
                        {new Date(viewRecord.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                </div>

                {viewRecord.proof_url && (
                  <div>
                    {viewRecord.proof_url.startsWith("data:image/") || viewRecord.proof_url.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                      <img src={viewRecord.proof_url} alt="proof" className="w-full rounded-[14px] object-contain max-h-48" />
                    ) : viewRecord.proof_url.startsWith("data:application/pdf") ? (
                      <iframe src={viewRecord.proof_url} className="w-full h-48 rounded-[14px]" title="proof" />
                    ) : (
                      <a href={viewRecord.proof_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[13px] text-[#007aff] hover:underline">
                        <FileText className="h-4 w-4" /> View {viewRecord.proof_name || "document"}
                      </a>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setViewRecord(null)} className="flex-1 h-10 rounded-full bg-black/[0.06] text-[13px] font-semibold cursor-pointer">Close</button>
                  <button
                    type="button"
                    onClick={() => handleDelete(viewRecord.id)}
                    className="h-10 px-4 rounded-full bg-[#ff3b30]/12 text-[#ff3b30] text-[13px] font-semibold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
