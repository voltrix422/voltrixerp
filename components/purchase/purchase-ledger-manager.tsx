"use client"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Upload, X, FileText, Wallet, Pencil, Search, Download, RotateCcw, FileSpreadsheet, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react"
import { getSuppliers, type Supplier } from "@/lib/purchase"
import {
  addPurchaseLedgerPayment,
  calcLineTotal,
  calcUnitPrice,
  deletePurchaseLedgerEntry,
  formatLedgerItemsSummary,
  formatLedgerProject,
  formatLedgerSuppliers,
  formatLinkModeLabel,
  getNextLedgerNumber,
  getPurchaseLedgerEntries,
  newLedgerItem,
  newSupplierGroup,
  normalizeLinkMode,
  PURCHASE_LINK_MODES,
  PURCHASE_TRANSACTION_TYPES,
  savePurchaseLedgerEntry,
  sumItemTotals,
  sumPayments,
  sumSupplierGroups,
  type PurchaseLedgerEntry,
  type PurchaseLedgerItem,
  type PurchaseLedgerPayment,
  type PurchaseLedgerSupplierGroup,
  type PurchaseLinkMode,
  type PurchaseTransactionType,
} from "@/lib/purchase-ledger"
import { uploadFile } from "@/lib/upload"
import { SupplierPicker } from "@/components/purchase/supplier-picker"
import { LedgerEntryDetailModal } from "@/components/purchase/ledger-entry-detail-modal"
import {
  downloadPurchaseLedgerEntryExcel,
  downloadPurchaseLedgerEntryPDF,
  downloadPurchaseLedgerExcel,
  downloadPurchaseLedgerReportPDF,
} from "@/lib/purchase-ledger-export"

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

