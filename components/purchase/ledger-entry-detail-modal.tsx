"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Receipt, CreditCard, FileText, Wallet, Pencil, Trash2, Download, FileSpreadsheet } from "lucide-react"
import {
  formatLedgerProject,
  formatLedgerSuppliers,
  formatLinkModeLabel,
  PURCHASE_TRANSACTION_TYPES,
  sumItemTotals,
  resolveGroupAmountPaid,
  resolveGroupAmountDue,
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
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-4xl max-h-[92vh] rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b shrink-0">
          <div className="h-11 w-11 rounded-lg border bg-[#1faca6]/10 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-[#1faca6]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold font-mono text-[#1faca6]">{entry.ledgerNumber}</h2>
              <Badge variant="outline" className="text-[10px]">{formatLinkModeLabel(entry.linkMode)}</Badge>
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
            <DetailCell label="Supplier(s)">{formatLedgerSuppliers(entry)}</DetailCell>
            <DetailCell label="Project / Supplier">{formatLedgerProject(entry)}</DetailCell>
            <DetailCell label="Transaction type">{transactionTypeLabel(entry.transactionType)}</DetailCell>
            <DetailCell label="Note">{entry.notes?.trim() || "—"}</DetailCell>
          </div>

          {(entry.linkMode === "project" && entry.supplierGroups.length > 0
            ? entry.supplierGroups
            : [{
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
              billAttachments: entry.supplierGroups[0]?.billAttachments
                || (entry.billUrl ? [{ url: entry.billUrl, name: entry.billName || "Bill" }] : []),
              paymentProofUrl: entry.paymentProofUrl,
              paymentProofName: entry.paymentProofName,
              paymentProofAttachments: entry.supplierGroups[0]?.paymentProofAttachments
                || (entry.paymentProofUrl
                  ? [{ url: entry.paymentProofUrl, name: entry.paymentProofName || "Payment proof" }]
                  : []),
            }] as PurchaseLedgerSupplierGroup[]
          ).map((group, groupIndex) => {
            const groupBills = billsForGroup(group)
            const groupProofs = proofsForGroup(entry, group)
            return (
            <section key={group.id} className="rounded-lg border overflow-hidden">
              <div className="px-3 py-2 border-b bg-[hsl(var(--muted))]/25">
                <p className="text-xs font-semibold">{group.supplierName || `Supplier ${groupIndex + 1}`}</p>
                {group.date ? (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Date {group.date}</p>
                ) : null}
                {group.accountDetails && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{group.accountDetails}</p>
                )}
              </div>
              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_72px_96px_108px] gap-2 px-3 py-1.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-b bg-[hsl(var(--muted))]/10">
                <span>Product</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Line total</span>
              </div>
              <ul className="divide-y">
                {group.items.map(item => (
                  <li key={item.id} className="grid grid-cols-12 sm:grid-cols-[minmax(0,1fr)_72px_96px_108px] gap-2 px-3 py-2 text-xs items-center">
                    <span className="col-span-12 sm:col-span-1 font-medium">{item.productName}</span>
                    <span className="col-span-4 sm:col-span-1 sm:text-right tabular-nums">{item.quantity}</span>
                    <span className="col-span-4 sm:col-span-1 sm:text-right tabular-nums">{fmtMoney(item.unitPrice)}</span>
                    <span className="col-span-4 sm:col-span-1 sm:text-right font-medium tabular-nums">{fmtMoney(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-end gap-2 px-3 py-2 border-t bg-[hsl(var(--muted))]/10">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Subtotal</span>
                <span className="text-sm font-semibold text-[#1faca6]">{fmtMoney(sumItemTotals(group.items))}</span>
              </div>
              {entry.linkMode === "project" && (
                <div className="grid grid-cols-2 gap-2 px-3 py-2 border-t bg-[hsl(var(--muted))]/5">
                  <div className="rounded-md border bg-[hsl(var(--card))] px-2.5 py-2 text-center">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Paid</p>
                    <p className="text-xs font-semibold mt-0.5 text-emerald-600">{fmtMoney(resolveGroupAmountPaid(group))}</p>
                  </div>
                  <div className="rounded-md border bg-[hsl(var(--card))] px-2.5 py-2 text-center">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Remaining</p>
                    <p className="text-xs font-semibold mt-0.5 text-amber-700 dark:text-amber-400">{fmtMoney(resolveGroupAmountDue(group))}</p>
                  </div>
                </div>
              )}
              {groupBills.length > 0 && (
                <div className="px-3 py-2.5 border-t bg-[hsl(var(--muted))]/5 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Purchase bill{groupBills.length > 1 ? "s" : ""}
                  </p>
                  {groupBills.map(bill => (
                    <div key={bill.url} className="space-y-2">
                      <a
                        href={bill.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#1faca6] hover:underline font-medium"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        {bill.name || "View purchase bill"}
                      </a>
                      {isImageBillUrl(bill.url) && (
                        <a href={bill.url} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={bill.url}
                            alt={bill.name || "Purchase bill"}
                            className="max-h-40 w-full rounded-md border object-contain bg-white"
                          />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {groupProofs.length > 0 && (
                <div className="px-3 py-2.5 border-t bg-[hsl(var(--muted))]/5 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Payment proof{groupProofs.length > 1 ? "s" : ""}
                  </p>
                  {groupProofs.map(proof => (
                    <div key={proof.url} className="space-y-2">
                      <a
                        href={proof.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#1faca6] hover:underline font-medium"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        {proof.name || "View payment proof"}
                      </a>
                      {isImageBillUrl(proof.url) && (
                        <a href={proof.url} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={proof.url}
                            alt={proof.name || "Payment proof"}
                            className="max-h-40 w-full rounded-md border object-contain bg-white"
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

          <div className="flex items-center justify-end gap-2 px-1">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Grand total</span>
            <span className="text-base font-semibold text-[#1faca6]">{fmtMoney(entry.totalAmount)}</span>
          </div>

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
              <FileText className="h-3.5 w-3.5 text-[#1faca6]" />
              <p className="text-xs font-semibold">Purchase bill</p>
            </div>
            {entry.linkMode === "project" && entry.supplierGroups.some(group =>
              Boolean(group.billUrl) || (group.billAttachments?.length || 0) > 0,
            ) ? (
              <p className="px-3 py-4 text-xs text-[hsl(var(--muted-foreground))]">
                Bills are attached per supplier above.
              </p>
            ) : (() => {
              const bills = normalizeAttachments(
                entry.supplierGroups[0]?.billAttachments,
                entry.billUrl,
                entry.billName,
              )
              if (bills.length === 0) {
                return (
                  <p className="px-3 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                    No bill attached.
                  </p>
                )
              }
              return (
                <div className="px-3 py-3 space-y-3">
                  {bills.map(bill => (
                    <div key={bill.url} className="space-y-2">
                      <a
                        href={bill.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#1faca6] hover:underline font-medium"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        {bill.name || "View purchase bill"}
                      </a>
                      {isImageBillUrl(bill.url) && (
                        <a href={bill.url} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={bill.url}
                            alt={bill.name || "Purchase bill"}
                            className="max-h-56 w-full rounded-md border object-contain bg-white"
                          />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
          </section>

          <section className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2 border-b bg-[hsl(var(--muted))]/25 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-[#1faca6]" />
              <p className="text-xs font-semibold">Payments</p>
            </div>
            {entry.payments.filter(p => (Number(p.amount) || 0) > 0).length === 0
              && !entry.paymentProofUrl
              && !entry.payments.some(p => p.proofUrl) ? (
              <p className="px-3 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {entry.payments
                  .filter(p => (Number(p.amount) || 0) > 0)
                  .map(p => (
                  <li key={p.id} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-emerald-600">{fmtMoney(p.amount)}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {p.date}
                        {p.supplierName && <> · {p.supplierName}</>}
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
                {entry.payments
                  .filter(p => (Number(p.amount) || 0) <= 0 && p.proofUrl)
                  .map(p => (
                    <li key={p.id} className="px-3 py-2.5">
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#1faca6] hover:underline">
                        <FileText className="h-3.5 w-3.5" /> {p.proofName || "Payment proof"}
                      </a>
                    </li>
                  ))}
                {entry.payments.filter(p => (Number(p.amount) || 0) > 0 || p.proofUrl).length === 0
                  && entry.paymentProofUrl && (
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
          {onExportExcel && (
            <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={onExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
          )}
          {onExportPdf && (
            <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={onExportPdf}>
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          )}
          {!readOnly && onEdit && (
            <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {!readOnly && entry.amountDue > 0 && onPayDue && (
            <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={onPayDue}>
              <Wallet className="h-3.5 w-3.5" /> Pay due
            </Button>
          )}
          {!readOnly && onDelete && (
            <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 cursor-pointer" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
