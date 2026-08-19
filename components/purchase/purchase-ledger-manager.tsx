"use client"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Upload, X, FileText, Wallet, Pencil, Search, Download, RotateCcw, FileSpreadsheet, ChevronDown, ChevronUp, SlidersHorizontal, Receipt, Paperclip, Building2 } from "lucide-react"
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
  sumGroupAmountPaid,
  sumGroupAmountDue,
  getGroupSubtotal,
  resolveGroupAmountPaid,
  resolveGroupAmountDue,
  withGroupPaymentTotals,
  clampPaymentsToTotal,
  syncSupplierGroupsToPayments,
  normalizeProjectPayments,
  normalizeSupplierKey,
  normalizeAttachments,
  withSyncedLegacyAttachments,
  taxAmountFromPercent,
  ledgerGrandTotal,
  buildRentLedgerPayload,
  formatTransactionTypeLabel,
  type LedgerAttachment,
  type PurchaseLedgerEntry,
  type PurchaseLedgerItem,
  type PurchaseLedgerPayment,
  type PurchaseLedgerSupplierGroup,
  type PurchaseLinkMode,
  type PurchaseTransactionType,
} from "@/lib/purchase-ledger"
import { embedBillInNotes, isImageBillUrl } from "@/lib/purchase-ledger-bill"
import { uploadFile } from "@/lib/upload"
import { SupplierPicker } from "@/components/purchase/supplier-picker"
import { ProjectPicker, buildProjectOptions } from "@/components/purchase/project-picker"
import { formatSupplierAccountDetails } from "@/lib/supplier-bank"
import { LedgerEntryDetailModal } from "@/components/purchase/ledger-entry-detail-modal"
import { getClientProjects, saveClientProject, type ClientProject } from "@/lib/client-projects"
import {
  downloadPurchaseLedgerEntryExcel,
  downloadPurchaseLedgerEntryPDF,
  downloadPurchaseLedgerExcel,
  downloadPurchaseLedgerReportPDF,
} from "@/lib/purchase-ledger-export"
import { purchaseScopeLabel } from "@/lib/purchase-scopes"

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

function collectGroupProofAttachments(
  group: PurchaseLedgerSupplierGroup,
  payments: PurchaseLedgerPayment[],
): LedgerAttachment[] {
  const synced = withSyncedLegacyAttachments(group)
  const fromGroup = normalizeAttachments(
    synced.paymentProofAttachments,
    synced.paymentProofUrl,
    synced.paymentProofName,
  )
  const groupName = normalizeSupplierKey(group.supplierName)
  const fromPayments = payments
    .filter(p => {
      if (!p.proofUrl) return false
      if (p.supplierGroupId === group.id) return true
      return Boolean(groupName && normalizeSupplierKey(p.supplierName) === groupName)
    })
    .map(p => ({ url: p.proofUrl, name: p.proofName || "Payment proof" }))
  return normalizeAttachments([...fromGroup, ...fromPayments])
}

function collectEntryBillAttachments(entry: PurchaseLedgerEntry): LedgerAttachment[] {
  const fromGroups = entry.supplierGroups.flatMap(group =>
    normalizeAttachments(group.billAttachments, group.billUrl, group.billName),
  )
  return normalizeAttachments([
    ...fromGroups,
    ...(entry.billUrl ? [{ url: entry.billUrl, name: entry.billName || "Bill" }] : []),
  ])
}

function collectEntryProofAttachments(entry: PurchaseLedgerEntry): LedgerAttachment[] {
  const fromGroups = entry.supplierGroups.flatMap(group =>
    normalizeAttachments(group.paymentProofAttachments, group.paymentProofUrl, group.paymentProofName),
  )
  const fromPayments = entry.payments
    .filter(p => p.proofUrl)
    .map(p => ({ url: p.proofUrl, name: p.proofName || "Payment proof" }))
  return normalizeAttachments([
    ...fromGroups,
    ...fromPayments,
    ...(entry.paymentProofUrl
      ? [{ url: entry.paymentProofUrl, name: entry.paymentProofName || "Payment proof" }]
      : []),
  ])
}

async function uploadAttachments(files: File[], folder: string): Promise<LedgerAttachment[]> {
  const out: LedgerAttachment[] = []
  for (const file of files) {
    out.push({ url: await uploadFile(file, folder), name: file.name })
  }
  return out
}

function appendProofPayments(
  payments: PurchaseLedgerPayment[],
  attachments: LedgerAttachment[],
  meta: {
    date: string
    createdBy: string
    supplierGroupId?: string
    supplierName?: string
    notesPrefix?: string
  },
): PurchaseLedgerPayment[] {
  if (attachments.length === 0) return payments
  const next = [...payments]
  const first = attachments[0]
  let attached = false
  for (let i = next.length - 1; i >= 0; i--) {
    const p = next[i]
    const sameGroup = !meta.supplierGroupId || p.supplierGroupId === meta.supplierGroupId
    if (sameGroup) {
      next[i] = { ...p, proofUrl: first.url, proofName: first.name }
      attached = true
      break
    }
  }
  if (!attached) {
    next.push({
      id: `${Date.now()}-proof-0`,
      amount: 0,
      date: meta.date,
      proofUrl: first.url,
      proofName: first.name,
      notes: `${meta.notesPrefix || "Payment proof"}${meta.supplierName ? ` · ${meta.supplierName}` : ""}`,
      createdAt: new Date().toISOString(),
      createdBy: meta.createdBy,
      supplierGroupId: meta.supplierGroupId,
      supplierName: meta.supplierName,
    })
  }
  for (let i = 1; i < attachments.length; i++) {
    const att = attachments[i]
    next.push({
      id: `${Date.now()}-proof-${i}-${Math.random().toString(36).slice(2, 7)}`,
      amount: 0,
      date: meta.date,
      proofUrl: att.url,
      proofName: att.name,
      notes: `${meta.notesPrefix || "Payment proof"}${meta.supplierName ? ` · ${meta.supplierName}` : ""}`,
      createdAt: new Date().toISOString(),
      createdBy: meta.createdBy,
      supplierGroupId: meta.supplierGroupId,
      supplierName: meta.supplierName,
    })
  }
  return next
}

