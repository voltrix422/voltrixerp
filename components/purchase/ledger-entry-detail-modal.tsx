"use client"

import { createPortal } from "react-dom"
import {
  X,
  Receipt,
  CreditCard,
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

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">{label}</p>
      <div className="text-[13px] font-medium tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] break-words">
        {children}
      </div>
    </div>
  )
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
  "h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.04] cursor-pointer disabled:opacity-40"
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

  const groups =
    entry.linkMode === "project" && entry.supplierGroups.length > 0
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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xl p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-5xl max-h-[94vh] sm:max-h-[92vh] rounded-t-[20px] sm:rounded-[20px] border border-black/[0.06] bg-white/95 dark:bg-[hsl(var(--card))] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-black/[0.06] shrink-0 bg-white/70 dark:bg-[hsl(var(--card))]/80">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[15px] sm:text-[17px] font-semibold tracking-tight text-[#0071e3] font-mono truncate">
              {entry.ledgerNumber}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex h-5 items-center rounded-full bg-[#f2f2f7] dark:bg-white/10 px-2 text-[10px] font-semibold tracking-tight text-[#6e6e73]">
                {formatLinkModeLabel(entry.linkMode)}
              </span>
              <span className="inline-flex h-5 items-center rounded-full bg-[#f2f2f7] dark:bg-white/10 px-2 text-[10px] font-semibold tracking-tight text-[#6e6e73]">
                {transactionTypeLabel(entry.transactionType)}
              </span>
            </div>
            <p className="text-[11px] text-[#86868b]">
              {entry.transactionDate}
              {entry.dueDate ? ` · Due ${entry.dueDate}` : ""}
              {entry.createdBy ? ` · ${entry.createdBy}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 lg:gap-5">
            <div className="min-w-0 space-y-3">
              <div className="rounded-[14px] border border-black/[0.06] bg-[#f5f5f7]/80 dark:bg-white/[0.03] p-3 grid grid-cols-2 gap-3">
                <Meta label="Supplier(s)">{formatLedgerSuppliers(entry)}</Meta>
                <Meta label="Project / Supplier">{formatLedgerProject(entry)}</Meta>
                <Meta label="Type">{transactionTypeLabel(entry.transactionType)}</Meta>
                <Meta label="Note">{entry.notes?.trim() || "—"}</Meta>
              </div>

              {groups.map((group, groupIndex) => {
                const groupBills = billsForGroup(group)
                const groupProofs = proofsForGroup(entry, group)
                return (
                  <section
                    key={group.id}
                    className="rounded-[14px] border border-black/[0.06] overflow-hidden bg-white/70 dark:bg-white/[0.02]"
                  >
                    <div className="px-3.5 py-2.5 border-b border-black/[0.06] bg-[#fafafa]/90 dark:bg-white/[0.03]">
                      <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                        {group.supplierName || `Supplier ${groupIndex + 1}`}
                      </p>
                      {group.date ? (
                        <p className="text-[11px] text-[#86868b] mt-0.5">Date {group.date}</p>
                      ) : null}
                      {group.accountDetails ? (
                        <p className="text-[11px] text-[#86868b] mt-0.5">{group.accountDetails}</p>
                      ) : null}
                    </div>

                    <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_64px_88px_96px] gap-2 px-3.5 py-1.5 text-[10px] font-semibold tracking-tight text-[#86868b] border-b border-black/[0.04]">
                      <span>Product</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Unit</span>
                      <span className="text-right">Total</span>
                    </div>
                    <ul className="divide-y divide-black/[0.04]">
                      {group.items.map((item) => (
                        <li
                          key={item.id}
                          className="grid grid-cols-12 sm:grid-cols-[minmax(0,1fr)_64px_88px_96px] gap-2 px-3.5 py-2 text-[12px] items-center"
                        >
                          <span className="col-span-12 sm:col-span-1 font-medium tracking-tight">
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

                    <div className="flex items-center justify-end gap-2 px-3.5 py-2 border-t border-black/[0.04] bg-[#fafafa]/70">
                      <span className="text-[10px] font-semibold text-[#86868b]">Subtotal</span>
                      <span className="text-[13px] font-semibold tabular-nums text-[#0071e3]">
                        {fmtMoney(sumItemTotals(group.items))}
                      </span>
                    </div>

                    {resolveGroupDiscount(group) > 0 && (
                      <>
                        <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-black/[0.04]">
                          <span className="text-[11px] text-[#86868b]">Supplier discount</span>
                          <span className="text-[13px] font-semibold tabular-nums text-[#9a6700]">
                            −{fmtMoney(resolveGroupDiscount(group))}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-3.5 py-1.5 border-t border-black/[0.04]">
                          <span className="text-[10px] text-[#86868b]">After discount</span>
                          <span className="text-[13px] font-semibold text-[#0071e3]">
                            {fmtMoney(getGroupNetTotal(group))}
                          </span>
                        </div>
                      </>
                    )}

                    {entry.linkMode === "project" && (
                      <div className="grid grid-cols-2 gap-2 px-3.5 py-2.5 border-t border-black/[0.04]">
                        <div className="rounded-[12px] bg-[#f2f2f7]/90 dark:bg-white/[0.04] px-2.5 py-2 text-center">
                          <p className="text-[10px] text-[#86868b]">Paid</p>
                          <p className="text-[12px] font-semibold mt-0.5 text-[#248a3d]">
                            {fmtMoney(resolveGroupAmountPaid(group))}
                          </p>
                        </div>
                        <div className="rounded-[12px] bg-[#f2f2f7]/90 dark:bg-white/[0.04] px-2.5 py-2 text-center">
                          <p className="text-[10px] text-[#86868b]">Remaining</p>
                          <p className="text-[12px] font-semibold mt-0.5 text-[#9a6700]">
                            {fmtMoney(resolveGroupAmountDue(group))}
                          </p>
                        </div>
                      </div>
                    )}

                    {groupBills.length > 0 && (
                      <div className="px-3.5 py-2.5 border-t border-black/[0.04] space-y-2">
                        <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">
                          Purchase bill{groupBills.length > 1 ? "s" : ""}
                        </p>
                        {groupBills.map((bill) => (
                          <div key={bill.url} className="space-y-2">
                            <a
                              href={bill.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-[12px] text-[#0071e3] hover:underline font-medium"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                              {bill.name || "View bill"}
                            </a>
                            {isImageBillUrl(bill.url) && (
                              <a href={bill.url} target="_blank" rel="noreferrer" className="block">
                                <img
                                  src={bill.url}
                                  alt={bill.name || "Purchase bill"}
                                  className="max-h-36 w-full rounded-[12px] border border-black/[0.06] object-contain bg-white"
                                />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {groupProofs.length > 0 && (
                      <div className="px-3.5 py-2.5 border-t border-black/[0.04] space-y-2">
                        <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">
                          Payment proof{groupProofs.length > 1 ? "s" : ""}
                        </p>
                        {groupProofs.map((proof) => (
                          <div key={proof.url} className="space-y-2">
                            <a
                              href={proof.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-[12px] text-[#0071e3] hover:underline font-medium"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                              {proof.name || "View proof"}
                            </a>
                            {isImageBillUrl(proof.url) && (
                              <a href={proof.url} target="_blank" rel="noreferrer" className="block">
                                <img
                                  src={proof.url}
                                  alt={proof.name || "Payment proof"}
                                  className="max-h-36 w-full rounded-[12px] border border-black/[0.06] object-contain bg-white"
                                />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>

            <div className="min-w-0 space-y-3">
              <div className="rounded-[14px] border border-black/[0.06] bg-[#f5f5f7]/80 dark:bg-white/[0.03] p-3.5 space-y-2">
                <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">Totals</p>
                <div className="flex items-center justify-between gap-2 text-[12px]">
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
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-[#86868b]">
                      Tax{entry.taxPercent > 0 ? ` (${entry.taxPercent}%)` : ""}
                    </span>
                    <span className="font-medium tabular-nums">{fmtMoney(entry.taxAmount || 0)}</span>
                  </div>
                )}
                {(entry.supplierDiscount > 0 || sumGroupDiscounts(entry.supplierGroups) > 0) && (
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-[#86868b]">Discount</span>
                    <span className="font-medium tabular-nums text-[#9a6700]">
                      −{fmtMoney(entry.supplierDiscount || sumGroupDiscounts(entry.supplierGroups))}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] pt-2">
                  <span className="text-[11px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    Grand total
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-[#0071e3]">
                    {fmtMoney(entry.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="rounded-[14px] border border-black/[0.06] bg-[#f5f5f7]/80 dark:bg-white/[0.03] p-3.5">
                <p className="text-[10px] font-semibold tracking-tight text-[#86868b] mb-2">Payment</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[12px] bg-white/80 dark:bg-white/[0.04] px-2 py-2 text-center border border-black/[0.04]">
                    <p className="text-[10px] text-[#86868b]">Total</p>
                    <p className="text-[12px] font-semibold mt-0.5 tabular-nums">{fmtMoney(entry.totalAmount)}</p>
                  </div>
                  <div className="rounded-[12px] bg-white/80 dark:bg-white/[0.04] px-2 py-2 text-center border border-black/[0.04]">
                    <p className="text-[10px] text-[#86868b]">Paid</p>
                    <p className="text-[12px] font-semibold mt-0.5 tabular-nums text-[#248a3d]">
                      {fmtMoney(entry.amountPaid)}
                    </p>
                  </div>
                  <div className="rounded-[12px] bg-white/80 dark:bg-white/[0.04] px-2 py-2 text-center border border-black/[0.04]">
                    <p className="text-[10px] text-[#86868b]">Due</p>
                    <p className="text-[12px] font-semibold mt-0.5 tabular-nums text-[#9a6700]">
                      {fmtMoney(entry.amountDue)}
                    </p>
                  </div>
                </div>
              </div>

              <section className="rounded-[14px] border border-black/[0.06] overflow-hidden">
                <div className="px-3.5 py-2 border-b border-black/[0.06] bg-[#fafafa]/90 flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-[#0071e3]" strokeWidth={1.75} />
                  <p className="text-[12px] font-semibold tracking-tight">Purchase bill</p>
                </div>
                {entry.linkMode === "project" &&
                entry.supplierGroups.some(
                  (group) => Boolean(group.billUrl) || (group.billAttachments?.length || 0) > 0,
                ) ? (
                  <p className="px-3.5 py-4 text-[12px] text-[#86868b]">Bills are attached per supplier.</p>
                ) : (
                  (() => {
                    const bills = normalizeAttachments(
                      entry.supplierGroups[0]?.billAttachments,
                      entry.billUrl,
                      entry.billName,
                    )
                    if (bills.length === 0) {
                      return (
                        <p className="px-3.5 py-6 text-center text-[12px] text-[#86868b]">No bill attached.</p>
                      )
                    }
                    return (
                      <div className="px-3.5 py-3 space-y-3">
                        {bills.map((bill) => (
                          <div key={bill.url} className="space-y-2">
                            <a
                              href={bill.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-[12px] text-[#0071e3] hover:underline font-medium"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                              {bill.name || "View bill"}
                            </a>
                            {isImageBillUrl(bill.url) && (
                              <a href={bill.url} target="_blank" rel="noreferrer" className="block">
                                <img
                                  src={bill.url}
                                  alt={bill.name || "Purchase bill"}
                                  className="max-h-48 w-full rounded-[12px] border border-black/[0.06] object-contain bg-white"
                                />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()
                )}
              </section>

              <section className="rounded-[14px] border border-black/[0.06] overflow-hidden">
                <div className="px-3.5 py-2 border-b border-black/[0.06] bg-[#fafafa]/90 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-[#0071e3]" strokeWidth={1.75} />
                  <p className="text-[12px] font-semibold tracking-tight">Payments</p>
                </div>
                {entry.payments.filter((p) => (Number(p.amount) || 0) > 0).length === 0 &&
                !entry.paymentProofUrl &&
                !entry.payments.some((p) => p.proofUrl) ? (
                  <p className="px-3.5 py-6 text-center text-[12px] text-[#86868b]">No payments yet.</p>
                ) : (
                  <ul className="divide-y divide-black/[0.04]">
                    {entry.payments
                      .filter((p) => (Number(p.amount) || 0) > 0)
                      .map((p) => (
                        <li
                          key={p.id}
                          className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px]"
                        >
                          <div>
                            <p className="font-semibold text-[#248a3d] tabular-nums">{fmtMoney(p.amount)}</p>
                            <p className="text-[11px] text-[#86868b]">
                              {p.date}
                              {p.supplierName ? ` · ${p.supplierName}` : ""}
                              {p.notes ? ` · ${p.notes}` : ""}
                            </p>
                          </div>
                          {p.proofUrl && (
                            <a
                              href={p.proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#0071e3] hover:underline shrink-0"
                            >
                              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} /> Proof
                            </a>
                          )}
                        </li>
                      ))}
                    {entry.payments
                      .filter((p) => (Number(p.amount) || 0) <= 0 && p.proofUrl)
                      .map((p) => (
                        <li key={p.id} className="px-3.5 py-2.5">
                          <a
                            href={p.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] text-[#0071e3] hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                            {p.proofName || "Payment proof"}
                          </a>
                        </li>
                      ))}
                    {entry.payments.filter((p) => (Number(p.amount) || 0) > 0 || p.proofUrl).length === 0 &&
                      entry.paymentProofUrl && (
                        <li className="px-3.5 py-2.5">
                          <a
                            href={entry.paymentProofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] text-[#0071e3] hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                            {entry.paymentProofName || "Payment proof"}
                          </a>
                        </li>
                      )}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 px-4 sm:px-5 py-3 border-t border-black/[0.06] shrink-0 bg-[#fafafa]/90 dark:bg-[hsl(var(--muted))]/20">
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
            <button
              type="button"
              className={`${pillBtn} text-[#ff3b30] border-[#ff3b30]/20`}
              onClick={onDelete}
            >
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
