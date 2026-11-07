"use client"
import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Upload, X, FileText, Wallet, Pencil, Search, Download, FileSpreadsheet, SlidersHorizontal, Receipt, Paperclip, Building2, Fuel, ChevronDown, CalendarDays } from "lucide-react"
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
  sumGroupDiscounts,
  getGroupSubtotal,
  getGroupNetTotal,
  resolveGroupDiscount,
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
  aggregateLedgerStats,
  isRentLedgerEntry,
  type PurchaseLedgerStats,
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
import { listFuelAllotments, type FuelAllotment } from "@/lib/fuel-petrol"
import { downloadMoneyApprovalPdf } from "@/lib/generate-petty-cash-pending-pdf"

const inputCls =
  "w-full h-8 rounded-[9px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[12px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"

function todayPkIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-0.5 min-w-0">
    <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">{label}</label>
    {children}
    {hint ? <p className="text-[9px] text-[#aeaeb2] leading-tight">{hint}</p> : null}
  </div>
)

const DottedRule = () => (
  <div className="border-t border-black/[0.06]" aria-hidden />
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
  const existingUrls = new Set(next.map(p => p.proofUrl).filter(Boolean))
  const fresh = attachments.filter(att => att.url && !existingUrls.has(att.url))
  if (fresh.length === 0) return payments

  const first = fresh[0]
  let attached = false
  for (let i = next.length - 1; i >= 0; i--) {
    const p = next[i]
    const sameGroup = !meta.supplierGroupId || p.supplierGroupId === meta.supplierGroupId
    if (sameGroup && !p.proofUrl) {
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
  for (let i = 1; i < fresh.length; i++) {
    const att = fresh[i]
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
    return <p className="text-[10px] text-[#aeaeb2] px-0.5">{emptyLabel}</p>
  }
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-center gap-1.5 rounded-[9px] bg-[#f2f2f7]/90 dark:bg-white/[0.04] px-2 py-1.5 min-w-0"
        >
          {item.previewUrl && isImageBillUrl(item.previewUrl) ? (
            <img
              src={item.previewUrl}
              alt=""
              className="h-6 w-6 rounded object-cover border border-black/[0.06] shrink-0 bg-white"
            />
          ) : (
            <FileText className="h-3.5 w-3.5 text-[#0071e3] shrink-0" strokeWidth={1.75} />
          )}
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-[#0071e3] hover:underline truncate flex-1 font-medium"
            >
              {item.name}
            </a>
          ) : (
            <span className="text-[11px] truncate flex-1 font-medium tracking-tight">{item.name}</span>
          )}
          <button
            type="button"
            className="h-5 w-5 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 shrink-0 cursor-pointer"
            onClick={() => onRemove(item.key)}
            aria-label="Remove"
          >
            <X className="h-3 w-3" strokeWidth={2.25} />
          </button>
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
  const [dragging, setDragging] = useState(false)

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold tracking-tight text-[#86868b] flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <label
        className={`flex items-center gap-2 h-9 rounded-[10px] border border-dashed px-2.5 cursor-pointer transition-colors ${
          dragging
            ? "border-[#0071e3] bg-[#0071e3]/10"
            : `border-black/[0.12] bg-[#f2f2f7]/80 dark:bg-white/[0.03] hover:border-[#0071e3]/40 hover:bg-[#0071e3]/05 ${accentClass}`
        }`}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const files = Array.from(e.dataTransfer.files || []).filter(
            (f) => f.type.startsWith("image/") || f.type === "application/pdf" || /\.pdf$/i.test(f.name),
          )
          if (files.length) onAddFiles(files)
        }}
      >
        <Upload className="h-3.5 w-3.5 text-[#0071e3] shrink-0" strokeWidth={1.75} />
        <span className="text-[11px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
          {dragging ? "Drop files" : hint}
        </span>
        <span className="ml-auto text-[9px] text-[#aeaeb2] shrink-0 hidden sm:inline">PDF / image</span>
        <input
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
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
    <div className="rounded-[14px] border border-black/[0.06] bg-[#fafafa]/90 dark:bg-white/[0.02] px-3 py-3 space-y-2.5">
      <p className="text-[11px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
        Attachments
      </p>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div className="space-y-2">
          <MultiFileDropzone
            label="Purchase bill"
            icon={<Receipt className="h-3.5 w-3.5 text-[#0071e3]" strokeWidth={1.75} />}
            hint="Add bill(s)"
            accentClass=""
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
            icon={<Wallet className="h-3.5 w-3.5 text-[#248a3d]" strokeWidth={1.75} />}
            hint="Add proof(s)"
            accentClass=""
            onAddFiles={onAddProofFiles}
          />
          <AttachmentList
            emptyLabel="No payment proofs"
            onRemove={(key) => {
              if (key.startsWith("pending:")) onRemovePendingProof(Number(key.slice(8)))
              else onRemoveExistingProof(key)
            }}
            items={[
              ...existingProofs.map((item) => ({
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

function LedgerFilterSummary({
  stats,
  petrol,
}: {
  stats: {
    combined: PurchaseLedgerStats
    purchases: PurchaseLedgerStats
    rents: PurchaseLedgerStats
  }
  petrol: { count: number; total: number; settled: number; open: number; pending: number }
}) {
  const row = (label: string, s: PurchaseLedgerStats, accent = false) => (
    <div
      className={`rounded-[12px] px-2.5 py-2 ${
        accent ? "bg-[#0071e3]/08 border border-[#0071e3]/20" : "bg-[#f2f2f7]/90 dark:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
          {label}
        </p>
        <span className="text-[10px] text-[#86868b] tabular-nums">{s.count}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#86868b]">
        <span>
          Total <strong className="text-[#0071e3] font-semibold">{fmtMoney(s.total)}</strong>
        </span>
        <span>
          Paid <strong className="text-[#248a3d] font-semibold">{fmtMoney(s.paid)}</strong>
        </span>
        <span>
          Due <strong className="text-[#9a6700] font-semibold">{fmtMoney(s.due)}</strong>
        </span>
      </div>
    </div>
  )

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">Summary</p>
      {row("Combined", stats.combined, true)}
      {row("Purchases", stats.purchases)}
      {row("Rents", stats.rents)}
      <Link
        href="/petrol"
        className="rounded-[12px] bg-[#ff9f0a]/12 border border-[#ff9f0a]/25 px-2.5 py-2 block hover:bg-[#ff9f0a]/18 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            Petrol
          </p>
          <span className="text-[10px] text-[#86868b] tabular-nums">{petrol.count}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#86868b]">
          <span>
            Allotted <strong className="text-[#0071e3] font-semibold">{fmtMoney(petrol.total)}</strong>
          </span>
          <span>
            Open <strong className="text-[#9a6700] font-semibold">{petrol.open}</strong>
          </span>
          <span>
            Settled <strong className="text-[#248a3d] font-semibold">{petrol.settled}</strong>
          </span>
        </div>
      </Link>
    </div>
  )
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
    <div className="rounded-[12px] border border-black/[0.06] overflow-hidden bg-white/80 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-black/[0.06] bg-[#fafafa]/90">
        <p className="text-[11px] font-semibold tracking-tight">Items</p>
        <button
          type="button"
          className="h-6 inline-flex items-center gap-1 rounded-full px-2 text-[10px] font-semibold border border-black/[0.08] hover:bg-black/[0.04] cursor-pointer"
          onClick={() => onChange([...items, newLedgerItem()])}
        >
          <Plus className="h-3 w-3" strokeWidth={2} /> Add
        </button>
      </div>
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_56px_72px_80px_28px] gap-1.5 px-2.5 py-1 text-[9px] font-semibold tracking-tight text-[#86868b] border-b border-black/[0.04]">
        <span>Product</span>
        <span>Qty</span>
        <span>Unit</span>
        <span>Total</span>
        <span />
      </div>
      <div className="divide-y divide-black/[0.04] max-h-[9.5rem] overflow-y-auto scrollbar-none">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="px-2.5 py-1.5 space-y-1.5 md:space-y-0 md:grid md:grid-cols-[minmax(0,1fr)_56px_72px_80px_28px] md:gap-1.5 md:items-center"
          >
            <div className="min-w-0">
              <input
                required
                value={item.productName}
                onChange={(e) =>
                  onChange(items.map((row) => (row.id === item.id ? { ...row, productName: e.target.value } : row)))
                }
                placeholder={`Item ${index + 1}`}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5 md:contents">
              <input
                type="number"
                min="0"
                step="any"
                value={item.quantity || ""}
                onChange={(e) => onChange(updateItemField(items, item.id, "quantity", e.target.value))}
                className={inputCls}
                inputMode="decimal"
              />
              <input
                type="number"
                min="0"
                step="any"
                value={item.unitPrice || ""}
                onChange={(e) => onChange(updateItemField(items, item.id, "unitPrice", e.target.value))}
                className={inputCls}
                inputMode="decimal"
              />
              <input
                type="number"
                min="0"
                step="any"
                value={item.lineTotal || ""}
                onChange={(e) => onChange(updateItemField(items, item.id, "lineTotal", e.target.value))}
                className={inputCls}
                inputMode="decimal"
              />
            </div>
            <div className="flex justify-end md:justify-center">
              {items.length > 1 ? (
                <button
                  type="button"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 cursor-pointer"
                  onClick={() => onChange(items.filter((row) => row.id !== item.id))}
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                </button>
              ) : (
                <span className="hidden md:block w-7" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 px-2.5 py-1.5 border-t border-black/[0.06] bg-[#fafafa]/80">
        <span className="text-[10px] font-semibold text-[#86868b]">Subtotal</span>
        <span className="text-[12px] font-semibold text-[#0071e3] tabular-nums">{fmtMoney(sumItemTotals(items))}</span>
      </div>
    </div>
  )
}

const filterSelectCls =
  "h-8 w-full appearance-none rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] pl-2.5 pr-7 text-[12px] font-medium tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 cursor-pointer"
const filterDateCls =
  "h-8 w-full rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] pl-8 pr-2.5 text-[12px] font-medium tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 [color-scheme:light] dark:[color-scheme:dark]"
const appleField =
  "w-full h-8 rounded-[9px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2.5 text-[12px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
const appleSelect =
  "w-full h-8 appearance-none rounded-[9px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] pl-2.5 pr-7 text-[12px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 cursor-pointer"
const applePill =
  "h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.04] disabled:opacity-40 cursor-pointer"

function AppleSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative min-w-0">
      <select className={className} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]"
        strokeWidth={2.25}
      />
    </div>
  )
}

function AppleDateInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative min-w-0">
      <CalendarDays
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]"
        strokeWidth={1.75}
      />
      <input type="date" className={className} {...props} />
    </div>
  )
}

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
  const [showFilters, setShowFilters] = useState(false)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)
  const filterBtnRef = useRef<HTMLButtonElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const [showRentForm, setShowRentForm] = useState(false)
  const [petrolStats, setPetrolStats] = useState({
    count: 0,
    total: 0,
    settled: 0,
    open: 0,
    pending: 0,
  })
  const [petrolRows, setPetrolRows] = useState<FuelAllotment[]>([])
  const [rentRows, setRentRows] = useState<RentRow[]>([newRentRow()])
  const [rentTransactionDate, setRentTransactionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [rentSaving, setRentSaving] = useState(false)

  const [payEntry, setPayEntry] = useState<PurchaseLedgerEntry | null>(null)
  const [paySupplierGroupId, setPaySupplierGroupId] = useState("")
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(todayPkIso)
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
  const supplierDiscountValue = useMemo(
    () => Math.min(sumGroupDiscounts(supplierGroups), itemsSubtotal + taxAmountValue),
    [supplierGroups, itemsSubtotal, taxAmountValue],
  )
  const grandTotal = useMemo(
    () => ledgerGrandTotal(itemsSubtotal, taxAmountValue, supplierDiscountValue),
    [itemsSubtotal, taxAmountValue, supplierDiscountValue],
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
      const net = getGroupNetTotal(group)
      const alreadyPaid = isEditing ? resolveGroupAmountPaid(group) : 0
      const paying = parseFloat(groupPayingNow[group.id] || "") || 0
      return sum + Math.max(0, net - alreadyPaid - paying)
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
    if (!showFilters) {
      setFilterPos(null)
      return
    }
    function place() {
      const btn = filterBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelW = Math.min(360, window.innerWidth - 24)
      const left = Math.min(Math.max(12, r.right - panelW), window.innerWidth - panelW - 12)
      const top = Math.min(r.bottom + 8, window.innerHeight - 24)
      setFilterPos({ top, left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [showFilters])

  useEffect(() => {
    if (!showFilters) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (filtersRef.current?.contains(t) || filterBtnRef.current?.contains(t)) return
      setShowFilters(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [showFilters])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [ledgerRows, supplierRows, projectRows, fuelRows] = await Promise.all([
        getPurchaseLedgerEntries(purchaseScopeId),
        getSuppliers(purchaseScopeId),
        getClientProjects(purchaseScopeId),
        listFuelAllotments().catch(() => []),
      ])
      setEntries(ledgerRows)
      setSuppliers(supplierRows)
      setClientProjects(projectRows)
      setPetrolRows(fuelRows)
      setPetrolStats({
        count: fuelRows.length,
        total: fuelRows.reduce((s, a) => s + (Number(a.amountPkr) || 0), 0),
        settled: fuelRows.filter((a) => a.status === "settled").length,
        open: fuelRows.filter((a) => a.status === "allotted").length,
        pending: fuelRows.filter((a) => a.status === "pending_review").length,
      })
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
      const groupsWithDiscount = groups.map(group => {
        const discount = Math.min(resolveGroupDiscount(group), getGroupSubtotal(group))
        return { ...group, discount }
      })
      const supplierDiscountSave = Math.min(
        sumGroupDiscounts(groupsWithDiscount),
        itemsSubtotalSave + taxAmtSave,
      )
      const totalAmount = ledgerGrandTotal(itemsSubtotalSave, taxAmtSave, supplierDiscountSave)
      let groupsWithPayments: PurchaseLedgerSupplierGroup[] = groupsWithDiscount
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
          groupsWithDiscount,
        )
        for (const group of groupsWithDiscount) {
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

          const net = getGroupNetTotal(group)
          // Use reconciled payment lines for this group (fixes stale/orphan group ids).
          const alreadyPaid = Math.min(
            net,
            payments
              .filter(p => p.supplierGroupId === group.id)
              .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
          )
          const remaining = Math.max(0, net - alreadyPaid)
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
        for (const group of groupsWithDiscount) {
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
          const paying = Math.min(payingRaw, getGroupNetTotal(group))
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
        const paidOnCreate = payingNow > 0 ? Math.min(payingNow, totalAmount) : 0
        groupsWithPayments = groupsWithDiscount.map((group, index) => {
          const withPay = withGroupPaymentTotals(group, groupsWithDiscount.length === 1 ? paidOnCreate : 0)
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

      const primary = groupsWithDiscount[0]
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
        supplierName: groupsWithDiscount.map(g => g.supplierName).filter(Boolean).join(", "),
        productName: flatItems[0]?.productName ?? "",
        transactionType,
        category: "expense",
        quantity: flatItems.reduce((s, i) => s + i.quantity, 0),
        unitPrice: flatItems[0]?.unitPrice ?? 0,
        taxPercent: taxPctSave,
        taxAmount: taxAmtSave,
        supplierDiscount: supplierDiscountSave,
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
    setPayDate(todayPkIso())
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
        date: payDate || todayPkIso(),
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
    if (filterTransactionType === "petrol") return [] as PurchaseLedgerEntry[]
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

  const filteredPetrol = useMemo(() => {
    if (filterTransactionType !== "petrol") return [] as FuelAllotment[]
    const q = filterSearch.trim().toLowerCase()
    return petrolRows.filter((a) => {
      if (filterDateFrom) {
        const d = a.allottedAt.slice(0, 10)
        if (d < filterDateFrom) return false
      }
      if (filterDateTo) {
        const d = a.allottedAt.slice(0, 10)
        if (d > filterDateTo) return false
      }
      if (q) {
        const hay = [
          a.personName,
          a.vehicleName,
          a.vehiclePlate,
          a.notes,
          a.status,
          a.allottedBy,
        ]
          .join(" ")
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [petrolRows, filterTransactionType, filterSearch, filterDateFrom, filterDateTo])

  const filterStats = useMemo(() => {
    const rentEntries = filtered.filter(isRentLedgerEntry)
    const purchaseEntries = filtered.filter(entry => !isRentLedgerEntry(entry))
    return {
      combined: aggregateLedgerStats(filtered),
      purchases: aggregateLedgerStats(purchaseEntries),
      rents: aggregateLedgerStats(rentEntries),
    }
  }, [filtered])

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
    if (filterTransactionType !== "all") {
      parts.push(filterTransactionType === "petrol" ? "Petrol / fuel" : filterTransactionType)
    }
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

  async function exportApprovalPdf() {
    setExporting(true)
    try {
      await downloadMoneyApprovalPdf({
        ledgerDues: filtered,
        scopeLabel: `${purchaseScopeLabel(purchaseScopeId)} (${purchaseScopeId})`,
      })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not download approval PDF.")
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2">
            <span className="h-7 w-7 rounded-[9px] bg-[#0071e3]/10 inline-flex items-center justify-center shrink-0">
              <Receipt className="h-3.5 w-3.5 text-[#0071e3]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] leading-tight">
                Purchase Ledger
                <span className="text-[#86868b] font-medium"> · {purchaseScopeLabel(purchaseScopeId)}</span>
              </h2>
              <p className="text-[11px] text-[#86868b] tabular-nums">
                {filterTransactionType === "petrol"
                  ? `${filteredPetrol.length} petrol · ${fmtMoney(filteredPetrol.reduce((s, a) => s + (Number(a.amountPkr) || 0), 0))}`
                  : `${filterStats.combined.count} shown · ${fmtMoney(filterStats.combined.total)}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={applePill}
            disabled={filtered.length === 0 || exporting}
            onClick={() => void exportFilteredExcel()}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} /> Excel
          </button>
          <button
            type="button"
            className={applePill}
            disabled={exporting}
            onClick={() => void exportFilteredPdf()}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> PDF
          </button>
          <button
            type="button"
            className={applePill}
            disabled={exporting}
            onClick={() => void exportApprovalPdf()}
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={1.75} /> Approval
          </button>
          <Link href="/petrol" className={applePill}>
            <Fuel className="h-3.5 w-3.5" strokeWidth={1.75} /> Petrol
          </Link>
          <button type="button" className={applePill} onClick={() => void openRentForm()}>
            <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Rents
          </button>
          <button
            type="button"
            className="h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight bg-[#1d1d1f] hover:bg-black text-white cursor-pointer"
            onClick={() => void openNewForm()}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} /> New
          </button>
          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`relative h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              showFilters
                ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                : "text-[#86868b] hover:bg-black/[0.05] dark:hover:bg-white/10 hover:text-[#1d1d1f]"
            }`}
            aria-label="Filters"
            aria-expanded={showFilters}
            title="Filters"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            {hasActiveFilters && !showFilters && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#007aff]" />
            )}
          </button>
        </div>
      </div>

      {showFilters &&
        filterPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={filtersRef}
            className="fixed z-[95] w-[min(22.5rem,calc(100vw-1.5rem))] max-h-[min(78vh,40rem)] overflow-y-auto scrollbar-none overscroll-contain rounded-[18px] border border-black/[0.06] bg-white/92 dark:bg-[hsl(var(--card))]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-3 space-y-2.5"
            style={{ top: filterPos.top, left: filterPos.left }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                Filters
              </p>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[11px] font-semibold text-[#0071e3] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer"
                  aria-label="Close filters"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" strokeWidth={1.75} />
              <input
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search ledger, supplier…"
                className="w-full h-8 pl-8 pr-2.5 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] text-[12px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
              />
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              <AppleSelect value={filterLinkMode} onChange={(e) => setFilterLinkMode(e.target.value)} className={filterSelectCls}>
                <option value="all">All link types</option>
                {PURCHASE_LINK_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>{mode.label}</option>
                ))}
              </AppleSelect>
              <AppleSelect value={filterTransactionType} onChange={(e) => setFilterTransactionType(e.target.value)} className={filterSelectCls}>
                <option value="all">All transaction types</option>
                {PURCHASE_TRANSACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
                <option value="petrol">Petrol / fuel</option>
              </AppleSelect>
              <AppleSelect value={filterSupplierId} onChange={(e) => setFilterSupplierId(e.target.value)} className={filterSelectCls}>
                <option value="all">All suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </AppleSelect>
              <AppleSelect value={filterPaymentStatus} onChange={(e) => setFilterPaymentStatus(e.target.value)} className={filterSelectCls}>
                <option value="all">All payments</option>
                <option value="paid">Fully paid</option>
                <option value="partial">Partially paid</option>
                <option value="due">Has amount due</option>
              </AppleSelect>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">Date</p>
              <div className="grid grid-cols-2 gap-1.5">
                <AppleDateInput value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className={filterDateCls} />
                <AppleDateInput value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className={filterDateCls} />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">Due date</p>
              <div className="grid grid-cols-2 gap-1.5">
                <AppleDateInput value={filterDueFrom} onChange={(e) => setFilterDueFrom(e.target.value)} className={filterDateCls} />
                <AppleDateInput value={filterDueTo} onChange={(e) => setFilterDueTo(e.target.value)} className={filterDateCls} />
              </div>
            </div>

            <LedgerFilterSummary stats={filterStats} petrol={petrolStats} />
          </div>,
          document.body,
        )}

      {showForm &&
        typeof document !== "undefined" &&
        createPortal(
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-md p-0 sm:p-3" onClick={closeForm}>
          <div className="w-full sm:max-w-6xl max-h-[94vh] sm:max-h-[90vh] flex flex-col rounded-t-[18px] sm:rounded-[18px] border border-black/[0.06] bg-white dark:bg-[hsl(var(--card))] shadow-[0_16px_48px_rgba(0,0,0,0.28)] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 border-b border-black/[0.06] shrink-0">
              <div className="min-w-0 pr-2">
                <p className="text-[14px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                  {isEditing ? "Edit purchase" : "New purchase"}
                </p>
                <p className="text-[10px] text-[#86868b] truncate">
                  {isEditing ? "Payments kept as recorded" : "Items · tax · attachments"}
                </p>
              </div>
              <button
                type="button"
                className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                onClick={closeForm}
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1">
              <div className="min-h-0 flex-1 overflow-y-auto sm:overflow-hidden px-3.5 sm:px-4 py-3 space-y-2.5 overscroll-contain scrollbar-none">
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <Field label="Ledger No.">
                    <input readOnly value={ledgerNumber} className={`${inputCls} text-[#0071e3] font-semibold font-mono`} />
                  </Field>
                  <Field label="Date">
                    <AppleDateInput
                      required
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      className={`${appleField} pl-8`}
                    />
                  </Field>
                  <Field label="Link type">
                    <AppleSelect
                      value={linkMode}
                      onChange={(e) => onLinkModeChange(e.target.value as PurchaseLinkMode)}
                      className={appleSelect}
                    >
                      {PURCHASE_LINK_MODES.map((mode) => (
                        <option key={mode.value} value={mode.value}>{mode.label}</option>
                      ))}
                    </AppleSelect>
                  </Field>
                  <Field label="Transaction type">
                    <AppleSelect
                      value={transactionType}
                      onChange={(e) => setTransactionType(e.target.value as PurchaseTransactionType)}
                      className={appleSelect}
                    >
                      {PURCHASE_TRANSACTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </AppleSelect>
                  </Field>
                </section>

                {linkMode === "project" && (
                  <ProjectPicker
                    required
                    value={projectName}
                    onChange={setProjectName}
                    options={projectOptions}
                  />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] gap-3 lg:min-h-0 lg:overflow-hidden">
                <div className="space-y-2.5 min-w-0 lg:min-h-0 lg:overflow-y-auto scrollbar-none">
                  {linkMode === "project" && (
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold tracking-tight">Suppliers & items</p>
                      <button
                        type="button"
                        className="h-6 inline-flex items-center gap-1 rounded-full px-2 text-[10px] font-semibold border border-black/[0.08] hover:bg-black/[0.04] cursor-pointer"
                        onClick={() => setSupplierGroups(prev => [
                          ...prev,
                          newSupplierGroup({ date: transactionDate }),
                        ])}
                      >
                        <Plus className="h-3 w-3" strokeWidth={2} /> Add supplier
                      </button>
                    </div>
                  )}

                  {activeGroups.map((group, groupIndex) => (
                    <section key={group.id} className="rounded-[12px] border border-black/[0.06] bg-[#fafafa]/80 dark:bg-white/[0.02] p-2.5 space-y-2">
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
                        <Field label="Date">
                          <AppleDateInput
                            value={group.date || transactionDate}
                            onChange={(e) => updateSupplierGroup(group.id, { date: e.target.value })}
                            className={`${appleField} pl-8`}
                          />
                        </Field>
                        <Field label="Account details">
                          <input
                            value={group.accountDetails}
                            onChange={(e) => updateSupplierGroup(group.id, { accountDetails: e.target.value })}
                            placeholder="Bank / IBAN"
                            className={inputCls}
                          />
                        </Field>
                      </div>

                      <LineItemsEditor
                        items={group.items}
                        onChange={items => updateSupplierGroup(group.id, { items })}
                      />

                      {isProjectMode && (
                        <div className="rounded-md border bg-[hsl(var(--card))] px-3 py-2.5 space-y-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                            Supplier payment &amp; discount
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-end">
                            <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--muted))]/20 px-2.5 py-1.5 min-h-8">
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Supplier total</p>
                              <p className="text-xs font-semibold sm:mt-0.5">{fmtMoney(getGroupSubtotal(group))}</p>
                            </div>
                            <div className="min-w-0">
                              <label className="text-[10px] font-medium text-[hsl(var(--foreground))] block mb-0.5">
                                Supplier discount
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                max={getGroupSubtotal(group) || undefined}
                                value={group.discount ? String(group.discount) : ""}
                                onChange={e => {
                                  const raw = parseFloat(e.target.value) || 0
                                  const capped = Math.max(0, Math.min(raw, getGroupSubtotal(group)))
                                  updateSupplierGroup(group.id, {
                                    discount: e.target.value.trim() === "" ? 0 : capped,
                                  })
                                }}
                                placeholder="0"
                                className={inputCls}
                                inputMode="decimal"
                              />
                              <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5">
                                Reduces due — not counted as payment sent
                              </p>
                            </div>
                            {resolveGroupDiscount(group) > 0 && (
                              <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--muted))]/20 px-2.5 py-1.5 min-h-8">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">After discount</p>
                                <p className="text-xs font-semibold sm:mt-0.5 text-[#1faca6]">
                                  {fmtMoney(getGroupNetTotal(group))}
                                </p>
                              </div>
                            )}
                            {isEditing && (
                              <div className="flex items-center justify-between sm:block rounded-md border bg-[hsl(var(--muted))]/20 px-2.5 py-1.5 min-h-8">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Paid</p>
                                <p className="text-xs font-semibold sm:mt-0.5 text-emerald-600">
                                  {fmtMoney(resolveGroupAmountPaid(group))}
                                </p>
                              </div>
                            )}
                            <div className="min-w-0">
                              <label className="text-[10px] font-medium text-[hsl(var(--foreground))] block mb-0.5">Paying now</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                max={Math.max(0, getGroupNetTotal(group) - (isEditing ? resolveGroupAmountPaid(group) : 0)) || undefined}
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
                                  getGroupNetTotal(group)
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

                <div className="space-y-2 min-w-0 lg:min-h-0 lg:overflow-y-auto scrollbar-none">
                <div className="rounded-[12px] border border-black/[0.06] bg-[#f5f5f7]/80 dark:bg-white/[0.03] px-2.5 py-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#86868b]">Items subtotal</span>
                    <span className="text-[12px] font-semibold tabular-nums">{fmtMoney(itemsSubtotal)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Field label="Tax %">
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
                    <Field label="Tax amount">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={taxAmount}
                        onChange={e => setTaxAmount(e.target.value)}
                        onBlur={() => {
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
                    {!isProjectMode ? (
                      <Field label="Discount">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          max={itemsSubtotal + taxAmountValue || undefined}
                          value={
                            supplierGroups[0]?.discount
                              ? String(supplierGroups[0].discount)
                              : ""
                          }
                          onChange={e => {
                            const group = supplierGroups[0]
                            if (!group) return
                            const raw = parseFloat(e.target.value) || 0
                            const capped = Math.max(
                              0,
                              Math.min(raw, itemsSubtotal + taxAmountValue),
                            )
                            updateSupplierGroup(group.id, {
                              discount: e.target.value.trim() === "" ? 0 : capped,
                            })
                          }}
                          placeholder="0"
                          className={inputCls}
                          inputMode="decimal"
                        />
                      </Field>
                    ) : (
                      <div />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] pt-1.5">
                    <span className="text-[10px] font-semibold tracking-tight">
                      {linkMode === "project" ? "Project total" : "Grand total"}
                    </span>
                    <span className="text-[14px] font-semibold text-[#0071e3] tabular-nums">{fmtMoney(grandTotal)}</span>
                  </div>
                </div>

                {!isProjectMode && (
                <section className="rounded-[12px] border border-black/[0.06] bg-[#fafafa]/90 dark:bg-white/[0.02] px-2.5 py-2 space-y-2">
                  <p className="text-[11px] font-semibold tracking-tight flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-[#0071e3]" strokeWidth={1.75} />
                    Attachments
                  </p>
                  <div className="grid gap-2 grid-cols-1">
                    <div className="space-y-1">
                      <MultiFileDropzone
                        label="Purchase bill"
                        icon={<Receipt className="h-3.5 w-3.5 text-[#0071e3]" strokeWidth={1.75} />}
                        hint="Add bill(s)"
                        accentClass=""
                        onAddFiles={files => setBillFiles(prev => [...prev, ...files])}
                      />
                      <AttachmentList
                        emptyLabel="No bills"
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
                    <div className="space-y-1">
                      <MultiFileDropzone
                        label="Payment proof"
                        icon={<Wallet className="h-3.5 w-3.5 text-[#248a3d]" strokeWidth={1.75} />}
                        hint="Add proof(s)"
                        accentClass=""
                        onAddFiles={files => setProofFiles(prev => [...prev, ...files])}
                      />
                      <AttachmentList
                        emptyLabel="No proofs"
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

                <section className="rounded-[12px] border border-black/[0.06] bg-[#f5f5f7]/80 dark:bg-white/[0.03] px-2.5 py-2">
                  <p className="text-[10px] font-semibold tracking-tight text-[#86868b] mb-1.5">
                    {isProjectMode ? "Project payment" : "Payment"}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 items-end">
                    <div className="rounded-[10px] bg-white/80 dark:bg-white/[0.04] border border-black/[0.04] px-2 py-1.5">
                      <p className="text-[9px] text-[#86868b]">Total</p>
                      <p className="text-[12px] font-semibold tabular-nums">{fmtMoney(grandTotal)}</p>
                    </div>
                    {isProjectMode ? (
                      <>
                        <div className="rounded-[10px] bg-white/80 dark:bg-white/[0.04] border border-black/[0.04] px-2 py-1.5">
                          <p className="text-[9px] text-[#86868b]">Paid</p>
                          <p className="text-[12px] font-semibold tabular-nums text-[#248a3d]">{fmtMoney(totalPaidNow)}</p>
                        </div>
                        <div className="rounded-[10px] bg-white/80 dark:bg-white/[0.04] border border-black/[0.04] px-2 py-1.5">
                          <p className="text-[9px] text-[#86868b]">Due</p>
                          <p className="text-[12px] font-semibold tabular-nums text-[#9a6700]">{fmtMoney(amountDueNow)}</p>
                        </div>
                      </>
                    ) : isEditing ? (
                      <>
                        <div className="rounded-[10px] bg-white/80 dark:bg-white/[0.04] border border-black/[0.04] px-2 py-1.5">
                          <p className="text-[9px] text-[#86868b]">Paid</p>
                          <p className="text-[12px] font-semibold tabular-nums text-[#248a3d]">{fmtMoney(existingPaid)}</p>
                        </div>
                        <div className="rounded-[10px] bg-white/80 dark:bg-white/[0.04] border border-black/[0.04] px-2 py-1.5">
                          <p className="text-[9px] text-[#86868b]">Due</p>
                          <p className="text-[12px] font-semibold tabular-nums text-[#9a6700]">{fmtMoney(amountDueNow)}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Field label="Paying now">
                          <input type="number" min="0" step="any" value={amountPayingNow} onChange={e => setAmountPayingNow(e.target.value)} placeholder="0" className={inputCls} />
                        </Field>
                        <div className="rounded-[10px] bg-white/80 dark:bg-white/[0.04] border border-black/[0.04] px-2 py-1.5">
                          <p className="text-[9px] text-[#86868b]">Due</p>
                          <p className="text-[12px] font-semibold tabular-nums text-[#9a6700]">{fmtMoney(amountDueNow)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <Field label="Note">
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note" className={inputCls} />
                </Field>
                </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 sm:px-5 py-3 border-t border-black/[0.06] shrink-0 bg-[#fafafa]/90 dark:bg-[hsl(var(--muted))]/20">
                <button type="button" className={`${applePill} h-9 w-full sm:w-auto justify-center`} onClick={closeForm}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 w-full sm:w-auto sm:min-w-[7.5rem] rounded-full bg-[#1d1d1f] hover:bg-black text-white text-[12px] font-semibold tracking-tight cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving…" : isEditing ? "Save changes" : "Save entry"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
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

      {payEntry &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xl p-0 sm:p-4"
            onClick={() => setPayEntry(null)}
          >
            <div
              className="w-full sm:max-w-md rounded-t-[20px] sm:rounded-[20px] border border-black/[0.06] bg-white/95 dark:bg-[hsl(var(--card))] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/[0.06]">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    Pay due
                  </p>
                  <p className="text-[11px] text-[#86868b] mt-0.5 truncate">
                    {payEntry.ledgerNumber} · Due {fmtMoney(payEntry.amountDue)}
                  </p>
                </div>
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                  onClick={() => setPayEntry(null)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
              <form onSubmit={handleAddPayment} className="p-4 space-y-3">
                {payEntry.linkMode === "project" && payEntry.supplierGroups.length > 0 && (
                  <Field label="Supplier">
                    <select
                      value={paySupplierGroupId}
                      onChange={(e) => {
                        const groupId = e.target.value
                        const group = payEntry.supplierGroups.find((row) => row.id === groupId)
                        setPaySupplierGroupId(groupId)
                        setPayAmount(String(group ? resolveGroupAmountDue(group) : 0))
                      }}
                      className={appleField}
                    >
                      {payEntry.supplierGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.supplierName || "Supplier"} · Due {fmtMoney(resolveGroupAmountDue(group))}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Payment amount">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className={appleField}
                  />
                </Field>
                <Field label="Payment date">
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className={appleField}
                  />
                </Field>
                <Field label="Note">
                  <input
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="e.g. Second installment"
                    className={appleField}
                  />
                </Field>
                <Field label="Payment proof">
                  <label className="inline-flex items-center gap-2 h-9 px-3 rounded-[10px] bg-[#f2f2f7] dark:bg-[hsl(var(--background))] text-[12px] font-medium cursor-pointer hover:bg-black/[0.06]">
                    <Upload className="h-3.5 w-3.5" strokeWidth={1.75} /> Upload proof
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        setPayProofFile(file)
                        setPayProofPreview(file?.name ?? "")
                      }}
                    />
                  </label>
                  {payProofPreview && (
                    <p className="text-[11px] text-[#86868b] mt-1 truncate">{payProofPreview}</p>
                  )}
                </Field>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={paySaving}
                    className="h-9 flex-1 rounded-full bg-[#1d1d1f] hover:bg-black text-white text-[12px] font-semibold tracking-tight cursor-pointer disabled:opacity-50"
                  >
                    {paySaving ? "Saving…" : "Record payment"}
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-full border border-black/[0.08] text-[12px] font-semibold tracking-tight cursor-pointer hover:bg-black/[0.04]"
                    onClick={() => setPayEntry(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      <div className="space-y-3 md:hidden">
        {loading && (
          <div className="rounded-lg border px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">Loading...</div>
        )}
        {!loading && filterTransactionType === "petrol" && filteredPetrol.length === 0 && (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
            No petrol allotments match. Open Petrol to allot fuel.
          </div>
        )}
        {!loading && filterTransactionType === "petrol" && filteredPetrol.map((row) => (
          <Link
            key={row.id}
            href="/petrol"
            className="w-full text-left rounded-[14px] border border-black/[0.06] bg-white/90 dark:bg-[hsl(var(--card))] p-3 space-y-1.5 hover:bg-black/[0.02] block"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-tight">{row.personName}</p>
                <p className="text-[11px] text-[#86868b] mt-0.5">
                  {row.vehicleName}
                  {row.vehiclePlate ? ` · ${row.vehiclePlate}` : ""}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 ${
                  row.status === "settled"
                    ? "border-emerald-500/40 text-emerald-700"
                    : row.status === "pending_review"
                      ? "border-sky-500/40 text-sky-700"
                      : "border-amber-500/40 text-amber-700"
                }`}
              >
                {row.status === "pending_review" ? "pending review" : row.status}
              </Badge>
            </div>
            <p className="text-[13px] font-semibold text-[#0071e3] tabular-nums">{fmtMoney(row.amountPkr)}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Allotted {row.allottedAt.slice(0, 10)}
              {row.allottedBy ? ` · ${row.allottedBy}` : ""}
              {" · "}Petrol
            </p>
          </Link>
        ))}
        {!loading && filterTransactionType !== "petrol" && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
            {entries.length === 0 ? "No purchase entries yet. Tap \"New purchase\" to add one." : "No entries match your filters."}
          </div>
        )}
        {filterTransactionType !== "petrol" && filtered.map(entry => (
          <div
            key={entry.id}
            role="button"
            tabIndex={0}
            onClick={() => setDetailEntryId(entry.id)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setDetailEntryId(entry.id) }}
            className="w-full text-left rounded-[14px] border border-black/[0.06] bg-white/90 dark:bg-[hsl(var(--card))] p-3 space-y-2 hover:bg-black/[0.02] cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold font-mono tracking-tight text-[#0071e3]">{entry.ledgerNumber}</p>
                <p className="text-[11px] text-[#86868b] mt-0.5">{entry.transactionDate}{entry.dueDate ? ` · Due ${entry.dueDate}` : ""}</p>
              </div>
              <span className="inline-flex h-5 items-center rounded-full bg-[#f2f2f7] dark:bg-white/10 px-2 text-[10px] font-semibold text-[#6e6e73] shrink-0">
                {formatLinkModeLabel(entry.linkMode)}
              </span>
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

      <div className="hidden md:block rounded-[16px] border border-black/[0.06] overflow-hidden bg-white/90 dark:bg-[hsl(var(--card))] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
        <table className="w-full text-[12px] min-w-[1100px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-black/[0.06] bg-[#f5f5f7] dark:bg-[hsl(var(--muted))]">
              {[
                "Ledger No.", "Date", "Project / Supplier", "Supplier(s)", "Items",
                "Total", "Paid", "Due", "Due Date", "Payments", "",
              ].map(h => (
                <th key={h || "actions"} className="h-10 px-3 text-left text-[10px] font-semibold tracking-tight text-[#86868b] whitespace-nowrap first:pl-4 last:pr-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.045]">
            {loading && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-[#86868b]">Loading…</td></tr>
            )}
            {!loading && filterTransactionType === "petrol" && filteredPetrol.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-[#86868b]">
                No petrol allotments match. Open Petrol to allot fuel.
              </td></tr>
            )}
            {!loading && filterTransactionType === "petrol" && filteredPetrol.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer"
                onClick={() => { window.location.href = "/petrol" }}
              >
                <td className="px-2.5 py-2.5 font-semibold tracking-tight text-[#0071e3]">PETROL</td>
                <td className="px-2 py-2 whitespace-nowrap">{row.allottedAt.slice(0, 10)}</td>
                <td className="px-2 py-2">
                  <Badge variant="outline" className="text-[10px] w-fit border-amber-500/40 text-amber-700">
                    Petrol / fuel
                  </Badge>
                </td>
                <td className="px-2 py-2">{row.personName}</td>
                <td className="px-2 py-2 text-[hsl(var(--muted-foreground))]">
                  {row.vehicleName}{row.vehiclePlate ? ` · ${row.vehiclePlate}` : ""}
                </td>
                <td className="px-2 py-2 text-right font-medium">{fmtMoney(row.amountPkr)}</td>
                <td className="px-2 py-2 text-right text-emerald-600">{fmtMoney(row.amountPkr)}</td>
                <td className="px-2 py-2 text-right text-amber-600">{fmtMoney(0)}</td>
                <td className="px-2 py-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      row.status === "settled"
                        ? "border-emerald-500/40 text-emerald-700"
                        : row.status === "pending_review"
                          ? "border-sky-500/40 text-sky-700"
                          : "border-amber-500/40 text-amber-700"
                    }`}
                  >
                    {row.status === "pending_review" ? "pending review" : row.status}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-[hsl(var(--muted-foreground))]">{row.allottedBy || "—"}</td>
                <td className="px-2 py-2 text-[hsl(var(--muted-foreground))]">Open Petrol</td>
              </tr>
            ))}
            {!loading && filterTransactionType !== "petrol" && filtered.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-[#86868b]">
                {entries.length === 0 ? "No purchase entries yet. Click New to add one." : "No entries match your filters."}
              </td></tr>
            )}
            {filterTransactionType !== "petrol" && filtered.map(entry => (
              <tr
                key={entry.id}
                className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer"
                onClick={() => setDetailEntryId(entry.id)}
              >
                <td className="px-3 py-3 first:pl-4 font-semibold tracking-tight text-[#0071e3] font-mono">{entry.ledgerNumber}</td>
                <td className="px-3 py-3 whitespace-nowrap text-[#6e6e73]">{entry.transactionDate}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="inline-flex h-5 items-center rounded-full bg-[#f2f2f7] dark:bg-white/10 px-2 text-[10px] font-semibold text-[#6e6e73]">
                        {formatLinkModeLabel(entry.linkMode)}
                      </span>
                      {entry.transactionType === "rent" && (
                        <span className="inline-flex h-5 items-center rounded-full bg-[#ff9f0a]/15 px-2 text-[10px] font-semibold text-[#9a6700]">
                          {formatTransactionTypeLabel(entry.transactionType)}
                        </span>
                      )}
                    </div>
                    <span className="font-medium tracking-tight">{formatLedgerProject(entry)}</span>
                  </div>
                </td>
                <td className="px-2.5 py-2.5 tracking-tight">{formatLedgerSuppliers(entry)}</td>
                <td className="px-2.5 py-2.5 max-w-[180px]">
                  <p className="truncate" title={formatLedgerItemsSummary(entry)}>{formatLedgerItemsSummary(entry)}</p>
                  {entry.supplierGroups.length > 1 && (
                    <p className="text-[10px] text-[#86868b]">{entry.supplierGroups.length} suppliers</p>
                  )}
                  {entry.items.length > 1 && entry.supplierGroups.length <= 1 && (
                    <p className="text-[10px] text-[#86868b]">{entry.items.length} items</p>
                  )}
                </td>
                <td className="px-2.5 py-2.5 font-semibold tabular-nums">{fmtMoney(entry.totalAmount)}</td>
                <td className="px-2.5 py-2.5 text-[#248a3d] tabular-nums">{fmtMoney(entry.amountPaid)}</td>
                <td className="px-2.5 py-2.5 text-[#9a6700] font-semibold tabular-nums">{fmtMoney(entry.amountDue)}</td>
                <td className="px-2.5 py-2.5 whitespace-nowrap text-[#6e6e73]">{entry.dueDate || "—"}</td>
                <td className="px-2.5 py-2.5">
                  <div className="flex flex-col gap-1">
                    {getEntryBillLinks(entry).map(bill => (
                      <a
                        key={bill.url}
                        href={bill.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[#0071e3] hover:underline w-fit"
                      >
                        <Receipt className="h-3 w-3" strokeWidth={1.75} />
                        <span className="truncate max-w-[100px]">{bill.name}</span>
                      </a>
                    ))}
                    {entry.payments.map(p => (
                      <div key={p.id} className="flex items-center gap-1 tabular-nums">
                        <span>{fmtMoney(p.amount)}</span>
                        {p.proofUrl && (
                          <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-[#0071e3] hover:underline">
                            <FileText className="h-3 w-3" strokeWidth={1.75} />
                          </a>
                        )}
                      </div>
                    ))}
                    {entry.payments.length === 0 && entry.paymentProofUrl && (
                      <a href={entry.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#0071e3] hover:underline">
                        <FileText className="h-3 w-3" strokeWidth={1.75} /> Proof
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-2.5 py-2.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-0.5">
                    <button type="button" className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.05] hover:text-[#1d1d1f] cursor-pointer" title="Export Excel" onClick={() => exportEntryExcel(entry)}>
                      <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    <button type="button" className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.05] hover:text-[#1d1d1f] cursor-pointer" title="Export PDF" onClick={() => void exportEntryPdf(entry)}>
                      <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    <button type="button" className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.05] hover:text-[#1d1d1f] cursor-pointer" title="Edit" onClick={() => openEditForm(entry)}>
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    {entry.amountDue > 0 && (
                      <button
                        type="button"
                        className="h-7 inline-flex items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold bg-[#1d1d1f] text-white hover:bg-black cursor-pointer"
                        onClick={() => openPayModal(entry)}
                      >
                        <Wallet className="h-3 w-3" strokeWidth={1.75} /> Pay due
                      </button>
                    )}
                    <button type="button" className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 cursor-pointer" onClick={() => void handleDelete(entry.id)}>
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