function AttachmentList({
  items,
  onRemove,
  emptyLabel,
}: {
  items: { key: string; name: string; href?: string; previewUrl?: string }[]
  onRemove: (key: string) => void
  emptyLabel: string
}) {
  if (items.length === 0) {
    return <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{emptyLabel}</p>
  }
  return (
    <ul className="space-y-1.5">
      {items.map(item => (
        <li key={item.key} className="rounded-md border bg-[hsl(var(--muted))]/10 px-2 py-1.5 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-3 w-3 text-[#1faca6] shrink-0" />
            {item.href ? (
              <a href={item.href} target="_blank" rel="noreferrer" className="text-[10px] text-[#1faca6] hover:underline truncate flex-1">
                {item.name}
              </a>
            ) : (
              <span className="text-[10px] truncate flex-1">{item.name}</span>
            )}
            <button type="button" className="text-[10px] text-red-500 hover:underline shrink-0" onClick={() => onRemove(item.key)}>
              Remove
            </button>
          </div>
          {item.previewUrl && isImageBillUrl(item.previewUrl) && (
            <a href={item.previewUrl} target="_blank" rel="noreferrer" className="block">
              <img src={item.previewUrl} alt={item.name} className="max-h-24 w-full rounded border object-contain bg-white" />
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

function MultiFileDropzone({
  label,
  icon,
  hint,
  accentClass,
  onAddFiles,
}: {
  label: string
  icon: React.ReactNode
  hint: string
  accentClass: string
  onAddFiles: (files: File[]) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-medium text-[hsl(var(--foreground))] flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      <label className={`flex flex-col items-center justify-center gap-2 min-h-[72px] rounded-lg border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 px-3 py-3 cursor-pointer hover:bg-[hsl(var(--muted))]/25 ${accentClass} transition-colors`}>
        <Upload className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <span className="text-[10px] font-medium text-center">{hint}</span>
        <span className="text-[9px] text-[hsl(var(--muted-foreground))]">Multiple files allowed</span>
        <input
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || [])
            if (files.length) onAddFiles(files)
            e.target.value = ""
          }}
        />
      </label>
    </div>
  )
}

function SupplierGroupAttachments({
  group,
  pendingBillFiles,
  pendingProofFiles,
  existingProofs,
  onAddBillFiles,
  onAddProofFiles,
  onRemoveExistingBill,
  onRemoveExistingProof,
  onRemovePendingBill,
  onRemovePendingProof,
}: {
  group: PurchaseLedgerSupplierGroup
  pendingBillFiles: File[]
  pendingProofFiles: File[]
  existingProofs: LedgerAttachment[]
  onAddBillFiles: (files: File[]) => void
  onAddProofFiles: (files: File[]) => void
  onRemoveExistingBill: (url: string) => void
  onRemoveExistingProof: (url: string) => void
  onRemovePendingBill: (index: number) => void
  onRemovePendingProof: (index: number) => void
}) {
  const existingBills = normalizeAttachments(group.billAttachments, group.billUrl, group.billName)
  const [billPreviewUrls, setBillPreviewUrls] = useState<string[]>([])
  const [proofPreviewUrls, setProofPreviewUrls] = useState<string[]>([])

  useEffect(() => {
    const urls = pendingBillFiles.map(file => URL.createObjectURL(file))
    setBillPreviewUrls(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [pendingBillFiles])

  useEffect(() => {
    const urls = pendingProofFiles.map(file => URL.createObjectURL(file))
    setProofPreviewUrls(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [pendingProofFiles])

  return (
    <div className="rounded-md border bg-[hsl(var(--card))] px-3 py-2.5 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        Attachments
      </p>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div className="space-y-2">
          <MultiFileDropzone
            label="Purchase bill"
            icon={<Receipt className="h-3.5 w-3.5 text-[#1faca6]" />}
            hint="Click to add bill(s)"
            accentClass="hover:border-[#1faca6]/40"
            onAddFiles={onAddBillFiles}
          />
          <AttachmentList
            emptyLabel="No bills attached"
            onRemove={key => {
              if (key.startsWith("pending:")) onRemovePendingBill(Number(key.slice(8)))
              else onRemoveExistingBill(key)
            }}
            items={[
              ...existingBills.map(item => ({
                key: item.url,
                name: item.name,
                href: item.url,
                previewUrl: item.url,
              })),
              ...pendingBillFiles.map((file, index) => ({
                key: `pending:${index}`,
                name: file.name,
                previewUrl: billPreviewUrls[index],
              })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <MultiFileDropzone
            label="Payment proof"
            icon={<Wallet className="h-3.5 w-3.5 text-emerald-600" />}
            hint="Click to add proof(s)"
            accentClass="hover:border-emerald-500/40"
            onAddFiles={onAddProofFiles}
          />
          <AttachmentList
            emptyLabel="No payment proofs attached"
            onRemove={key => {
              if (key.startsWith("pending:")) onRemovePendingProof(Number(key.slice(8)))
              else onRemoveExistingProof(key)
            }}
            items={[
              ...existingProofs.map(item => ({
                key: item.url,
                name: item.name,
                href: item.url,
                previewUrl: item.url,
              })),
              ...pendingProofFiles.map((file, index) => ({
                key: `pending:${index}`,
                name: file.name,
                previewUrl: proofPreviewUrls[index],
              })),
            ]}
          />
        </div>
      </div>
    </div>
  )
}

function fmtMoney(n: number) {
  return `Rs. ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
}

function getEntryBillLinks(entry: PurchaseLedgerEntry) {
  if (entry.linkMode === "project" && entry.supplierGroups.length > 0) {
    return entry.supplierGroups.flatMap(group =>
      normalizeAttachments(group.billAttachments, group.billUrl, group.billName).map(att => ({
        url: att.url,
        name: att.name || group.supplierName || "Bill",
      })),
    )
  }
  return collectEntryBillAttachments(entry).map(att => ({
    url: att.url,
    name: att.name || "Bill attached",
  }))
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
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_88px_120px_128px_36px] gap-3 px-3 py-1.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-b bg-[hsl(var(--muted))]/10">
        <span>Product</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span>Line total</span>
        <span />
      </div>
      <div className="divide-y">
        {items.map((item, index) => (
          <div key={item.id} className="px-3 py-3 space-y-2 md:space-y-0 md:grid md:grid-cols-[minmax(0,1fr)_88px_120px_128px_36px] md:gap-3 md:items-end">
            <div className="min-w-0">
              <label className="md:hidden text-[10px] font-medium text-[hsl(var(--muted-foreground))] mb-1 block">Product</label>
              <input required value={item.productName} onChange={e => onChange(items.map(row => row.id === item.id ? { ...row, productName: e.target.value } : row))} placeholder={`Item ${index + 1}`} className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-2 md:contents">
              <div className="min-w-0">
                <label className="md:hidden text-[10px] font-medium text-[hsl(var(--muted-foreground))] mb-1 block">Qty</label>
                <input type="number" min="0" step="any" value={item.quantity || ""} onChange={e => onChange(updateItemField(items, item.id, "quantity", e.target.value))} className={inputCls} inputMode="decimal" />
              </div>
              <div className="min-w-0">
                <label className="md:hidden text-[10px] font-medium text-[hsl(var(--muted-foreground))] mb-1 block">Unit price</label>
                <input type="number" min="0" step="any" value={item.unitPrice || ""} onChange={e => onChange(updateItemField(items, item.id, "unitPrice", e.target.value))} className={inputCls} inputMode="decimal" />
              </div>
              <div className="min-w-0">
                <label className="md:hidden text-[10px] font-medium text-[hsl(var(--muted-foreground))] mb-1 block">Total</label>
                <input type="number" min="0" step="any" value={item.lineTotal || ""} onChange={e => onChange(updateItemField(items, item.id, "lineTotal", e.target.value))} className={inputCls} inputMode="decimal" />
              </div>
            </div>
            <div className="flex justify-end md:justify-center">
              {items.length > 1 ? (
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-500 shrink-0" onClick={() => onChange(items.filter(row => row.id !== item.id))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : <span className="hidden md:block w-8" />}
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

const filterSelectCls = "h-8 w-full sm:w-auto rounded-md border bg-[hsl(var(--background))] px-2 text-xs min-w-0"

type RentRow = {
  id: string
  outletName: string
  supplierId: string | null
  landlordName: string
  amount: string
  periodLabel: string
  dueDate: string
}

function newRentRow(): RentRow {
  return {
    id: `rent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    outletName: "",
    supplierId: null,
    landlordName: "",
    amount: "",
    periodLabel: "",
    dueDate: "",
  }
}

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
  const [showRentForm, setShowRentForm] = useState(false)
  const [rentRows, setRentRows] = useState<RentRow[]>([newRentRow()])
  const [rentTransactionDate, setRentTransactionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [rentSaving, setRentSaving] = useState(false)

  const [payEntry, setPayEntry] = useState<PurchaseLedgerEntry | null>(null)
  const [paySupplierGroupId, setPaySupplierGroupId] = useState("")
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
  const [taxPercent, setTaxPercent] = useState("")
  const [taxAmount, setTaxAmount] = useState("")
  const [amountPayingNow, setAmountPayingNow] = useState("")
  const [groupPayingNow, setGroupPayingNow] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState("")
  const [clientProjects, setClientProjects] = useState<ClientProject[]>([])
  const [billFiles, setBillFiles] = useState<File[]>([])
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [existingBillAttachments, setExistingBillAttachments] = useState<LedgerAttachment[]>([])
  const [existingProofAttachments, setExistingProofAttachments] = useState<LedgerAttachment[]>([])
  const [clearedProofPaymentIds, setClearedProofPaymentIds] = useState<string[]>([])
  const [groupBillFiles, setGroupBillFiles] = useState<Record<string, File[]>>({})
  const [groupProofFiles, setGroupProofFiles] = useState<Record<string, File[]>>({})

  const itemsSubtotal = useMemo(() => sumSupplierGroups(supplierGroups), [supplierGroups])
  const taxAmountValue = Math.max(0, parseFloat(taxAmount) || 0)
  const taxPercentValue = Math.max(0, parseFloat(taxPercent) || 0)
  const grandTotal = useMemo(
    () => ledgerGrandTotal(itemsSubtotal, taxAmountValue),
    [itemsSubtotal, taxAmountValue],
  )

  // Keep tax amount aligned with % when items change.
  useEffect(() => {
    const pct = parseFloat(taxPercent) || 0
    if (pct <= 0) return
    setTaxAmount(String(taxAmountFromPercent(itemsSubtotal, pct)))
  }, [itemsSubtotal, taxPercent])
  const payingNow = parseFloat(amountPayingNow) || 0
  const isEditing = Boolean(editingEntryId)
  const existingPaid = useMemo(() => sumPayments(existingPayments), [existingPayments])
  const isProjectMode = linkMode === "project"
  const projectGroupPaid = useMemo(() => {
    if (!isProjectMode) return 0
    const existingPaid = sumGroupAmountPaid(supplierGroups)
    const payingNowTotal = supplierGroups.reduce(
      (sum, group) => sum + (parseFloat(groupPayingNow[group.id] || "") || 0),
      0,
    )
    return isEditing ? existingPaid + payingNowTotal : payingNowTotal
  }, [isProjectMode, isEditing, supplierGroups, groupPayingNow])
  const projectGroupDue = useMemo(() => {
    if (!isProjectMode) return 0
    return supplierGroups.reduce((sum, group) => {
      const subtotal = getGroupSubtotal(group)
      const alreadyPaid = isEditing ? resolveGroupAmountPaid(group) : 0
      const paying = parseFloat(groupPayingNow[group.id] || "") || 0
      return sum + Math.max(0, subtotal - alreadyPaid - paying)
    }, 0)
  }, [isProjectMode, isEditing, supplierGroups, groupPayingNow])
  const totalPaidNow = isProjectMode ? projectGroupPaid : (isEditing ? existingPaid : payingNow)
  const amountDueNow = isProjectMode
    ? projectGroupDue
    : isEditing
      ? Math.max(0, grandTotal - existingPaid)
      : Math.max(0, grandTotal - payingNow)

  const [billPreviewUrls, setBillPreviewUrls] = useState<string[]>([])
  const [proofPreviewUrls, setProofPreviewUrls] = useState<string[]>([])

  useEffect(() => {
    const urls = billFiles.map(file => URL.createObjectURL(file))
    setBillPreviewUrls(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [billFiles])

  useEffect(() => {
    const urls = proofFiles.map(file => URL.createObjectURL(file))
    setProofPreviewUrls(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [proofFiles])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [ledgerRows, supplierRows, projectRows] = await Promise.all([
        getPurchaseLedgerEntries(purchaseScopeId),
        getSuppliers(purchaseScopeId),
        getClientProjects(purchaseScopeId),
      ])
      setEntries(ledgerRows)
      setSuppliers(supplierRows)
      setClientProjects(projectRows)
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
      date: group.date || transactionDate,
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
    setSupplierGroups([newSupplierGroup({ date: new Date().toISOString().slice(0, 10) })])
    setTransactionType("purchase")
    setTaxPercent("")
    setTaxAmount("")
    setAmountPayingNow("")
    setGroupPayingNow({})
    setNotes("")
    setBillFiles([])
    setProofFiles([])
    setExistingBillAttachments([])
    setExistingProofAttachments([])
    setClearedProofPaymentIds([])
    setGroupBillFiles({})
    setGroupProofFiles({})
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
    setTaxPercent(entry.taxPercent > 0 ? String(entry.taxPercent) : "")
    setTaxAmount(entry.taxAmount > 0 ? String(entry.taxAmount) : "")
    setNotes(entry.notes || "")
    setAmountPayingNow("")
    setGroupPayingNow({})
    setBillFiles([])
    setProofFiles([])
    setExistingBillAttachments(entry.linkMode === "project" ? [] : collectEntryBillAttachments(entry))
    setExistingProofAttachments(entry.linkMode === "project" ? [] : collectEntryProofAttachments(entry))
    setClearedProofPaymentIds([])
    setGroupBillFiles({})
    setGroupProofFiles({})
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

    if (groups.length === 0 || !groups.some(g => g.items.some(i => i.productName.trim()))) {
      alert("Add at least one item with a product name before saving.")
      return
    }
    if (linkMode === "project" && !projectName.trim()) {
      alert("Enter a project name before saving.")
      return
    }
    if (linkMode === "supplier" && !groups[0]?.supplierId && !groups[0]?.supplierName) {
      alert("Select a supplier before saving.")
      return
    }

    setSaving(true)
    try {
      const flatItems = groups.flatMap(group => group.items)
      const itemsSubtotalSave = sumSupplierGroups(groups)
      const taxPctSave = Math.max(0, parseFloat(taxPercent) || 0)
      let taxAmtSave = Math.max(0, parseFloat(taxAmount) || 0)
      if (taxPctSave > 0 && !(parseFloat(taxAmount) > 0)) {
        taxAmtSave = taxAmountFromPercent(itemsSubtotalSave, taxPctSave)
      }
      const totalAmount = ledgerGrandTotal(itemsSubtotalSave, taxAmtSave)
      let groupsWithPayments: PurchaseLedgerSupplierGroup[] = groups
      let payments: PurchaseLedgerPayment[] = []
      let amountPaid = 0
      let amountDue = totalAmount

      if (isEditing) {
        groupsWithPayments = []
        payments = normalizeProjectPayments(
          existingPayments.map(p =>
            clearedProofPaymentIds.includes(p.id)
              ? { ...p, proofUrl: "", proofName: "" }
              : { ...p },
          ),
          groups,
        )
        for (const group of groups) {
          const uploadedBills = await uploadAttachments(groupBillFiles[group.id] || [], "purchase-bills")
          const billAttachments = normalizeAttachments([
            ...normalizeAttachments(group.billAttachments, group.billUrl, group.billName),
            ...uploadedBills,
          ])
          const uploadedProofs = await uploadAttachments(groupProofFiles[group.id] || [], "payment-proofs")
          const paymentProofAttachments = normalizeAttachments([
            ...(isProjectMode
              ? normalizeAttachments(group.paymentProofAttachments, group.paymentProofUrl, group.paymentProofName)
              : []),
            ...uploadedProofs,
          ])
          const syncedGroup = withSyncedLegacyAttachments({
            ...group,
            billAttachments,
            paymentProofAttachments,
          })

          const subtotal = getGroupSubtotal(group)
          // Use reconciled payment lines for this group (fixes stale/orphan group ids).
          const alreadyPaid = Math.min(
            subtotal,
            payments
              .filter(p => p.supplierGroupId === group.id)
              .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
          )
          const remaining = Math.max(0, subtotal - alreadyPaid)
          const paying = isProjectMode
            ? Math.min(parseFloat(groupPayingNow[group.id] || "") || 0, remaining)
            : 0
          const nextPaid = alreadyPaid + paying
          const proofUrl = syncedGroup.paymentProofUrl || ""
          const proofName = syncedGroup.paymentProofName || ""

          if (isProjectMode && paying > 0) {
            payments.push({
              id: `${Date.now()}-${group.id}`,
              amount: paying,
              date: group.date || transactionDate,
              proofUrl: uploadedProofs[0]?.url || proofUrl,
              proofName: uploadedProofs[0]?.name || proofName,
              notes: `Payment${group.supplierName ? ` · ${group.supplierName}` : ""}`,
              createdAt: new Date().toISOString(),
              createdBy: user.name,
              supplierGroupId: group.id,
              supplierName: group.supplierName,
            })
            if (uploadedProofs.length > 1) {
              payments = appendProofPayments(payments, uploadedProofs.slice(1), {
                date: group.date || transactionDate,
                createdBy: user.name,
                supplierGroupId: group.id,
                supplierName: group.supplierName,
              })
            }
          } else if (isProjectMode && uploadedProofs.length > 0) {
            payments = appendProofPayments(payments, uploadedProofs, {
              date: group.date || transactionDate,
              createdBy: user.name,
              supplierGroupId: group.id,
              supplierName: group.supplierName,
            })
          }

          groupsWithPayments.push({
            ...withGroupPaymentTotals(syncedGroup, isProjectMode ? nextPaid : alreadyPaid),
            date: group.date || transactionDate,
          })
        }

        if (!isProjectMode) {
          const uploadedBills = await uploadAttachments(billFiles, "purchase-bills")
          const uploadedProofs = await uploadAttachments(proofFiles, "payment-proofs")
          const billAttachments = normalizeAttachments([
            ...existingBillAttachments,
            ...uploadedBills,
          ])
          const proofAttachments = normalizeAttachments([
            ...existingProofAttachments,
            ...uploadedProofs,
          ])
          groupsWithPayments = groupsWithPayments.map((group, index) =>
            index === 0
              ? withSyncedLegacyAttachments({
                ...group,
                billAttachments,
                paymentProofAttachments: proofAttachments,
              })
              : group,
          )
          if (uploadedProofs.length > 0 || proofAttachments.length > 0) {
            payments = appendProofPayments(payments, uploadedProofs.length > 0 ? uploadedProofs : [], {
              date: transactionDate,
              createdBy: user.name,
            })
            // Keep payment proofs in sync with remaining attachment list (removals).
            const keepUrls = new Set(proofAttachments.map(a => a.url))
            payments = payments.map(p =>
              p.proofUrl && !keepUrls.has(p.proofUrl) ? { ...p, proofUrl: "", proofName: "" } : p,
            )
          } else {
            payments = payments.map(p => ({ ...p, proofUrl: "", proofName: "" }))
          }
          setExistingBillAttachments(billAttachments)
          setExistingProofAttachments(proofAttachments)
        }

        amountPaid = isProjectMode ? sumGroupAmountPaid(groupsWithPayments) : sumPayments(payments)
        amountDue = Math.max(0, totalAmount - amountPaid)
      } else if (isProjectMode) {
        groupsWithPayments = []
        payments = []
        for (const group of groups) {
          const uploadedBills = await uploadAttachments(groupBillFiles[group.id] || [], "purchase-bills")
          const uploadedProofs = await uploadAttachments(groupProofFiles[group.id] || [], "payment-proofs")
          const syncedGroup = withSyncedLegacyAttachments({
            ...group,
            billAttachments: normalizeAttachments([
              ...normalizeAttachments(group.billAttachments, group.billUrl, group.billName),
              ...uploadedBills,
            ]),
            paymentProofAttachments: normalizeAttachments([
              ...normalizeAttachments(group.paymentProofAttachments, group.paymentProofUrl, group.paymentProofName),
              ...uploadedProofs,
            ]),
          })
          const payingRaw = parseFloat(groupPayingNow[group.id] || "") || 0
          const paying = Math.min(payingRaw, getGroupSubtotal(group))
          const withPayment = withGroupPaymentTotals(syncedGroup, paying)
          groupsWithPayments.push({
            ...withPayment,
            date: group.date || transactionDate,
          })
          if (paying > 0) {
            payments.push({
              id: `${Date.now()}-${group.id}`,
              amount: paying,
              date: group.date || transactionDate,
              proofUrl: uploadedProofs[0]?.url || syncedGroup.paymentProofUrl || "",
              proofName: uploadedProofs[0]?.name || syncedGroup.paymentProofName || "",
              notes: `Initial payment${group.supplierName ? ` · ${group.supplierName}` : ""}`,
              createdAt: new Date().toISOString(),
              createdBy: user.name,
              supplierGroupId: group.id,
              supplierName: group.supplierName,
            })
            if (uploadedProofs.length > 1) {
              payments = appendProofPayments(payments, uploadedProofs.slice(1), {
                date: group.date || transactionDate,
                createdBy: user.name,
                supplierGroupId: group.id,
                supplierName: group.supplierName,
              })
            }
          } else if (uploadedProofs.length > 0) {
            payments = appendProofPayments(payments, uploadedProofs, {
              date: group.date || transactionDate,
              createdBy: user.name,
              supplierGroupId: group.id,
              supplierName: group.supplierName,
            })
          }
        }
        amountPaid = sumGroupAmountPaid(groupsWithPayments)
        amountDue = Math.max(0, totalAmount - amountPaid)
      } else {
        const uploadedBills = await uploadAttachments(billFiles, "purchase-bills")
        const uploadedProofs = await uploadAttachments(proofFiles, "payment-proofs")
        const billAttachments = normalizeAttachments(uploadedBills)
        const proofAttachments = normalizeAttachments(uploadedProofs)
        const paidOnCreate = payingNow > 0 ? payingNow : 0
        groupsWithPayments = groups.map((group, index) => {
          const withPay = withGroupPaymentTotals(group, groups.length === 1 ? paidOnCreate : 0)
          return index === 0
            ? withSyncedLegacyAttachments({
              ...withPay,
              billAttachments,
              paymentProofAttachments: proofAttachments,
            })
            : withPay
        })
        if (paidOnCreate > 0) {
          payments = [{
            id: Date.now().toString(),
            amount: paidOnCreate,
            date: transactionDate,
            proofUrl: proofAttachments[0]?.url || "",
            proofName: proofAttachments[0]?.name || "",
            notes: "Initial payment",
            createdAt: new Date().toISOString(),
            createdBy: user.name,
          }]
          if (proofAttachments.length > 1) {
            payments = appendProofPayments(payments, proofAttachments.slice(1), {
              date: transactionDate,
              createdBy: user.name,
            })
          }
          amountPaid = paidOnCreate
          amountDue = Math.max(0, totalAmount - paidOnCreate)
        } else if (proofAttachments.length > 0) {
          payments = appendProofPayments([], proofAttachments, {
            date: transactionDate,
            createdBy: user.name,
          })
        }
      }

      let billUrl = ""
      let billName = ""
      if (!isProjectMode) {
        const firstBills = normalizeAttachments(
          groupsWithPayments[0]?.billAttachments,
          groupsWithPayments[0]?.billUrl,
          groupsWithPayments[0]?.billName,
        )
        billUrl = firstBills[0]?.url || existingBillAttachments[0]?.url || ""
        billName = firstBills[0]?.name || existingBillAttachments[0]?.name || ""
      } else {
        const firstGroupBill = groupsWithPayments.find(group => group.billUrl)
        billUrl = firstGroupBill?.billUrl || ""
        billName = firstGroupBill?.billName || ""
      }

      const primary = groups[0]
      const clampedPayments = isProjectMode
        ? normalizeProjectPayments(payments, groupsWithPayments, totalAmount)
        : clampPaymentsToTotal(payments, totalAmount)
      const syncedGroups = isProjectMode
        ? syncSupplierGroupsToPayments(groupsWithPayments, clampedPayments)
        : groupsWithPayments
      const finalPaid = Math.min(
        totalAmount,
        Math.max(amountPaid, sumPayments(clampedPayments), sumGroupAmountPaid(syncedGroups)),
      )
      const finalDue = Math.max(0, totalAmount - finalPaid)
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
        taxPercent: taxPctSave,
        taxAmount: taxAmtSave,
        totalAmount,
        amountPaid: finalPaid,
        amountDue: finalDue,
        items: flatItems,
        supplierGroups: syncedGroups,
        payments: clampedPayments,
        notes: isProjectMode
          ? notes.trim()
          : embedBillInNotes(notes.trim(), { billUrl, billName }),
        dueDate: "",
        accountDetails: primary?.accountDetails ?? "",
        paymentProofUrl: clampedPayments.find(p => p.proofUrl)?.proofUrl
          || syncedGroups.find(g => g.paymentProofUrl)?.paymentProofUrl
          || (isEditing && !isProjectMode ? existingProofAttachments[0]?.url : "")
          || "",
        paymentProofName: clampedPayments.find(p => p.proofUrl)?.proofName
          || syncedGroups.find(g => g.paymentProofUrl)?.paymentProofName
          || (isEditing && !isProjectMode ? existingProofAttachments[0]?.name : "")
          || "",
        billUrl,
        billName,
        createdBy: isEditing ? originalCreatedBy : user.name,
        purchaseScopeId,
      })

      if (linkMode === "project" && projectName.trim()) {
        const exists = clientProjects.some(
          p => p.projectName.trim().toLowerCase() === projectName.trim().toLowerCase(),
        )
        if (!exists) {
          try {
            const created = await saveClientProject({
              purchaseScopeId,
              projectName: projectName.trim(),
              clientName: "",
              createdBy: user.name,
            })
            setClientProjects(prev => [created, ...prev])
          } catch (err) {
            console.error("Could not create client project from ledger:", err)
          }
        }
      }

      setEntries(prev => isEditing
        ? prev.map(row => row.id === saved.id ? saved : row)
        : [saved, ...prev])
      const wasEditing = isEditing
      closeForm()
      if (wasEditing) setDetailEntryId(saved.id)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save purchase ledger entry. Please try again.")
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

  function openRentForm() {
    setRentRows([newRentRow()])
    setRentTransactionDate(new Date().toISOString().slice(0, 10))
    setShowRentForm(true)
  }

  function updateRentRow(id: string, patch: Partial<RentRow>) {
    setRentRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row))
  }

  const rentPreviewTotal = useMemo(
    () =>
      rentRows.reduce((sum, row) => {
        const amount = parseFloat(row.amount) || 0
        return row.outletName.trim() && amount > 0 ? sum + amount : sum
      }, 0),
    [rentRows],
  )

  async function handleSaveRents(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const valid = rentRows.filter(row => row.outletName.trim() && (parseFloat(row.amount) || 0) > 0)
    if (valid.length === 0) {
      alert("Add at least one rent with outlet / property name and amount.")
      return
    }
    setRentSaving(true)
    try {
      const saved: PurchaseLedgerEntry[] = []
      for (const row of valid) {
        const ledgerNumber = await getNextLedgerNumber(purchaseScopeId)
        const supplier = suppliers.find(s => s.id === row.supplierId)
        const landlordName = supplier?.name ?? row.landlordName.trim()
        const entry = await savePurchaseLedgerEntry(
          buildRentLedgerPayload({
            purchaseScopeId,
            ledgerNumber,
            transactionDate: rentTransactionDate,
            outletName: row.outletName.trim(),
            landlordSupplierId: row.supplierId,
            landlordName,
            amount: parseFloat(row.amount) || 0,
            dueDate: row.dueDate,
            periodLabel: row.periodLabel.trim(),
            createdBy: user.name,
          }),
        )
        saved.push(entry)
      }
      setEntries(prev => [...saved, ...prev])
      setShowRentForm(false)
      setRentRows([newRentRow()])
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save rent entries.")
    } finally {
      setRentSaving(false)
    }
  }

  function openPayModal(entry: PurchaseLedgerEntry) {
    setPayEntry(entry)
    const projectGroups = entry.linkMode === "project" && entry.supplierGroups.length > 0
      ? entry.supplierGroups
      : []
    const defaultGroup = projectGroups.find(group => resolveGroupAmountDue(group) > 0) ?? projectGroups[0]
    setPaySupplierGroupId(defaultGroup?.id ?? "")
    setPayAmount(String(defaultGroup ? resolveGroupAmountDue(defaultGroup) : (entry.amountDue || 0)))
    setPayNotes("")
    setPayProofFile(null)
    setPayProofPreview("")
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !payEntry) return
    const requested = parseFloat(payAmount) || 0
    if (requested <= 0) return
    const selectedGroup = payEntry.supplierGroups.find(group => group.id === paySupplierGroupId)
    const maxAllowed = selectedGroup
      ? resolveGroupAmountDue(selectedGroup)
      : payEntry.amountDue
    if (maxAllowed <= 0) {
      alert("This entry is already fully paid.")
      return
    }
    const amount = Math.min(requested, maxAllowed)
    if (requested > maxAllowed) {
      alert(`Amount capped at due ${fmtMoney(maxAllowed)}.`)
    }
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
        notes: payNotes || (selectedGroup?.supplierName ? `Payment · ${selectedGroup.supplierName}` : ""),
        createdBy: user.name,
        supplierGroupId: paySupplierGroupId || undefined,
        supplierName: selectedGroup?.supplierName,
      })
      setEntries(prev => prev.map(row => row.id === updated.id ? updated : row))
      setPayEntry(null)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to record payment. Please try again.")
    } finally {
      setPaySaving(false)
    }
  }

  const projectOptions = useMemo(
    () =>
      buildProjectOptions(
        clientProjects,
        entries.filter(e => e.linkMode === "project").map(e => e.projectName),
      ),
    [clientProjects, entries],
  )

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
          <h2 className="text-base font-semibold">
            Purchase Ledger
            <span className="text-[hsl(var(--muted-foreground))] font-normal"> · {purchaseScopeLabel(purchaseScopeId)}</span>
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {entries.length} entries · {purchaseScopeLabel(purchaseScopeId)} ({purchaseScopeId})
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
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => void openRentForm()}>
            <Building2 className="h-3.5 w-3.5" /> Add rents
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
              {filterStats.count} shown · purchases + rents · {fmtMoney(filterStats.total)}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2">
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
                <select value={filterSupplierId} onChange={e => setFilterSupplierId(e.target.value)} className={filterSelectCls + " lg:max-w-[180px]"}>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] shrink-0">Date</span>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={filterSelectCls + " flex-1 min-w-[120px]"} />
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">to</span>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={filterSelectCls + " flex-1 min-w-[120px]"} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] shrink-0">Due</span>
                  <input type="date" value={filterDueFrom} onChange={e => setFilterDueFrom(e.target.value)} className={filterSelectCls + " flex-1 min-w-[120px]"} />
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">to</span>
                  <input type="date" value={filterDueTo} onChange={e => setFilterDueTo(e.target.value)} className={filterSelectCls + " flex-1 min-w-[120px]"} />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[hsl(var(--muted-foreground))] rounded-md bg-[hsl(var(--muted))]/15 px-3 py-2">
            <span><strong className="text-[hsl(var(--foreground))]">{filterStats.count}</strong> shown · purchases + rents</span>
            <span>Total <strong className="text-[#1faca6]">{fmtMoney(filterStats.total)}</strong></span>
            <span>Paid <strong className="text-emerald-600">{fmtMoney(filterStats.paid)}</strong></span>
            <span>Due <strong className="text-amber-600">{fmtMoney(filterStats.due)}</strong></span>
          </div>
        </div>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={closeForm}>
          <div className="w-full sm:max-w-6xl max-h-[96vh] sm:max-h-[94vh] flex flex-col rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b shrink-0 bg-[hsl(var(--muted))]/15">
              <div className="min-w-0 pr-2">
                <p className="text-sm font-semibold">{isEditing ? "Edit purchase entry" : "New purchase entry"}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                  {isEditing
                    ? "Update entry details · bills & payment proofs · payments kept as recorded"
                    : "Multiple items · partial payments · bill & payment proof · auto totals"}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={closeForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-3 overscroll-contain">
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                </section>

                <DottedRule />

                {linkMode === "project" && (
                  <ProjectPicker
                    required
                    value={projectName}
                    onChange={setProjectName}
                    options={projectOptions}
                  />
                )}

                <div className="space-y-3">
                  {linkMode === "project" && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">Suppliers & items</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] cursor-pointer"
                        onClick={() => setSupplierGroups(prev => [
                          ...prev,
                          newSupplierGroup({ date: transactionDate }),
                        ])}
                      >
                        <Plus className="h-3 w-3" /> Add supplier
                      </Button>
                    </div>
                  )}

                  {activeGroups.map((group, groupIndex) => (
                    <section key={group.id} className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3 space-y-3">
                      {linkMode === "project" && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold">Supplier {groupIndex + 1}</p>
                            {(group.date || transactionDate) && (
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                                Date {group.date || transactionDate}
                              </p>
                            )}
                          </div>
                          {supplierGroups.length > 1 && (
                            <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px] text-red-500 cursor-pointer" onClick={() => setSupplierGroups(prev => prev.filter(g => g.id !== group.id))}>
                              <Trash2 className="h-3 w-3" /> Remove
                            </Button>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 items-start">
                        <SupplierPicker
                          suppliers={suppliers}
                          supplierId={group.supplierId || ""}
                          supplierName={group.supplierName || ""}
                          purchaseScopeId={purchaseScopeId}
                          onSupplierIdChange={id => {
                            const supplier = suppliers.find(s => s.id === id)
                            updateSupplierGroup(group.id, {
                              supplierId: id || null,
                              supplierName: supplier?.name ?? "",
                              accountDetails: formatSupplierAccountDetails(supplier),
                            })
                          }}
                          onSupplierNameChange={name => {
                            updateSupplierGroup(group.id, {
                              supplierId: null,
                              supplierName: name,
                            })
                          }}
                          onSuppliersChange={setSuppliers}
                          onAccountDetailsChange={details => updateSupplierGroup(group.id, { accountDetails: details })}
                          compact
                        />
                        <Field label="Date" hint="Supplier purchase / payment date">
                          <input
                            type="date"
                            value={group.date || transactionDate}
                            onChange={e => updateSupplierGroup(group.id, { date: e.target.value })}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Account details" hint="From supplier bank info">
                          <input value={group.accountDetails} onChange={e => updateSupplierGroup(group.id, { accountDetails: e.target.value })} placeholder="Bank account / IBAN" className={inputCls} />
                        </Field>
                      </div>

                      <LineItemsEditor
                        items={group.items}
                        onChange={items => updateSupplierGroup(group.id, { items })}
                      />

                      {isProjectMode && (
                        <div className="rounded-md border bg-[hsl(var(--card))] px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
                            Supplier payment
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                            <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--muted))]/20 px-2.5 py-1.5 min-h-8">
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Supplier total</p>
                              <p className="text-xs font-semibold sm:mt-0.5">{fmtMoney(getGroupSubtotal(group))}</p>
                            </div>
                            {isEditing && (
                              <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--muted))]/20 px-2.5 py-1.5 min-h-8">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Paid</p>
                                <p className="text-xs font-semibold sm:mt-0.5 text-emerald-600">{fmtMoney(resolveGroupAmountPaid(group))}</p>
                              </div>
                            )}
                            <div className="min-w-0">
                              <label className="text-[10px] font-medium text-[hsl(var(--foreground))] block mb-0.5">Paying now</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                max={Math.max(0, getGroupSubtotal(group) - (isEditing ? resolveGroupAmountPaid(group) : 0)) || undefined}
                                value={groupPayingNow[group.id] || ""}
                                onChange={e => setGroupPayingNow(prev => ({ ...prev, [group.id]: e.target.value }))}
                                placeholder="0"
                                className={inputCls}
                              />
                            </div>
                            <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--muted))]/20 px-2.5 py-1.5 min-h-8">
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Remaining</p>
                              <p className="text-xs font-semibold sm:mt-0.5 text-amber-700 dark:text-amber-400">
                                {fmtMoney(Math.max(
                                  0,
                                  getGroupSubtotal(group)
                                    - (isEditing ? resolveGroupAmountPaid(group) : 0)
                                    - (parseFloat(groupPayingNow[group.id] || "") || 0),
                                ))}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {isProjectMode && (
                        <SupplierGroupAttachments
                          group={group}
                          pendingBillFiles={groupBillFiles[group.id] || []}
                          pendingProofFiles={groupProofFiles[group.id] || []}
                          existingProofs={collectGroupProofAttachments(group, existingPayments)}
                          onAddBillFiles={files => {
                            setGroupBillFiles(prev => ({
                              ...prev,
                              [group.id]: [...(prev[group.id] || []), ...files],
                            }))
                          }}
                          onAddProofFiles={files => {
                            setGroupProofFiles(prev => ({
                              ...prev,
                              [group.id]: [...(prev[group.id] || []), ...files],
                            }))
                          }}
                          onRemovePendingBill={index => {
                            setGroupBillFiles(prev => ({
                              ...prev,
                              [group.id]: (prev[group.id] || []).filter((_, i) => i !== index),
                            }))
                          }}
                          onRemovePendingProof={index => {
                            setGroupProofFiles(prev => ({
                              ...prev,
                              [group.id]: (prev[group.id] || []).filter((_, i) => i !== index),
                            }))
                          }}
                          onRemoveExistingBill={url => {
                            const remaining = normalizeAttachments(
                              group.billAttachments,
                              group.billUrl,
                              group.billName,
                            ).filter(att => att.url !== url)
                            updateSupplierGroup(group.id, withSyncedLegacyAttachments({
                              ...group,
                              billAttachments: remaining,
                            }))
                          }}
                          onRemoveExistingProof={url => {
                            const remaining = collectGroupProofAttachments(group, existingPayments)
                              .filter(att => att.url !== url)
                            updateSupplierGroup(group.id, withSyncedLegacyAttachments({
                              ...group,
                              paymentProofAttachments: remaining,
                            }))
                            const affectedIds = existingPayments
                              .filter(p => p.proofUrl === url)
                              .map(p => p.id)
                            if (affectedIds.length > 0) {
                              setClearedProofPaymentIds(prev =>
                                Array.from(new Set([...prev, ...affectedIds])),
                              )
                              setExistingPayments(prev =>
                                prev.map(p =>
                                  p.proofUrl === url ? { ...p, proofUrl: "", proofName: "" } : p,
                                ),
                              )
                            }
                          }}
                        />
                      )}
                    </section>
                  ))}
                </div>

                <div className="rounded-lg border bg-[hsl(var(--muted))]/10 px-3 py-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Items subtotal</span>
                    <span className="text-sm font-semibold tabular-nums">{fmtMoney(itemsSubtotal)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Tax %" hint="e.g. 18 for GST">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={taxPercent}
                        onChange={e => {
                          const next = e.target.value
                          setTaxPercent(next)
                          const pct = parseFloat(next) || 0
                          if (pct > 0) {
                            setTaxAmount(String(taxAmountFromPercent(itemsSubtotal, pct)))
                          } else if (!next.trim()) {
                            setTaxAmount("")
                          }
                        }}
                        placeholder="0"
                        className={inputCls}
                        inputMode="decimal"
                      />
                    </Field>
                    <Field label="Tax amount (PKR)" hint="Added to grand total">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={taxAmount}
                        onChange={e => {
                          setTaxAmount(e.target.value)
                          // Manual amount overrides percent linkage for display; keep % if set for reference
                        }}
                        onBlur={() => {
                          // If percent is set, keep amount in sync with current subtotal on blur when amount empty
                          const pct = parseFloat(taxPercent) || 0
                          if (pct > 0 && !(parseFloat(taxAmount) > 0)) {
                            setTaxAmount(String(taxAmountFromPercent(itemsSubtotal, pct)))
                          }
                        }}
                        placeholder="0"
                        className={inputCls}
                        inputMode="decimal"
                      />
                    </Field>
                  </div>
                  {taxPercentValue > 0 && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      Tax {taxPercentValue}% of {fmtMoney(itemsSubtotal)} = {fmtMoney(taxAmountValue)}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t pt-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      {linkMode === "project" ? "Project total" : "Grand total"}
                    </span>
                    <span className="text-base font-semibold text-[#1faca6] tabular-nums">{fmtMoney(grandTotal)}</span>
                  </div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    Grand total = items subtotal + tax
                  </p>
                </div>

                {!isProjectMode && (
                <section className="rounded-lg border border-[#1faca6]/25 bg-[#1faca6]/5 px-3 py-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-[#1faca6] shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">Attachments</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        Attach multiple purchase bills and payment proofs
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                    <div className="rounded-lg border bg-[hsl(var(--card))] p-3 space-y-2">
                      <MultiFileDropzone
                        label="Purchase bill"
                        icon={<Receipt className="h-3.5 w-3.5 text-[#1faca6]" />}
                        hint="Click to add bill(s)"
                        accentClass="hover:border-[#1faca6]/40"
                        onAddFiles={files => setBillFiles(prev => [...prev, ...files])}
                      />
                      <AttachmentList
                        emptyLabel="No bills attached"
                        onRemove={key => {
                          if (key.startsWith("pending:")) {
                            const index = Number(key.slice(8))
                            setBillFiles(prev => prev.filter((_, i) => i !== index))
                          } else {
                            setExistingBillAttachments(prev => prev.filter(att => att.url !== key))
                          }
                        }}
                        items={[
                          ...existingBillAttachments.map(att => ({
                            key: att.url,
                            name: att.name,
                            href: att.url,
                            previewUrl: att.url,
                          })),
                          ...billFiles.map((file, index) => ({
                            key: `pending:${index}`,
                            name: file.name,
                            previewUrl: billPreviewUrls[index],
                          })),
                        ]}
                      />
                    </div>

                    <div className="rounded-lg border bg-[hsl(var(--card))] p-3 space-y-2">
                      <MultiFileDropzone
                        label="Payment proof"
                        icon={<Wallet className="h-3.5 w-3.5 text-emerald-600" />}
                        hint="Click to add proof(s)"
                        accentClass="hover:border-emerald-500/40"
                        onAddFiles={files => setProofFiles(prev => [...prev, ...files])}
                      />
                      <AttachmentList
                        emptyLabel="No payment proofs attached"
                        onRemove={key => {
                          if (key.startsWith("pending:")) {
                            const index = Number(key.slice(8))
                            setProofFiles(prev => prev.filter((_, i) => i !== index))
                          } else {
                            setExistingProofAttachments(prev => prev.filter(att => att.url !== key))
                            setExistingPayments(prev =>
                              prev.map(p =>
                                p.proofUrl === key ? { ...p, proofUrl: "", proofName: "" } : p,
                              ),
                            )
                          }
                        }}
                        items={[
                          ...existingProofAttachments.map(att => ({
                            key: att.url,
                            name: att.name,
                            href: att.url,
                            previewUrl: att.url,
                          })),
                          ...proofFiles.map((file, index) => ({
                            key: `pending:${index}`,
                            name: file.name,
                            previewUrl: proofPreviewUrls[index],
                          })),
                        ]}
                      />
                    </div>
                  </div>
                </section>
                )}

                <section className="rounded-lg border bg-[hsl(var(--muted))]/10 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
                    {isProjectMode ? "Project payment summary" : "Payment"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--card))] px-2.5 py-1.5 min-h-8">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{isProjectMode ? "Project total" : "Grand total"}</p>
                      <p className="text-xs font-semibold sm:mt-0.5">{fmtMoney(grandTotal)}</p>
                    </div>
                    {isProjectMode ? (
                      <>
                        <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--card))] px-2.5 py-1.5 min-h-8">
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Total paid</p>
                          <p className="text-xs font-semibold sm:mt-0.5 text-emerald-600">{fmtMoney(totalPaidNow)}</p>
                        </div>
                        <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--card))] px-2.5 py-1.5 min-h-8">
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Total remaining</p>
                          <p className="text-xs font-semibold sm:mt-0.5 text-amber-700 dark:text-amber-400">{fmtMoney(amountDueNow)}</p>
                        </div>
                      </>
                    ) : isEditing ? (
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
                    {!isProjectMode && (
                      <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--card))] px-2.5 py-1.5 min-h-8">
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Amount due</p>
                        <p className="text-xs font-semibold sm:mt-0.5 text-amber-700 dark:text-amber-400">{fmtMoney(amountDueNow)}</p>
                      </div>
                    )}
                  </div>
                  {isEditing && !isProjectMode && (
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-2">
                      Use Pay due from the ledger to add more payments.
                    </p>
                  )}
                </section>

                <Field label="Note">
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." className={inputCls} />
                </Field>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 sm:px-5 py-3 border-t shrink-0 bg-[hsl(var(--muted))]/10 safe-area-pb">
                <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 text-xs cursor-pointer w-full sm:w-auto" onClick={closeForm}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving} className="h-10 sm:h-8 text-xs w-full sm:w-auto sm:min-w-[120px] cursor-pointer">
                  {saving ? "Saving..." : isEditing ? "Save changes" : "Save entry"}
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

      {showRentForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => !rentSaving && setShowRentForm(false)}
        >
          <div
            className="w-full sm:max-w-4xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b shrink-0 bg-[hsl(var(--muted))]/15">
              <div className="min-w-0 pr-2">
                <p className="text-sm font-semibold">Add rents</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  Multiple outlet / property rents · saved to purchase ledger · included in totals
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={rentSaving}
                onClick={() => setShowRentForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={e => void handleSaveRents(e)} className="flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-3 overscroll-contain">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Rent date" hint="Applied to all rows below">
                    <input
                      type="date"
                      required
                      value={rentTransactionDate}
                      onChange={e => setRentTransactionDate(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <div className="rounded-md border bg-[hsl(var(--muted))]/15 px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Batch total</span>
                    <span className="text-sm font-semibold text-[#1faca6] tabular-nums">{fmtMoney(rentPreviewTotal)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Rent lines</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] cursor-pointer"
                      onClick={() => setRentRows(prev => [...prev, newRentRow()])}
                    >
                      <Plus className="h-3 w-3" /> Add another rent
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {rentRows.map((row, index) => (
                      <section
                        key={row.id}
                        className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            Rent {index + 1}
                          </p>
                          {rentRows.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] text-red-500 cursor-pointer"
                              onClick={() => setRentRows(prev => prev.filter(r => r.id !== row.id))}
                            >
                              <Trash2 className="h-3 w-3" /> Remove
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Field label="Outlet / property" hint="e.g. Lahore Outlet Rent">
                            <input
                              required
                              value={row.outletName}
                              onChange={e => updateRentRow(row.id, { outletName: e.target.value })}
                              placeholder="Property or outlet name"
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Amount (PKR)" hint="Monthly rent">
                            <input
                              required
                              type="number"
                              min="0"
                              step="any"
                              value={row.amount}
                              onChange={e => updateRentRow(row.id, { amount: e.target.value })}
                              placeholder="0"
                              className={inputCls}
                              inputMode="decimal"
                            />
                          </Field>
                        </div>
                        <Field label="Landlord / payee" hint="Select supplier or type name">
                          <SupplierPicker
                            suppliers={suppliers}
                            supplierId={row.supplierId || ""}
                            supplierName={row.landlordName}
                            purchaseScopeId={purchaseScopeId}
                            onSupplierIdChange={id => {
                              const supplier = suppliers.find(s => s.id === id)
                              updateRentRow(row.id, {
                                supplierId: id || null,
                                landlordName: supplier?.name ?? "",
                              })
                            }}
                            onSupplierNameChange={name =>
                              updateRentRow(row.id, { supplierId: null, landlordName: name })
                            }
                            onSuppliersChange={setSuppliers}
                            compact
                          />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Field label="Period" hint="Optional · e.g. August 2026">
                            <input
                              value={row.periodLabel}
                              onChange={e => updateRentRow(row.id, { periodLabel: e.target.value })}
                              placeholder="Month or period"
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Due date" hint="Optional">
                            <input
                              type="date"
                              value={row.dueDate}
                              onChange={e => updateRentRow(row.id, { dueDate: e.target.value })}
                              className={inputCls}
                            />
                          </Field>
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t shrink-0 bg-[hsl(var(--muted))]/10">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={rentSaving} onClick={() => setShowRentForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs cursor-pointer" disabled={rentSaving || rentPreviewTotal <= 0}>
                  {rentSaving ? "Saving…" : `Save ${rentRows.filter(r => r.outletName.trim() && parseFloat(r.amount) > 0).length} rent(s)`}
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
              {payEntry.linkMode === "project" && payEntry.supplierGroups.length > 0 && (
                <Field label="Supplier">
                  <select
                    value={paySupplierGroupId}
                    onChange={e => {
                      const groupId = e.target.value
                      const group = payEntry.supplierGroups.find(row => row.id === groupId)
                      setPaySupplierGroupId(groupId)
                      setPayAmount(String(group ? resolveGroupAmountDue(group) : 0))
                    }}
                    className={inputCls}
                  >
                    {payEntry.supplierGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.supplierName || "Supplier"} · Due {fmtMoney(resolveGroupAmountDue(group))}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
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

      <div className="space-y-3 md:hidden">
        {loading && (
          <div className="rounded-lg border px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">Loading...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
            {entries.length === 0 ? "No purchase entries yet. Tap \"New purchase\" to add one." : "No entries match your filters."}
          </div>
        )}
        {filtered.map(entry => (
          <div
            key={entry.id}
            role="button"
            tabIndex={0}
            onClick={() => setDetailEntryId(entry.id)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setDetailEntryId(entry.id) }}
            className="w-full text-left rounded-lg border bg-[hsl(var(--card))] p-3 space-y-2 hover:bg-[hsl(var(--muted))]/15 cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold font-mono text-[#1faca6]">{entry.ledgerNumber}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{entry.transactionDate}{entry.dueDate ? ` · Due ${entry.dueDate}` : ""}</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{formatLinkModeLabel(entry.linkMode)}</Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium truncate">{formatLedgerProject(entry)}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{formatLedgerSuppliers(entry)}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{formatLedgerItemsSummary(entry)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[hsl(var(--border))]/60">
              <div>
                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Total</p>
                <p className="text-xs font-semibold">{fmtMoney(entry.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Paid</p>
                <p className="text-xs font-semibold text-emerald-600">{fmtMoney(entry.amountPaid)}</p>
              </div>
              <div>
                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Due</p>
                <p className="text-xs font-semibold text-amber-600">{fmtMoney(entry.amountDue)}</p>
              </div>
            </div>
            {getEntryBillLinks(entry).map(bill => (
              <div key={bill.url} className="flex items-center gap-1.5 text-[10px] text-[#1faca6]" onClick={e => e.stopPropagation()}>
                <Receipt className="h-3 w-3 shrink-0" />
                <a href={bill.url} target="_blank" rel="noreferrer" className="hover:underline truncate">
                  {bill.name}
                </a>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
              <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => exportEntryExcel(entry)}>
                <FileSpreadsheet className="h-3 w-3" /> Excel
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => void exportEntryPdf(entry)}>
                <Download className="h-3 w-3" /> PDF
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => openEditForm(entry)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              {entry.amountDue > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => openPayModal(entry)}>
                  <Wallet className="h-3 w-3" /> Pay due
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-500 cursor-pointer" onClick={() => void handleDelete(entry.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block rounded-lg border overflow-x-auto">
        <table className="w-full text-xs min-w-[1100px]">
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
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="text-[10px] w-fit">{formatLinkModeLabel(entry.linkMode)}</Badge>
                      {entry.transactionType === "rent" && (
                        <Badge variant="outline" className="text-[10px] w-fit border-amber-500/40 text-amber-700 dark:text-amber-300">
                          {formatTransactionTypeLabel(entry.transactionType)}
                        </Badge>
                      )}
                    </div>
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
                    {getEntryBillLinks(entry).map(bill => (
                      <a
                        key={bill.url}
                        href={bill.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[#1faca6] hover:underline w-fit"
                      >
                        <Receipt className="h-3 w-3" />
                        <span className="truncate max-w-[100px]">{bill.name}</span>
                      </a>
                    ))}
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