function LineItemsEditor({
  items,
  onChange,
}: {
  items: PurchaseLedgerItem[]
  onChange: (items: PurchaseLedgerItem[]) => void
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-[hsl(var(--muted))]/25">
        <p className="text-xs font-semibold">Items</p>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => onChange([...items, newLedgerItem()])}>
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
        {items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-12 sm:grid-cols-[minmax(0,1fr)_88px_120px_128px_36px] gap-3 px-3 py-2 items-center">
            <div className="col-span-12 sm:col-span-1">
              <input required value={item.productName} onChange={e => onChange(items.map(row => row.id === item.id ? { ...row, productName: e.target.value } : row))} placeholder={`Item ${index + 1}`} className={inputCls} />
            </div>
            <div className="col-span-4 sm:col-span-1">
              <input type="number" min="0" step="any" value={item.quantity || ""} onChange={e => onChange(updateItemField(items, item.id, "quantity", e.target.value))} className={inputCls} />
            </div>
            <div className="col-span-4 sm:col-span-1">
              <input type="number" min="0" step="any" value={item.unitPrice || ""} onChange={e => onChange(updateItemField(items, item.id, "unitPrice", e.target.value))} className={inputCls} />
            </div>
            <div className="col-span-4 sm:col-span-1">
              <input type="number" min="0" step="any" value={item.lineTotal || ""} onChange={e => onChange(updateItemField(items, item.id, "lineTotal", e.target.value))} className={inputCls} />
            </div>
            <div className="col-span-12 sm:col-span-1 flex sm:justify-center">
              {items.length > 1 ? (
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-500 shrink-0" onClick={() => onChange(items.filter(row => row.id !== item.id))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : <span className="hidden sm:block w-8" />}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 px-3 py-2 border-t bg-[hsl(var(--muted))]/10">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Subtotal</span>
        <span className="text-sm font-semibold text-[#1faca6]">{fmtMoney(sumItemTotals(items))}</span>
      </div>
    </div>
  )
}

const filterSelectCls = "h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs min-w-0"

export function PurchaseLedgerManager({ purchaseScopeId }: { purchaseScopeId: string }) {
  const { user } = useAuth()
  const [entries, setEntries] = useState<PurchaseLedgerEntry[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterLinkMode, setFilterLinkMode] = useState<string>("all")
  const [filterTransactionType, setFilterTransactionType] = useState<string>("all")
  const [filterSupplierId, setFilterSupplierId] = useState<string>("all")
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("all")
  const [filterSearch, setFilterSearch] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [filterDueFrom, setFilterDueFrom] = useState("")
  const [filterDueTo, setFilterDueTo] = useState("")
  const [exporting, setExporting] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

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

  const [ledgerNumber, setLedgerNumber] = useState("PL-0001")
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [linkMode, setLinkMode] = useState<PurchaseLinkMode>("general")
  const [projectName, setProjectName] = useState("")
  const [supplierGroups, setSupplierGroups] = useState<PurchaseLedgerSupplierGroup[]>([newSupplierGroup()])
  const [transactionType, setTransactionType] = useState<PurchaseTransactionType>("purchase")
  const [amountPayingNow, setAmountPayingNow] = useState("")
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState("")

  const grandTotal = useMemo(() => sumSupplierGroups(supplierGroups), [supplierGroups])
  const payingNow = parseFloat(amountPayingNow) || 0
  const existingPaid = useMemo(() => sumPayments(existingPayments), [existingPayments])
  const amountDueNow = editingEntryId
    ? Math.max(0, grandTotal - existingPaid)
    : Math.max(0, grandTotal - payingNow)
  const isEditing = Boolean(editingEntryId)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [ledgerRows, supplierRows] = await Promise.all([
        getPurchaseLedgerEntries(purchaseScopeId),
        getSuppliers(purchaseScopeId),
      ])
      setEntries(ledgerRows)
      setSuppliers(supplierRows)
      setLoading(false)
    }
    void load()
  }, [purchaseScopeId])

  function updateSupplierGroup(groupId: string, patch: Partial<PurchaseLedgerSupplierGroup>) {
    setSupplierGroups(prev => prev.map(group => group.id === groupId ? { ...group, ...patch } : group))
  }

  function onLinkModeChange(mode: PurchaseLinkMode) {
    setLinkMode(mode)
    setSupplierGroups(prev => {
      if (mode === "project") return prev.length > 0 ? prev : [newSupplierGroup()]
      const first = prev[0] ?? newSupplierGroup()
      return [first]
    })
  }

  function normalizeGroups(groups: PurchaseLedgerSupplierGroup[]) {
    return groups.map(group => ({
      ...group,
      items: group.items
        .filter(item => item.productName.trim())
        .map(item => ({
          ...item,
          lineTotal: item.lineTotal || calcLineTotal(item),
          unitPrice: item.unitPrice || calcUnitPrice(item),
        })),
    })).filter(group => group.items.length > 0 || group.supplierId || group.supplierName)
  }

  function resetForm() {
    setEditingEntryId(null)
    setExistingPayments([])
    setOriginalCreatedBy("")
    setProjectName("")
    setSupplierGroups([newSupplierGroup()])
    setTransactionType("purchase")
    setAmountPayingNow("")
    setNotes("")
    setDueDate("")
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
    const next = await getNextLedgerNumber(purchaseScopeId)
    setLedgerNumber(next)
    setShowForm(true)
  }

  function openEditForm(entry: PurchaseLedgerEntry) {
    setEditingEntryId(entry.id)
    setExistingPayments(entry.payments)
    setOriginalCreatedBy(entry.createdBy)
    setLedgerNumber(entry.ledgerNumber)
    setTransactionDate(entry.transactionDate)
    setLinkMode(entry.linkMode)
    setProjectName(entry.projectName || "")
    setSupplierGroups(
      entry.supplierGroups.length > 0
        ? entry.supplierGroups.map(group => newSupplierGroup(group))
        : [newSupplierGroup({
          supplierId: entry.supplierId ?? null,
          supplierName: entry.supplierName,
          accountDetails: entry.accountDetails,
          items: entry.items.length > 0 ? entry.items : [newLedgerItem({ productName: entry.productName, quantity: entry.quantity, unitPrice: entry.unitPrice, lineTotal: entry.totalAmount })],
        })],
    )
    setTransactionType(entry.transactionType)
    setNotes(entry.notes || "")
    setDueDate(entry.dueDate || "")
    setAmountPayingNow("")
    setProofFile(null)
    setProofPreview("")
    setDetailEntryId(null)
    setShowForm(true)
  }

  function resolveGroupSupplier(group: PurchaseLedgerSupplierGroup) {
    const supplier = suppliers.find(s => s.id === group.supplierId)
    return {
      supplierId: group.supplierId,
      supplierName: supplier?.name ?? group.supplierName,
      accountDetails: group.accountDetails,
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const groups = normalizeGroups(supplierGroups.map(group => {
      const resolved = resolveGroupSupplier(group)
      return { ...group, ...resolved }
    }))

    if (groups.length === 0 || !groups.some(g => g.items.some(i => i.productName.trim()))) return
    if (linkMode === "project" && !projectName.trim()) return
    if (linkMode === "supplier" && !groups[0]?.supplierId && !groups[0]?.supplierName) return

    setSaving(true)
    try {
      const flatItems = groups.flatMap(group => group.items)
      const totalAmount = sumSupplierGroups(groups)
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

      const primary = groups[0]
      const saved = await savePurchaseLedgerEntry({
        ...(isEditing ? { id: editingEntryId! } : {}),
        ledgerNumber,
        transactionDate,
        linkMode,
        projectName: linkMode === "project" ? projectName : "",
        orderId: null,
        orderNumber: "",
        supplierId: primary?.supplierId ?? null,
        supplierName: groups.map(g => g.supplierName).filter(Boolean).join(", "),
        productName: flatItems[0]?.productName ?? "",
        transactionType,
        category: "expense",
        quantity: flatItems.reduce((s, i) => s + i.quantity, 0),
        unitPrice: flatItems[0]?.unitPrice ?? 0,
        totalAmount,
        amountPaid,
        amountDue,
        items: flatItems,
        supplierGroups: groups,
        payments,
        notes,
        dueDate,
        accountDetails: primary?.accountDetails ?? "",
        paymentProofUrl: payments[0]?.proofUrl ?? "",
        paymentProofName: payments[0]?.proofName ?? "",
        createdBy: isEditing ? originalCreatedBy : user.name,
        purchaseScopeId,
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

  const filtered = useMemo(() => {
    const q = filterSearch.trim().toLowerCase()
    return entries.filter(e => {
      if (filterLinkMode !== "all" && normalizeLinkMode(e.linkMode) !== filterLinkMode) return false
      if (filterTransactionType !== "all" && e.transactionType !== filterTransactionType) return false
      if (filterSupplierId !== "all") {
        const inGroups = e.supplierGroups.some(g => g.supplierId === filterSupplierId)
        if (e.supplierId !== filterSupplierId && !inGroups) return false
      }
      if (filterPaymentStatus === "paid" && e.amountDue > 0) return false
      if (filterPaymentStatus === "due" && e.amountDue <= 0) return false
      if (filterPaymentStatus === "partial" && (e.amountPaid <= 0 || e.amountDue <= 0)) return false
      if (filterDateFrom && e.transactionDate < filterDateFrom) return false
      if (filterDateTo && e.transactionDate > filterDateTo) return false
      if (filterDueFrom && (!e.dueDate || e.dueDate < filterDueFrom)) return false
      if (filterDueTo && (!e.dueDate || e.dueDate > filterDueTo)) return false
      if (q) {
        const haystack = [
          e.ledgerNumber,
          e.supplierName,
          e.projectName,
          formatLedgerProject(e),
          formatLedgerSuppliers(e),
          formatLedgerItemsSummary(e),
          e.notes,
        ].join(" ").toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [
    entries,
    filterLinkMode,
    filterTransactionType,
    filterSupplierId,
    filterPaymentStatus,
    filterSearch,
    filterDateFrom,
    filterDateTo,
    filterDueFrom,
    filterDueTo,
  ])

  const filterStats = useMemo(() => ({
    count: filtered.length,
    total: filtered.reduce((s, e) => s + e.totalAmount, 0),
    paid: filtered.reduce((s, e) => s + e.amountPaid, 0),
    due: filtered.reduce((s, e) => s + e.amountDue, 0),
  }), [filtered])

  const hasActiveFilters = Boolean(
    filterLinkMode !== "all"
    || filterTransactionType !== "all"
    || filterSupplierId !== "all"
    || filterPaymentStatus !== "all"
    || filterSearch.trim()
    || filterDateFrom
    || filterDateTo
    || filterDueFrom
    || filterDueTo,
  )

  function clearFilters() {
    setFilterLinkMode("all")
    setFilterTransactionType("all")
    setFilterSupplierId("all")
    setFilterPaymentStatus("all")
    setFilterSearch("")
    setFilterDateFrom("")
    setFilterDateTo("")
    setFilterDueFrom("")
    setFilterDueTo("")
  }

  function buildFilterSummary() {
    const parts: string[] = []
    if (filterLinkMode !== "all") parts.push(formatLinkModeLabel(filterLinkMode))
    if (filterTransactionType !== "all") parts.push(filterTransactionType)
    if (filterSupplierId !== "all") parts.push(suppliers.find(s => s.id === filterSupplierId)?.name || "Supplier")
    if (filterPaymentStatus !== "all") parts.push(filterPaymentStatus)
    if (filterSearch.trim()) parts.push(`search: ${filterSearch.trim()}`)
    if (filterDateFrom || filterDateTo) parts.push(`date ${filterDateFrom || "…"}–${filterDateTo || "…"}`)
    if (filterDueFrom || filterDueTo) parts.push(`due ${filterDueFrom || "…"}–${filterDueTo || "…"}`)
    return parts.length > 0 ? parts.join(" · ") : "All entries"
  }

  async function exportFilteredExcel() {
    if (filtered.length === 0) return
    setExporting(true)
    try {
      downloadPurchaseLedgerExcel(filtered, {
        exportedBy: user?.name,
        filterSummary: buildFilterSummary(),
      })
    } finally {
      setExporting(false)
    }
  }

  async function exportFilteredPdf() {
    if (filtered.length === 0) return
    setExporting(true)
    try {
      await downloadPurchaseLedgerReportPDF(filtered, {
        exportedBy: user?.name,
        filterSummary: buildFilterSummary(),
      })
    } finally {
      setExporting(false)
    }
  }

  async function exportEntryPdf(entry: PurchaseLedgerEntry) {
    await downloadPurchaseLedgerEntryPDF(entry)
  }

  function exportEntryExcel(entry: PurchaseLedgerEntry) {
    downloadPurchaseLedgerEntryExcel(entry)
  }

  const activeGroups = linkMode === "project" ? supplierGroups : [supplierGroups[0] ?? newSupplierGroup()]

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
            {entries.length} entries · track purchases, partial payments, and supplier spend
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer"
            disabled={filtered.length === 0 || exporting}
            onClick={() => void exportFilteredExcel()}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer"
            disabled={filtered.length === 0 || exporting}
            onClick={() => void exportFilteredPdf()}
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => void openNewForm()}>
            <Plus className="h-3.5 w-3.5" /> New purchase
          </Button>
        </div>
      </div>

      <section className="rounded-lg border bg-[hsl(var(--card))] overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setFiltersOpen(open => !open)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer border-b border-[hsl(var(--border))]/60"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#1faca6] shrink-0" />
          <span className="text-xs font-semibold">Filters & summary</span>
          {hasActiveFilters && (
            <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-[#1faca6]/40 text-[#1faca6]">
              Active
            </Badge>
          )}
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] hidden sm:inline">
              {filterStats.count} shown · {fmtMoney(filterStats.total)}
            </span>
            {filtersOpen
              ? <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              : <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
          </span>
        </button>

        <div className="p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Search ledger, supplier, project, items..."
                className={inputCls + " pl-8"}
              />
            </div>
            {hasActiveFilters && (
              <Button type="button" size="sm" variant="ghost" className="h-8 text-[10px] cursor-pointer shrink-0" onClick={clearFilters}>
                <RotateCcw className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>

          {filtersOpen && (
            <div className="space-y-3 pt-1 border-t border-[hsl(var(--border))]/60">
              <div className="flex flex-wrap items-center gap-2">
                <select value={filterLinkMode} onChange={e => setFilterLinkMode(e.target.value)} className={filterSelectCls}>
                  <option value="all">All link types</option>
                  {PURCHASE_LINK_MODES.map(mode => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
                <select value={filterTransactionType} onChange={e => setFilterTransactionType(e.target.value)} className={filterSelectCls}>
                  <option value="all">All transaction types</option>
                  {PURCHASE_TRANSACTION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select value={filterSupplierId} onChange={e => setFilterSupplierId(e.target.value)} className={filterSelectCls + " max-w-[180px]"}>
                  <option value="all">All suppliers</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select value={filterPaymentStatus} onChange={e => setFilterPaymentStatus(e.target.value)} className={filterSelectCls}>
                  <option value="all">All payments</option>
                  <option value="paid">Fully paid</option>
                  <option value="partial">Partially paid</option>
                  <option value="due">Has amount due</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] shrink-0 w-8">Date</span>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={filterSelectCls + " w-[132px]"} />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">to</span>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={filterSelectCls + " w-[132px]"} />
                <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] shrink-0 ml-2 w-8">Due</span>
                <input type="date" value={filterDueFrom} onChange={e => setFilterDueFrom(e.target.value)} className={filterSelectCls + " w-[132px]"} />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">to</span>
                <input type="date" value={filterDueTo} onChange={e => setFilterDueTo(e.target.value)} className={filterSelectCls + " w-[132px]"} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[hsl(var(--muted-foreground))] rounded-md bg-[hsl(var(--muted))]/15 px-3 py-2">
            <span><strong className="text-[hsl(var(--foreground))]">{filterStats.count}</strong> shown</span>
            <span>Total <strong className="text-[#1faca6]">{fmtMoney(filterStats.total)}</strong></span>
            <span>Paid <strong className="text-emerald-600">{fmtMoney(filterStats.paid)}</strong></span>
            <span>Due <strong className="text-amber-600">{fmtMoney(filterStats.due)}</strong></span>
          </div>
        </div>
      </section>

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
                <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-2 gap-y-2">
                  <Field label="Ledger No." hint="Auto-generated">
                    <input readOnly value={ledgerNumber} className={inputCls + " bg-[hsl(var(--muted))]/30"} />
                  </Field>
                  <Field label="Date" hint="Today">
                    <input type="date" required value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Link type">
                    <select value={linkMode} onChange={e => onLinkModeChange(e.target.value as PurchaseLinkMode)} className={inputCls}>
                      {PURCHASE_LINK_MODES.map(mode => (
                        <option key={mode.value} value={mode.value}>{mode.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Transaction type">
                    <select value={transactionType} onChange={e => setTransactionType(e.target.value as PurchaseTransactionType)} className={inputCls}>
                      {PURCHASE_TRANSACTION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Due date">
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
                  </Field>
                </section>

                <DottedRule />

                {linkMode === "project" && (
                  <Field label="Project name">
                    <input required value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name" className={inputCls} />
                  </Field>
                )}

                <div className="space-y-3">
                  {linkMode === "project" && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">Suppliers & items</p>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => setSupplierGroups(prev => [...prev, newSupplierGroup()])}>
                        <Plus className="h-3 w-3" /> Add supplier
                      </Button>
                    </div>
                  )}

                  {activeGroups.map((group, groupIndex) => (
                    <section key={group.id} className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3 space-y-3">
                      {linkMode === "project" && (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold">Supplier {groupIndex + 1}</p>
                          {supplierGroups.length > 1 && (
                            <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px] text-red-500 cursor-pointer" onClick={() => setSupplierGroups(prev => prev.filter(g => g.id !== group.id))}>
                              <Trash2 className="h-3 w-3" /> Remove
                            </Button>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 items-start">
                        <SupplierPicker
                          suppliers={suppliers}
                          supplierId={group.supplierId || ""}
                          purchaseScopeId={purchaseScopeId}
                          onSupplierIdChange={id => {
                            const supplier = suppliers.find(s => s.id === id)
                            updateSupplierGroup(group.id, {
                              supplierId: id || null,
                              supplierName: supplier?.name ?? "",
                              accountDetails: [supplier?.bankAccountName, supplier?.bankIban].filter(Boolean).join(" · "),
                            })
                          }}
                          onSuppliersChange={setSuppliers}
                          onAccountDetailsChange={details => updateSupplierGroup(group.id, { accountDetails: details })}
                          compact
                        />
                        <Field label="Account details" hint="From supplier bank info">
                          <input value={group.accountDetails} onChange={e => updateSupplierGroup(group.id, { accountDetails: e.target.value })} placeholder="Bank account / IBAN" className={inputCls} />
                        </Field>
                      </div>

                      <LineItemsEditor
                        items={group.items}
                        onChange={items => updateSupplierGroup(group.id, { items })}
                      />
                    </section>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 px-1">
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {linkMode === "project" ? "Project total" : "Grand total"}
                  </span>
                  <span className="text-base font-semibold text-[#1faca6]">{fmtMoney(grandTotal)}</span>
                </div>

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
          onExportExcel={() => exportEntryExcel(detailEntry)}
          onExportPdf={() => void exportEntryPdf(detailEntry)}
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
        <table className="w-full text-xs min-w-[1200px]">
          <thead>
            <tr className="border-b bg-[hsl(var(--muted))]/40">
              {[
                "Ledger No.", "Date", "Project / Supplier", "Supplier(s)", "Items",
                "Total", "Paid", "Due", "Due Date", "Payments", "",
              ].map(h => (
                <th key={h} className="h-9 px-2 text-left font-medium text-[hsl(var(--muted-foreground))] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">
                {entries.length === 0 ? "No purchase entries yet. Click \"New purchase\" to add one." : "No entries match your filters."}
              </td></tr>
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
                    <Badge variant="outline" className="text-[10px] w-fit">{formatLinkModeLabel(entry.linkMode)}</Badge>
                    <span>{formatLedgerProject(entry)}</span>
                  </div>
                </td>
                <td className="px-2 py-2">{formatLedgerSuppliers(entry)}</td>
                <td className="px-2 py-2 max-w-[180px]">
                  <p className="truncate" title={formatLedgerItemsSummary(entry)}>{formatLedgerItemsSummary(entry)}</p>
                  {entry.supplierGroups.length > 1 && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{entry.supplierGroups.length} suppliers</p>
                  )}
                  {entry.items.length > 1 && entry.supplierGroups.length <= 1 && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{entry.items.length} items</p>
                  )}
                </td>
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
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" title="Export Excel" onClick={() => exportEntryExcel(entry)}>
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" title="Export PDF" onClick={() => void exportEntryPdf(entry)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
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
