"use client"
import { useState, useEffect, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/components/auth-provider"
import { Upload, X, FileText, Trash2, Wallet, SlidersHorizontal, Search } from "lucide-react"
import { getPettyCashAllocations, getPettyCashReceipts, type PettyCashAllocation } from "@/lib/petty-cash"
import { FinanceLoans, buildLoanProfiles, isLoanCategory } from "@/components/finance/finance-loans"
import { ChinaMoneyDashboard } from "@/components/china-money/china-money-dashboard"
import { cn } from "@/lib/utils"

type RecordsSubTab = "records" | "china"

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
  has_proof?: boolean
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
  initialCategory?: string
  openAddLoan?: boolean
}

export function FinanceManager({
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
  const [viewLoading, setViewLoading] = useState(false)

  async function openRecord(r: FinanceRecord) {
    setViewRecord(r)
    if (r.proof_url || !r.has_proof) return
    setViewLoading(true)
    try {
      const res = await fetch(`/api/finance/records?id=${encodeURIComponent(r.id)}`)
      if (res.ok) {
        const full = (await res.json()) as FinanceRecord
        setViewRecord((prev) => (prev?.id === r.id ? { ...prev, ...full } : prev))
      }
    } catch (error) {
      console.error("Failed to load record proof:", error)
    } finally {
      setViewLoading(false)
    }
  }

  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [filterCategory, setFilterCategory] = useState("All")
  const [filterTag, setFilterTag] = useState("All")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)
  const [recordsTab, setRecordsTab] = useState<RecordsSubTab>("records")

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
  const hasFilters = !!(search || dateFrom || dateTo || filterCategory !== "All" || filterTag !== "All")

  const loanSource = useMemo(
    () =>
      records.filter((r) => {
        const q = search.toLowerCase()
        const matchSearch =
          !search ||
          r.title.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q) ||
          r.tag.toLowerCase().includes(q) ||
          (r.loan_person || "").toLowerCase().includes(q)
        const recDate = new Date(r.createdAt)
        const matchFrom = !dateFrom || recDate >= new Date(dateFrom)
        const matchTo = !dateTo || recDate <= new Date(dateTo + "T23:59:59")
        return matchSearch && matchFrom && matchTo
      }),
    [records, search, dateFrom, dateTo],
  )
  const loanProfiles = useMemo(() => buildLoanProfiles(loanSource), [loanSource])
  const totalWeOwe = loanProfiles.reduce((s, p) => s + Math.max(0, p.received - p.repaid), 0)
  const totalOwedToUs = loanProfiles.reduce((s, p) => s + Math.max(0, p.given - p.recovered), 0)
  const takeCount = loanProfiles.filter((p) => p.received > 0.004).length
  const giveCount = loanProfiles.filter((p) => p.given > 0.004).length

  const nonLoanFiltered = filtered.filter((r) => !isLoanCategory(r.category))

  function placeFilterPanel() {
    const btn = filterBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const panelW = Math.min(328, window.innerWidth - 24)
    const panelH = 300
    const pad = 16
    setFilterPos({
      top: Math.max(pad, Math.min(rect.top, window.innerHeight - panelH - pad)),
      left: Math.max(pad, window.innerWidth - panelW - pad),
    })
  }

  useEffect(() => {
    if (!filtersOpen) {
      setFilterPos(null)
      return
    }
    placeFilterPanel()
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (filtersRef.current?.contains(t) || filterBtnRef.current?.contains(t)) return
      setFiltersOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false)
    }
    function onReposition() {
      placeFilterPanel()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("resize", onReposition)
    window.addEventListener("scroll", onReposition, true)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", onReposition)
      window.removeEventListener("scroll", onReposition, true)
    }
  }, [filtersOpen])

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
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setFilterCategory("All")
    setFilterTag("All")
  }

  const fmtPkr = (n: number) => `PKR ${Math.round(n).toLocaleString()}`

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px]">
        {(
          [
            { id: "records" as const, label: "Records" },
            { id: "china" as const, label: "Money to China" },
          ] as const
        ).map((tab) => {
          const selected = recordsTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRecordsTab(tab.id)}
              className={cn(
                "px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-all duration-200 cursor-pointer",
                selected
                  ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] hover:text-[#1d1d1f] dark:hover:text-[hsl(var(--foreground))]",
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {recordsTab === "china" ? (
        <div className="rounded-[18px] border border-black/[0.04] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] p-3 sm:p-4">
          <ChinaMoneyDashboard embedded />
        </div>
      ) : null}

      {recordsTab === "records" ? (
      <>
      <section className="rounded-[18px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.04] dark:border-[hsl(var(--border))] overflow-visible relative z-20">
        <div className="flex items-center justify-end px-3 pt-2.5">
          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer",
              filtersOpen
                ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                : "text-[#86868b] hover:bg-black/[0.05] dark:hover:bg-white/10 hover:text-[#1d1d1f]",
            )}
            aria-label="Filters"
            aria-expanded={filtersOpen}
            title="Filters"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.06] dark:divide-[hsl(var(--border))]">
          <div className="min-w-0">
            <div className="px-2.5 sm:px-3 pb-3.5 pt-0.5 min-h-[72px] flex flex-col justify-end gap-1">
              <p className="text-[11px] font-medium text-[#86868b] dark:text-[hsl(var(--muted-foreground))] truncate">
                {hasFilters ? "Filtered" : "Total"}
              </p>
              <p className="text-[17px] sm:text-[18px] font-bold tracking-tight leading-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums">
                {(hasFilters ? filteredTotal : totalAll).toLocaleString()}
              </p>
              <p className="text-[10px] text-[#aeaeb2] truncate">
                {hasFilters ? `${filtered.length} of ${records.length}` : records.length} records
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <div className="px-2.5 sm:px-3 pb-3.5 pt-0.5 min-h-[72px] flex flex-col justify-end gap-1">
              <p className="text-[11px] font-medium text-[#86868b] dark:text-[hsl(var(--muted-foreground))] truncate">
                We owe
              </p>
              <p className="text-[17px] sm:text-[18px] font-bold tracking-tight leading-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums break-words">
                {fmtPkr(totalWeOwe)}
              </p>
              <p className="text-[10px] text-[#aeaeb2] truncate">
                {takeCount} loan{takeCount === 1 ? "" : "s"} taken
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <div className="px-2.5 sm:px-3 pb-3.5 pt-0.5 min-h-[72px] flex flex-col justify-end gap-1">
              <p className="text-[11px] font-medium text-[#86868b] dark:text-[hsl(var(--muted-foreground))] truncate">
                Owed to us
              </p>
              <p className="text-[17px] sm:text-[18px] font-bold tracking-tight leading-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums break-words">
                {fmtPkr(totalOwedToUs)}
              </p>
              <p className="text-[10px] text-[#aeaeb2] truncate">
                {giveCount} loan{giveCount === 1 ? "" : "s"} given
              </p>
            </div>
          </div>
        </div>

        {filtersOpen &&
          filterPos &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={filtersRef}
              className="fixed z-[95] w-[min(20.5rem,calc(100vw-1.5rem))] rounded-[16px] border border-black/[0.08] bg-white/95 dark:bg-[hsl(var(--card))]/95 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] p-3 space-y-2.5"
              style={{ top: filterPos.top, left: filterPos.left }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute top-4 -left-1.5 h-3 w-3 rotate-45 rounded-[2px] border-b border-l border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
              />
              <div className="flex items-center justify-between gap-2 px-0.5">
                <p className="text-[11px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                  Filters
                </p>
                {hasFilters && (
                  <button type="button" onClick={clearFilters} className="text-[10px] font-medium text-[#0071e3] cursor-pointer">
                    Clear
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search records..."
                  className="w-full h-8 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] pl-8 pr-3 text-[11px] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 rounded-xl border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2 text-[11px] flex-1 min-w-0 cursor-pointer"
                />
                <span className="text-[9px] text-[#86868b] shrink-0">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 rounded-xl border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2 text-[11px] flex-1 min-w-0 cursor-pointer"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full h-8 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2.5 text-[11px] focus:outline-none"
              >
                <option value="All">All categories</option>
                {FILTER_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {allTags.length > 0 && (
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="w-full h-8 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2.5 text-[11px] focus:outline-none"
                >
                  <option value="All">All tags</option>
                  {allTags.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>,
            document.body,
          )}
      </section>

      <FinanceLoans
        records={loanSource}
        userName={user?.name ?? "Unknown"}
        autoOpenReceive={!!openAddLoan}
        onCreated={(record) => setRecords((prev) => [record as FinanceRecord, ...prev])}
        onDelete={handleDelete}
      />

      {loading ? (
        <div className="text-center py-10 text-[13px] text-[#86868b]">Loading…</div>
      ) : nonLoanFiltered.length > 0 ? (
        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">Other records</p>
          <div className="overflow-hidden rounded-[14px] border border-black/[0.04] bg-white dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--card))]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem]">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-[hsl(var(--border))]">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#86868b]">Title</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#86868b]">Category</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-[#86868b]">Amount</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#86868b]">Date</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] dark:divide-[hsl(var(--border))]">
                  {nonLoanFiltered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => void openRecord(r)}
                      className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{r.title}</p>
                        {(r.purpose || r.notes || r.petty_cash_label) && (
                          <p className="text-[11px] text-[#86868b] mt-0.5 truncate max-w-[220px]">
                            {r.petty_cash_label ? `Petty cash: ${r.petty_cash_label}` : r.purpose || r.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#6e6e73]">{r.category}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-[13px] font-semibold tabular-nums">
                          {r.currency} {r.amount.toLocaleString()}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] text-[#86868b] tabular-nums">
                          {new Date(r.createdAt).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#ff3b30] opacity-0 group-hover:opacity-100 hover:bg-[#ff3b30]/10 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(r.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

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

                {(viewLoading || viewRecord.has_proof || viewRecord.proof_url) && (
                  <div>
                    {viewLoading && !viewRecord.proof_url ? (
                      <p className="text-[13px] text-[#86868b] py-6 text-center">Loading proof…</p>
                    ) : viewRecord.proof_url.startsWith("data:image/") || viewRecord.proof_url.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                      <img src={viewRecord.proof_url} alt="proof" className="w-full rounded-[14px] object-contain max-h-48" />
                    ) : viewRecord.proof_url.startsWith("data:application/pdf") ? (
                      <iframe src={viewRecord.proof_url} className="w-full h-48 rounded-[14px]" title="proof" />
                    ) : viewRecord.proof_url ? (
                      <a href={viewRecord.proof_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[13px] text-[#007aff] hover:underline">
                        <FileText className="h-4 w-4" /> View {viewRecord.proof_name || "document"}
                      </a>
                    ) : null}
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
      </>
      ) : null}
    </div>
  )
}
