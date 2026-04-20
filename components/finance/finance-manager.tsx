"use client"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Plus, Upload, X, FileText, Trash2, Search, Calendar, TrendingUp, DollarSign, Eye, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react"

interface FinanceRecord {
  id: string
  title: string
  amount: number
  currency: string
  purpose: string
  category: string
  tag: string
  proof_url: string
  proof_name: string
  notes: string
  created_by: string
  createdAt: string
}

const CATEGORIES = ["Payment", "Expense", "Invoice", "Salary", "Tax", "Refund", "Other"]
const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED"]

const CATEGORY_STYLES: Record<string, string> = {
  Payment:  "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400",
  Expense:  "bg-red-500/10 text-red-700 border-red-200 dark:text-red-400",
  Invoice:  "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400",
  Salary:   "bg-green-500/10 text-green-700 border-green-200 dark:text-green-400",
  Tax:      "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-400",
  Refund:   "bg-teal-500/10 text-teal-700 border-teal-200 dark:text-teal-400",
  Other:    "bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-400",
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-[hsl(var(--foreground))]">{label}</label>
    {children}
  </div>
)

const inputCls = "w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6] transition-colors"

export function FinanceManager() {
  const { user } = useAuth()
  const [records, setRecords] = useState<FinanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [viewRecord, setViewRecord] = useState<FinanceRecord | null>(null)

  // filters
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("All")
  const [filterTag, setFilterTag] = useState("All")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // form
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("PKR")
  const [purpose, setPurpose] = useState("")
  const [category, setCategory] = useState("Payment")
  const [tag, setTag] = useState("")
  const [notes, setNotes] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const [showFilters, setShowFilters] = useState(false)

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
      r.tag.toLowerCase().includes(q)
    const matchCat = filterCategory === "All" || r.category === filterCategory
    const matchTag = filterTag === "All" || r.tag === filterTag
    const recDate = new Date(r.createdAt)
    const matchFrom = !dateFrom || recDate >= new Date(dateFrom)
    const matchTo   = !dateTo   || recDate <= new Date(dateTo + "T23:59:59")
    return matchSearch && matchCat && matchTag && matchFrom && matchTo
  })

  const totalAll = records.reduce((s, r) => s + r.amount, 0)
  const filteredTotal = filtered.reduce((s, r) => s + r.amount, 0)
  const hasFilters = search || filterCategory !== "All" || filterTag !== "All" || dateFrom || dateTo

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
    setSaving(true); setSaveError("")
    let proof_url = "", proof_name = ""
    if (proofFile) {
      if (proofFile.size > 2 * 1024 * 1024) { setSaveError("File too large. Max 2MB."); setSaving(false); return }
      proof_name = proofFile.name
      proof_url = await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(proofFile) })
    }
    const record = {
      title, amount: parseFloat(amount), currency, purpose,
      category, tag, proof_url, proof_name, notes,
      created_by: user?.name ?? "Unknown",
    }
    try {
      const res = await fetch('/api/finance/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      })
      const newRecord = await res.json()
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
    setCategory("Payment"); setTag(""); setNotes("")
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
    setSearch(""); setFilterCategory("All"); setFilterTag("All"); setDateFrom(""); setDateTo("")
  }

  return (
    <div className="space-y-4">

      {/* Top row: stats + actions */}
      <div className="flex items-center justify-between gap-4">
        {/* Stats — plain, no color */}
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              {hasFilters ? "Filtered" : "Total"}
            </p>
            <p className="text-2xl font-bold tabular-nums leading-tight">
              {hasFilters ? filteredTotal.toLocaleString() : totalAll.toLocaleString()}
            </p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {hasFilters ? `${filtered.length} of ${records.length}` : `${records.length}`} records
            </p>
          </div>
          {hasFilters && (
            <div className="border-l pl-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">All time</p>
              <p className="text-lg font-semibold tabular-nums text-[hsl(var(--muted-foreground))] leading-tight">{totalAll.toLocaleString()}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{records.length} records</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <Button
              size="sm" variant="outline"
              className="h-8 text-xs gap-1.5 cursor-pointer"
              onClick={() => setShowFilters(v => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-[#1faca6]" />}
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-[#1faca6] hover:bg-[#17857f] text-white cursor-pointer" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Record
          </Button>
        </div>
      </div>

      {/* Filters — collapsible, no shadow */}
      {showFilters && records.length > 0 && (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-3 flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search records..."
              className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]" />
          </div>

          {/* Category */}
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]">
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>

          {/* Tags */}
          {allTags.length > 0 && (
            <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
              className="h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]">
              <option value="All">All Tags</option>
              {allTags.map(t => <option key={t}>{t}</option>)}
            </select>
          )}

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6] w-32" />
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6] w-32" />
          </div>

          {hasFilters && (
            <button onClick={clearFilters}
              className="h-8 px-3 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border rounded-md transition-colors cursor-pointer">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Records list */}
      {loading ? (
        <div className="text-center py-12 text-xs text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <div className="h-12 w-12 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-3">
            <DollarSign className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm font-semibold">No records yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Add your first finance record to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-xs text-[hsl(var(--muted-foreground))] border rounded-xl border-dashed">
          No records match your filters.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Title</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Category</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Tag</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Amount</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(r => (
                <tr key={r.id} onClick={() => setViewRecord(r)}
                  className="group hover:bg-[hsl(var(--muted))]/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium">{r.title}</p>
                    {(r.purpose || r.notes) && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate max-w-[200px]">
                        {r.purpose || r.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${CATEGORY_STYLES[r.category] ?? CATEGORY_STYLES.Other}`}>
                      {r.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.tag ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#1faca6]/10 text-[#1faca6] border border-[#1faca6]/20">
                        {r.tag}
                      </span>
                    ) : <span className="text-[10px] text-[hsl(var(--muted-foreground))]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs font-bold tabular-nums">{r.currency} {r.amount.toLocaleString()}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {new Date(r.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                        onClick={e => { e.stopPropagation(); setViewRecord(r) }}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600 cursor-pointer"
                        onClick={e => { e.stopPropagation(); handleDelete(r.id) }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Record Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
              <p className="text-sm font-semibold">Add Finance Record</p>
              <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={resetForm}><X className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-3.5">
              <Field label="Title *">
                <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Office rent payment" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount *">
                  <input value={amount} onChange={e => setAmount(e.target.value)} required type="number" min="0" step="0.01" placeholder="0.00" className={inputCls} />
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
                <Field label="Tag / Label">
                  <input value={tag} onChange={e => setTag(e.target.value)} placeholder="e.g. Q1, Ahmed" className={inputCls} />
                </Field>
              </div>
              <Field label="Purpose">
                <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="What was this for?" className={inputCls} />
              </Field>
              <Field label="Notes">
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional notes..."
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6] resize-none transition-colors" />
              </Field>
              <Field label="Proof (image or PDF, max 2MB)">
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-[#1faca6] hover:bg-[#1faca6]/5 transition-colors">
                  {proofPreview ? (
                    <img src={proofPreview} alt="proof" className="max-h-28 mx-auto rounded object-contain" />
                  ) : proofFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <FileText className="h-4 w-4" />{proofFile.name}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-[hsl(var(--muted-foreground))]">
                      <Upload className="h-5 w-5" />
                      <p className="text-xs">Click to upload</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                {proofFile && (
                  <button type="button" onClick={() => { setProofFile(null); setProofPreview("") }}
                    className="text-[10px] text-red-500 hover:underline mt-1">Remove file</button>
                )}
              </Field>
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-9 cursor-pointer" onClick={resetForm}>Cancel</Button>
                <Button type="submit" size="sm" className="flex-1 h-9 bg-[#1faca6] hover:bg-[#17857f] text-white cursor-pointer" disabled={saving}>
                  {saving ? "Saving..." : "Save Record"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Record Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setViewRecord(null)}>
          <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* teal top bar */}
            <div className="h-1 w-full bg-[#1faca6]" />

            <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b">
              <div>
                <p className="text-sm font-bold">{viewRecord.title}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${CATEGORY_STYLES[viewRecord.category] ?? CATEGORY_STYLES.Other}`}>
                    {viewRecord.category}
                  </span>
                  {viewRecord.tag && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#1faca6]/10 text-[#1faca6] border border-[#1faca6]/20">
                      {viewRecord.tag}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 cursor-pointer" onClick={() => setViewRecord(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              {/* Amount */}
              <div className="rounded-lg bg-[hsl(var(--muted))]/40 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest font-medium">Amount</p>
                  <p className="text-2xl font-bold mt-0.5 tabular-nums text-[#1faca6]">
                    {viewRecord.currency} {viewRecord.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-[#1faca6]/30" />
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {viewRecord.purpose && (
                  <div className="col-span-2 rounded-md border bg-[hsl(var(--background))] px-3 py-2.5">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium mb-0.5">Purpose</p>
                    <p>{viewRecord.purpose}</p>
                  </div>
                )}
                {viewRecord.notes && (
                  <div className="col-span-2 rounded-md border bg-[hsl(var(--background))] px-3 py-2.5">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium mb-0.5">Notes</p>
                    <p>{viewRecord.notes}</p>
                  </div>
                )}
                <div className="rounded-md border bg-[hsl(var(--background))] px-3 py-2.5">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium mb-0.5">Added by</p>
                  <p className="font-medium">{viewRecord.created_by}</p>
                </div>
                <div className="rounded-md border bg-[hsl(var(--background))] px-3 py-2.5">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium mb-0.5">Date</p>
                  <p className="font-medium">{new Date(viewRecord.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              </div>

              {/* Proof */}
              {viewRecord.proof_url && (
                <div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium mb-2 uppercase tracking-widest">Proof</p>
                  {viewRecord.proof_url.startsWith("data:image/") || viewRecord.proof_url.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                    <img src={viewRecord.proof_url} alt="proof" className="w-full rounded-lg object-contain max-h-48 border" />
                  ) : viewRecord.proof_url.startsWith("data:application/pdf") ? (
                    <iframe src={viewRecord.proof_url} className="w-full h-48 rounded-lg border" title="proof" />
                  ) : (
                    <a href={viewRecord.proof_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[#1faca6] hover:underline">
                      <FileText className="h-4 w-4" /> View {viewRecord.proof_name || "document"}
                    </a>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs cursor-pointer" onClick={() => setViewRecord(null)}>Close</Button>
                <Button size="sm" className="h-8 text-xs bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-200 cursor-pointer"
                  onClick={() => handleDelete(viewRecord.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


