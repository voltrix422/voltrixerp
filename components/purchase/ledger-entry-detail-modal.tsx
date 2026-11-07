"use client"

import { createPortal } from "react-dom"
import {
  X,
  FileText,
  Wallet,
  Pencil,
  Trash2,
  Download,
  FileSpreadsheet,
} from "lucide-react"
import {
  formatLedgerProject,
  formatLedgerSuppliers,
  formatLinkModeLabel,
  PURCHASE_TRANSACTION_TYPES,
  sumItemTotals,
  resolveGroupAmountPaid,
  resolveGroupAmountDue,
  resolveGroupDiscount,
  getGroupNetTotal,
  sumGroupDiscounts,
  normalizeSupplierKey,
  normalizeAttachments,
  type PurchaseLedgerEntry,
  type PurchaseLedgerSupplierGroup,
  type PurchaseTransactionType,
} from "@/lib/purchase-ledger"
import { isImageBillUrl } from "@/lib/purchase-ledger-bill"

function fmtMoney(n: number) {
  return `Rs. ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
}

function transactionTypeLabel(value: PurchaseTransactionType) {
  return PURCHASE_TRANSACTION_TYPES.find((t) => t.value === value)?.label ?? value
}

function billsForGroup(group: PurchaseLedgerSupplierGroup) {
  return normalizeAttachments(group.billAttachments, group.billUrl, group.billName)
}

function proofsForGroup(entry: PurchaseLedgerEntry, group: PurchaseLedgerSupplierGroup) {
  const seen = new Set<string>()
  const proofs: { url: string; name: string }[] = []
  const push = (url?: string, name?: string) => {
    const clean = String(url || "").trim()
    if (!clean || seen.has(clean)) return
    seen.add(clean)
    proofs.push({ url: clean, name: name || "Payment proof" })
  }
  for (const att of normalizeAttachments(
    group.paymentProofAttachments,
    group.paymentProofUrl,
    group.paymentProofName,
  )) {
    push(att.url, att.name)
  }
  const groupName = normalizeSupplierKey(group.supplierName)
  const isSynthetic = group.id === "single"
  for (const payment of entry.payments) {
    if (!payment.proofUrl) continue
    if (isSynthetic) {
      push(payment.proofUrl, payment.proofName)
      continue
    }
    const matchId = payment.supplierGroupId === group.id
    const matchName = Boolean(groupName && normalizeSupplierKey(payment.supplierName) === groupName)
    if (matchId || matchName) push(payment.proofUrl, payment.proofName)
  }
  if (isSynthetic && entry.paymentProofUrl) {
    push(entry.paymentProofUrl, entry.paymentProofName)
  }
  return proofs
}

const pillBtn =
  "h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.04] cursor-pointer"
const primaryPill =
  "h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight bg-[#1d1d1f] hover:bg-black text-white cursor-pointer"

export function LedgerEntryDetailModal({
  entry,
  onClose,
  onEdit,
  onPayDue,
  onDelete,
  onExportExcel,
  onExportPdf,
  readOnly = false,
}: {
  entry: PurchaseLedgerEntry
  onClose: () => void
  onEdit?: () => void
  onPayDue?: () => void
  onDelete?: () => void
  onExportExcel?: () => void
  onExportPdf?: () => void
  readOnly?: boolean
}) {
  if (typeof document === "undefined") return null

  const isProject = entry.linkMode === "project" && entry.supplierGroups.length > 0
  const groups = isProject
    ? entry.supplierGroups
    : ([
        {
          id: "single",
          supplierId: entry.supplierId ?? null,
          supplierName: entry.supplierName,
          accountDetails: entry.accountDetails,
          items: entry.items,
          amountPaid: entry.amountPaid,
          amountDue: entry.amountDue,
          date: entry.transactionDate,
          billUrl: entry.billUrl,
          billName: entry.billName,
          billAttachments:
            entry.supplierGroups[0]?.billAttachments ||
            (entry.billUrl ? [{ url: entry.billUrl, name: entry.billName || "Bill" }] : []),
          paymentProofUrl: entry.paymentProofUrl,
          paymentProofName: entry.paymentProofName,
          paymentProofAttachments:
            entry.supplierGroups[0]?.paymentProofAttachments ||
            (entry.paymentProofUrl
              ? [{ url: entry.paymentProofUrl, name: entry.paymentProofName || "Payment proof" }]
              : []),
        },
      ] as PurchaseLedgerSupplierGroup[])

  const payments = entry.payments.filter((p) => (Number(p.amount) || 0) > 0 || p.proofUrl)

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-md p-0 sm:p-3"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-t-[18px] sm:rounded-[18px] border border-black/[0.06] bg-white dark:bg-[hsl(var(--card))] shadow-[0_16px_48px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-black/[0.06] shrink-0">
          <div className="min-w-0 space-y-1">
            <p className="text-[15px] font-semibold tracking-tight text-[#0071e3] font-mono">{entry.ledgerNumber}</p>
            <div className="flex flex-wrap items-center gap-1">
              <span className="h-5 inline-flex items-center rounded-full bg-[#f2f2f7] dark:bg-white/10 px-2 text-[10px] font-semibold text-[#6e6e73]">
                {formatLinkModeLabel(entry.linkMode)}
              </span>
              <span className="h-5 inline-flex items-center rounded-full bg-[#f2f2f7] dark:bg-white/10 px-2 text-[10px] font-semibold text-[#6e6e73]">
                {transactionTypeLabel(entry.transactionType)}
              </span>
            </div>
            <p className="text-[11px] text-[#86868b]">
              {entry.transactionDate}
              {entry.createdBy ? ` · ${entry.createdBy}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
            <div className="space-y-2.5 min-w-0">
              <div className="rounded-[12px] border border-black/[0.06] bg-[#f5f5f7]/80 dark:bg-white/[0.03] p-2.5 grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#86868b]">Supplier</p>
                  <p className="text-[12px] font-medium tracking-tight truncate">{formatLedgerSuppliers(entry)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#86868b]">Project</p>
                  <p className="text-[12px] font-medium tracking-tight truncate">{formatLedgerProject(entry)}</p>
                </div>
                {entry.notes?.trim() ? (
                  <div className="col-span-2 min-w-0">
                    <p className="text-[10px] font-semibold text-[#86868b]">Note</p>
                    <p className="text-[12px] font-medium tracking-tight">{entry.notes}</p>
                  </div>
                ) : null}
              </div>

              {groups.map((group, groupIndex) => {
                const groupBills = billsForGroup(group)
                const groupProofs = proofsForGroup(entry, group)
                return (
                  <section
                    key={group.id}
                    className="rounded-[12px] border border-black/[0.06] overflow-hidden bg-white dark:bg-white/[0.02]"
                  >
                    <div className="px-3 py-2 border-b border-black/[0.06] bg-[#fafafa]/90">
                      <p className="text-[12px] font-semibold tracking-tight">
                        {group.supplierName || `Supplier ${groupIndex + 1}`}
                      </p>
                      <p className="text-[10px] text-[#86868b] mt-0.5">
                        {[group.date || entry.transactionDate, group.accountDetails].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_52px_72px_84px] gap-2 px-3 py-1 text-[9px] font-semibold text-[#86868b] border-b border-black/[0.04]">
                      <span>Product</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Unit</span>
                      <span className="text-right">Total</span>
                    </div>
                    <ul className="divide-y divide-black/[0.04]">
                      {group.items.map((item) => (
                        <li
                          key={item.id}
                          className="grid grid-cols-12 sm:grid-cols-[minmax(0,1fr)_52px_72px_84px] gap-2 px-3 py-1.5 text-[12px] items-center"
                        >
                          <span className="col-span-12 sm:col-span-1 font-medium tracking-tight truncate">
                            {item.productName}
                          </span>
                          <span className="col-span-4 sm:col-span-1 sm:text-right tabular-nums text-[#6e6e73]">
                            {item.quantity}
                          </span>
                          <span className="col-span-4 sm:col-span-1 sm:text-right tabular-nums text-[#6e6e73]">
                            {fmtMoney(item.unitPrice)}
                          </span>
                          <span className="col-span-4 sm:col-span-1 sm:text-right font-semibold tabular-nums">
                            {fmtMoney(item.lineTotal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-t border-black/[0.04] bg-[#fafafa]/70">
                      <span className="text-[10px] font-semibold text-[#86868b]">Subtotal</span>
                      <span className="text-[12px] font-semibold text-[#0071e3] tabular-nums">
                        {fmtMoney(sumItemTotals(group.items))}
                      </span>
                    </div>
                    {resolveGroupDiscount(group) > 0 && (
                      <div className="flex items-center justify-between px-3 py-1.5 border-t border-black/[0.04] text-[12px]">
                        <span className="text-[#86868b]">Discount</span>
                        <span className="font-semibold text-[#9a6700] tabular-nums">
                          −{fmtMoney(resolveGroupDiscount(group))} → {fmtMoney(getGroupNetTotal(group))}
                        </span>
                      </div>
                    )}
                    {isProject && (
                      <div className="grid grid-cols-2 gap-1.5 px-3 py-2 border-t border-black/[0.04]">
                        <div className="rounded-[9px] bg-[#f2f2f7]/90 px-2 py-1.5 text-center">
                          <p className="text-[9px] text-[#86868b]">Paid</p>
                          <p className="text-[11px] font-semibold text-[#248a3d] tabular-nums">
                            {fmtMoney(resolveGroupAmountPaid(group))}
                          </p>
                        </div>
                        <div className="rounded-[9px] bg-[#f2f2f7]/90 px-2 py-1.5 text-center">
                          <p className="text-[9px] text-[#86868b]">Due</p>
                          <p className="text-[11px] font-semibold text-[#9a6700] tabular-nums">
                            {fmtMoney(resolveGroupAmountDue(group))}
                          </p>
                        </div>
                      </div>
                    )}
                    {(groupBills.length > 0 || groupProofs.length > 0) && (
                      <div className="px-3 py-2 border-t border-black/[0.04] space-y-1.5">
                        {groupBills.map((bill) => (
                          <div key={bill.url} className="flex items-center gap-2 min-w-0">
                            {isImageBillUrl(bill.url) ? (
                              <a href={bill.url} target="_blank" rel="noreferrer" className="shrink-0">
                                <img
                                  src={bill.url}
                                  alt=""
                                  className="h-8 w-8 rounded object-cover border border-black/[0.06] bg-white"
                                />
                              </a>
                            ) : (
                              <FileText className="h-3.5 w-3.5 text-[#0071e3] shrink-0" strokeWidth={1.75} />
                            )}
                            <a
                              href={bill.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#0071e3] hover:underline truncate font-medium"
                            >
                              {bill.name || "Bill"}
                            </a>
                          </div>
                        ))}
                        {groupProofs.map((proof) => (
                          <a
                            key={proof.url}
                            href={proof.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-[11px] text-[#0071e3] hover:underline font-medium"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                            {proof.name || "Proof"}
                          </a>
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>

            <div className="space-y-2.5 min-w-0">
              <div className="rounded-[12px] border border-black/[0.06] bg-[#f5f5f7]/80 dark:bg-white/[0.03] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#86868b]">Items</span>
                  <span className="font-medium tabular-nums">
                    {fmtMoney(
                      entry.items.length > 0
                        ? sumItemTotals(entry.items)
                        : Math.max(
                            0,
                            entry.totalAmount -
                              (entry.taxAmount || 0) +
                              (entry.supplierDiscount || sumGroupDiscounts(entry.supplierGroups) || 0),
                          ),
                    )}
                  </span>
                </div>
                {(entry.taxAmount > 0 || entry.taxPercent > 0) && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#86868b]">Tax{entry.taxPercent > 0 ? ` (${entry.taxPercent}%)` : ""}</span>
                    <span className="font-medium tabular-nums">{fmtMoney(entry.taxAmount || 0)}</span>
                  </div>
                )}
                {(entry.supplierDiscount > 0 || sumGroupDiscounts(entry.supplierGroups) > 0) && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#86868b]">Discount</span>
                    <span className="font-medium tabular-nums text-[#9a6700]">
                      −{fmtMoney(entry.supplierDiscount || sumGroupDiscounts(entry.supplierGroups))}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-black/[0.06] pt-1.5">
                  <span className="text-[11px] font-semibold">Grand total</span>
                  <span className="text-[15px] font-semibold text-[#0071e3] tabular-nums">
                    {fmtMoney(entry.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="rounded-[12px] border border-black/[0.06] bg-[#f5f5f7]/80 dark:bg-white/[0.03] p-2.5">
                <p className="text-[10px] font-semibold text-[#86868b] mb-1.5">Payment</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="rounded-[10px] bg-white/90 dark:bg-white/[0.04] border border-black/[0.04] px-2 py-1.5 text-center">
                    <p className="text-[9px] text-[#86868b]">Total</p>
                    <p className="text-[11px] font-semibold tabular-nums">{fmtMoney(entry.totalAmount)}</p>
                  </div>
                  <div className="rounded-[10px] bg-white/90 dark:bg-white/[0.04] border border-black/[0.04] px-2 py-1.5 text-center">
                    <p className="text-[9px] text-[#86868b]">Paid</p>
                    <p className="text-[11px] font-semibold tabular-nums text-[#248a3d]">{fmtMoney(entry.amountPaid)}</p>
                  </div>
                  <div className="rounded-[10px] bg-white/90 dark:bg-white/[0.04] border border-black/[0.04] px-2 py-1.5 text-center">
                    <p className="text-[9px] text-[#86868b]">Due</p>
                    <p className="text-[11px] font-semibold tabular-nums text-[#9a6700]">{fmtMoney(entry.amountDue)}</p>
                  </div>
                </div>
              </div>

              <section className="rounded-[12px] border border-black/[0.06] overflow-hidden">
                <div className="px-3 py-1.5 border-b border-black/[0.06] bg-[#fafafa]/90">
                  <p className="text-[11px] font-semibold tracking-tight">Payments</p>
                </div>
                {payments.length === 0 && !entry.paymentProofUrl ? (
                  <p className="px-3 py-4 text-center text-[11px] text-[#86868b]">No payments yet.</p>
                ) : (
                  <ul className="divide-y divide-black/[0.04]">
                    {payments.map((p) => (
                      <li key={p.id} className="px-3 py-2 flex items-center justify-between gap-2 text-[12px]">
                        <div className="min-w-0">
                          {(Number(p.amount) || 0) > 0 ? (
                            <p className="font-semibold text-[#248a3d] tabular-nums">{fmtMoney(p.amount)}</p>
                          ) : null}
                          <p className="text-[10px] text-[#86868b] truncate">
                            {[p.date, p.supplierName, p.notes].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {p.proofUrl ? (
                          <a
                            href={p.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#0071e3] hover:underline shrink-0 text-[11px] font-medium"
                          >
                            Proof
                          </a>
                        ) : null}
                      </li>
                    ))}
                    {payments.length === 0 && entry.paymentProofUrl ? (
                      <li className="px-3 py-2">
                        <a
                          href={entry.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#0071e3] hover:underline font-medium"
                        >
                          <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {entry.paymentProofName || "Payment proof"}
                        </a>
                      </li>
                    ) : null}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-t border-black/[0.06] shrink-0 bg-[#fafafa]/90">
          {onExportExcel && (
            <button type="button" className={pillBtn} onClick={onExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} /> Excel
            </button>
          )}
          {onExportPdf && (
            <button type="button" className={pillBtn} onClick={onExportPdf}>
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> PDF
            </button>
          )}
          {!readOnly && onEdit && (
            <button type="button" className={pillBtn} onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /> Edit
            </button>
          )}
          {!readOnly && entry.amountDue > 0 && onPayDue && (
            <button type="button" className={primaryPill} onClick={onPayDue}>
              <Wallet className="h-3.5 w-3.5" strokeWidth={1.75} /> Pay due
            </button>
          )}
          {!readOnly && onDelete && (
            <button type="button" className={`${pillBtn} text-[#ff3b30] border-[#ff3b30]/20`} onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Delete
            </button>
          )}
          <button type="button" className={`${pillBtn} ml-auto`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
