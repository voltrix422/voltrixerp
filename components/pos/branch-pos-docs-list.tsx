"use client"

import { useMemo, useState } from "react"
import {
  deleteOrder,
  getOrderAmountPaid,
  getOrderCreditBalance,
  hasOutstandingCredit,
  normalizeOrderPaymentTerms,
  saveOrder,
  type Order,
  type OrderPayment,
} from "@/lib/orders"
import { deleteQuotation, saveQuotation, type Quotation } from "@/lib/quotations"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useDialog } from "@/components/ui/dialog-provider"
import { uploadFiles } from "@/lib/upload"
import {
  CheckCircle2,
  DollarSign,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Truck,
  X,
} from "lucide-react"

type DocKind = "order" | "quotation"
type CreditFilter = "all" | "credit" | "paid"

const PAYMENT_METHODS = ["Cash", "Bank transfer", "Card", "JazzCash", "EasyPaisa", "Other"] as const

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Converted",
}

const QUOTATION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  pending_approval: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-gray-50 text-gray-500 border-gray-200",
  converted: "bg-violet-50 text-violet-700 border-violet-200",
}

function formatPkr(n: number) {
  return `PKR ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function DocDetailModal({
  kind,
  doc,
  busy,
  onClose,
  onDeliver,
  onDelete,
  onSaved,
  userName,
}: {
  kind: DocKind
  doc: Order | Quotation
  busy?: boolean
  onClose: () => void
  onDeliver?: () => void
  onDelete?: () => void
  onSaved?: (order: Order) => void
  userName: string
}) {
  const { toast } = useToast()
  const number = kind === "order" ? (doc as Order).orderNumber : (doc as Quotation).quotationNumber
  const title = kind === "order" ? "Order details" : "Quotation details"
  const order = kind === "order" ? (doc as Order) : null

  const [editing, setEditing] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [saving, setSaving] = useState(false)

  const [deliveryAddress, setDeliveryAddress] = useState(order?.deliveryAddress || doc.deliveryAddress || "")
  const [deliveryDate, setDeliveryDate] = useState(order?.deliveryDate || "")
  const [notes, setNotes] = useState(doc.notes || "")
  const [clientName, setClientName] = useState(doc.clientName || "")

  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState<string>("Cash")
  const [payNotes, setPayNotes] = useState("")
  const [payFiles, setPayFiles] = useState<File[]>([])

  const paid = order ? getOrderAmountPaid(order) : 0
  const debt = order ? getOrderCreditBalance(order) : 0
  const onCredit = order ? hasOutstandingCredit(order) : false

  async function handleSaveEdit() {
    if (!order) return
    setSaving(true)
    try {
      const updated = await saveOrder({
        ...order,
        clientName: clientName.trim() || order.clientName,
        deliveryAddress: deliveryAddress.trim(),
        deliveryDate,
        notes,
      })
      toast({ type: "success", title: "Order updated" })
      setEditing(false)
      onSaved?.(updated)
    } catch (err) {
      toast({ type: "error", title: "Could not save", message: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPayment() {
    if (!order) return
    const amount = Math.max(0, Number(payAmount) || 0)
    if (amount <= 0 && payFiles.length === 0) {
      toast({ type: "error", title: "Enter a payment amount or attach a proof" })
      return
    }
    setSaving(true)
    try {
      let proofUrls: string[] = []
      if (payFiles.length > 0) {
        proofUrls = await uploadFiles(payFiles, "payment-proofs")
      }
      const payment: OrderPayment = {
        id: `pay-${Date.now()}`,
        amount,
        method: payMethod,
        date: new Date().toISOString().slice(0, 10),
        notes: payNotes.trim() || "POS payment",
        proofUrls: proofUrls.length ? proofUrls : undefined,
        proofUrl: proofUrls[0],
        submissionStatus: "approved",
        createdAt: new Date().toISOString(),
        createdBy: userName,
      }
      const nextPayments = [...(order.payments || []), payment]
      let updated: Order = {
        ...order,
        payments: nextPayments,
        status: order.status === "draft" || order.status === "confirmed" ? "payment_added" : order.status,
      }
      const dueAfter = getOrderCreditBalance(updated)
      if (dueAfter <= 0.004) {
        updated = {
          ...updated,
          paymentTerms: "full",
          creditNote: order.creditNote,
        }
      } else {
        updated = {
          ...updated,
          paymentTerms: "credit",
          creditApprovedAt: order.creditApprovedAt || new Date().toISOString(),
          creditApprovedBy: order.creditApprovedBy || userName,
        }
      }
      updated = normalizeOrderPaymentTerms(updated)
      const saved = await saveOrder(updated)
      toast({ type: "success", title: "Payment added" })
      setAddingPayment(false)
      setPayAmount(0)
      setPayNotes("")
      setPayFiles([])
      onSaved?.(saved)
    } catch (err) {
      toast({ type: "error", title: "Could not add payment", message: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[92dvh] overflow-hidden rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs font-mono text-[#1faca6] mt-0.5">{number}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={busy || saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4 flex-1 min-h-0">
          {order && onCredit && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              On credit — due {formatPkr(debt)}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Client</p>
              {editing ? (
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1 w-full h-9 rounded-md border px-2 text-sm" />
              ) : (
                <p className="font-medium mt-0.5">{doc.clientName || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Status</p>
              <div className="mt-1">
                {kind === "order" ? (
                  <OrderStatusBadge status={(doc as Order).status} />
                ) : (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium ${
                      QUOTATION_STATUS_COLORS[(doc as Quotation).status] || ""
                    }`}
                  >
                    {QUOTATION_STATUS_LABELS[(doc as Quotation).status] || (doc as Quotation).status}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Created</p>
              <p className="mt-0.5">{new Date(doc.createdAt).toLocaleString("en-PK")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Total</p>
              <p className="font-semibold mt-0.5 tabular-nums">{formatPkr(doc.total)}</p>
            </div>
            {order && (
              <>
                <div>
                  <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Paid</p>
                  <p className="font-medium mt-0.5 tabular-nums text-emerald-700">{formatPkr(paid)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">On credit / due</p>
                  <p className="font-medium mt-0.5 tabular-nums text-amber-700">{formatPkr(debt)}</p>
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Delivery address</p>
              {editing ? (
                <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="mt-1 w-full h-9 rounded-md border px-2 text-sm" />
              ) : (
                <p className="mt-0.5">{doc.deliveryAddress || "—"}</p>
              )}
            </div>
            {kind === "order" && (
              <div>
                <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Delivery date</p>
                {editing ? (
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1 w-full h-9 rounded-md border px-2 text-sm" />
                ) : (
                  <p className="mt-0.5">{order?.deliveryDate || "—"}</p>
                )}
              </div>
            )}
            {kind === "quotation" && (doc as Quotation).validUntil && (
              <div>
                <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Valid until</p>
                <p className="mt-0.5">{(doc as Quotation).validUntil}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Notes</p>
              {editing ? (
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full h-9 rounded-md border px-2 text-sm" />
              ) : (
                <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{doc.notes || "—"}</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase font-semibold text-[hsl(var(--muted-foreground))] mb-2">Items</p>
            <CrmLineItemsDisplay items={doc.items} />
          </div>

          {order && (order.payments?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] uppercase font-semibold text-[hsl(var(--muted-foreground))] mb-2">Payments</p>
              <ul className="space-y-2">
                {order.payments!.map((p) => (
                  <li key={p.id} className="rounded-md border px-3 py-2 text-xs space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium capitalize">{p.method || "Payment"}</span>
                      <span className="tabular-nums font-semibold">{formatPkr(p.amount)}</span>
                    </div>
                    <p className="text-[hsl(var(--muted-foreground))]">{p.date} · {p.createdBy}</p>
                    {p.notes && <p>{p.notes}</p>}
                    {(p.proofUrls?.length || p.proofUrl) && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(p.proofUrls?.length ? p.proofUrls : p.proofUrl ? [p.proofUrl] : []).map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[#1faca6] underline">
                            View attachment
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {addingPayment && order && (
            <div className="rounded-lg border p-3 space-y-3 bg-[hsl(var(--muted))]/10">
              <p className="text-xs font-semibold">Add payment</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Amount (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    value={payAmount || ""}
                    onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                    className="w-full h-9 rounded-md border px-2 text-sm"
                    placeholder={String(Math.round(debt || order.total))}
                  />
                  <button type="button" className="text-[10px] text-[#1faca6] underline" onClick={() => setPayAmount(Math.round(debt || order.total))}>
                    Pay full due
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Method</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full h-9 rounded-md border px-2 text-sm bg-[hsl(var(--background))]">
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Payment notes"
                className="w-full h-9 rounded-md border px-2 text-sm"
              />
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => setPayFiles(Array.from(e.target.files || []))}
                className="w-full text-xs"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white" disabled={saving} onClick={() => void handleAddPayment()}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
                  Save payment
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={saving} onClick={() => setAddingPayment(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-3 border-t shrink-0 bg-[hsl(var(--muted))]/10">
          {kind === "order" && order && !editing && !addingPayment && (
            <>
              <Button type="button" size="sm" variant="outline" className="h-9 text-xs" disabled={busy || saving} onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-9 text-xs" disabled={busy || saving} onClick={() => setAddingPayment(true)}>
                <DollarSign className="h-3.5 w-3.5" /> Add payment
              </Button>
              {order.status !== "delivered" && order.status !== "cancelled" && onDeliver && (
                <Button type="button" size="sm" className="h-9 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white" disabled={busy || saving} onClick={onDeliver}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                  Mark delivered
                </Button>
              )}
            </>
          )}
          {editing && (
            <>
              <Button type="button" size="sm" className="h-9 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white" disabled={saving} onClick={() => void handleSaveEdit()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save changes
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-9 text-xs" disabled={saving} onClick={() => setEditing(false)}>
                Cancel edit
              </Button>
            </>
          )}
          {onDelete && !editing && !addingPayment && (
            <Button type="button" size="sm" variant="ghost" className="h-9 text-xs text-red-600" disabled={busy || saving} onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" className="h-9 text-xs ml-auto" disabled={busy || saving} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export function BranchPosDocsList({
  kind,
  orders = [],
  quotations = [],
  onRefresh,
  onNew,
  userName = "POS",
}: {
  kind: DocKind
  orders?: Order[]
  quotations?: Quotation[]
  onRefresh?: () => void
  onNew?: () => void
  userName?: string
}) {
  const { toast } = useToast()
  const { confirm } = useDialog()
  const [selected, setSelected] = useState<Order | Quotation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creditFilter, setCreditFilter] = useState<CreditFilter>("all")

  const rows = useMemo(() => {
    if (kind === "quotation") {
      return [...quotations].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    }
    let list = [...orders]
    if (creditFilter === "credit") list = list.filter(hasOutstandingCredit)
    if (creditFilter === "paid") list = list.filter((o) => getOrderCreditBalance(o) <= 0.004)
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [kind, orders, quotations, creditFilter])

  const summary = useMemo(() => {
    if (kind !== "order") return null
    const total = orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
    const paid = orders.reduce((s, o) => s + getOrderAmountPaid(o), 0)
    const debt = orders.reduce((s, o) => s + getOrderCreditBalance(o), 0)
    const creditCount = orders.filter(hasOutstandingCredit).length
    return { total, paid, debt, count: orders.length, creditCount }
  }, [kind, orders])

  const emptyLabel =
    kind === "order" ? "No orders yet — create your first order" : "No quotations yet — create your first quotation"

  async function handleDeliver(order: Order) {
    const ok = await confirm({
      type: "confirm",
      title: "Mark delivered?",
      message: `${order.orderNumber} will be marked delivered and branch stock will be deducted. This appears in Stock history.`,
      confirmLabel: "Deliver",
    })
    if (!ok) return
    setBusyId(order.id)
    try {
      const saved = await saveOrder({ ...order, status: "delivered" })
      toast({ type: "success", title: `${order.orderNumber} delivered`, message: "Branch stock deducted" })
      setSelected(saved)
      onRefresh?.()
    } catch (err) {
      toast({ type: "error", title: "Could not deliver", message: err instanceof Error ? err.message : undefined })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(doc: Order | Quotation) {
    const number = kind === "order" ? (doc as Order).orderNumber : (doc as Quotation).quotationNumber
    const order = kind === "order" ? (doc as Order) : null
    const willRestoreStock = !!order?.inventoryDeductedAt
    const ok = await confirm({
      type: "confirm",
      title: `Delete ${kind}?`,
      message:
        kind === "order"
          ? willRestoreStock
            ? `${number} will be deleted and branch stock restored (shown in Stock history).`
            : `${number} will be deleted. Stock was not deducted yet, so inventory stays unchanged.`
          : `${number} will be permanently deleted.`,
      confirmLabel: "Delete",
    })
    if (!ok) return
    setBusyId(doc.id)
    try {
      if (kind === "order") await deleteOrder(doc.id)
      else await deleteQuotation(doc.id)
      toast({
        type: "success",
        title: `${number} deleted`,
        message: willRestoreStock ? "Branch stock restored" : undefined,
      })
      setSelected(null)
      onRefresh?.()
    } catch (err) {
      toast({ type: "error", title: "Could not delete", message: err instanceof Error ? err.message : undefined })
    } finally {
      setBusyId(null)
    }
  }

  async function handleAcceptQuotation(q: Quotation) {
    setBusyId(q.id)
    try {
      await saveQuotation({ ...q, status: "accepted" })
      toast({ type: "success", title: `${q.quotationNumber} accepted` })
      setSelected(null)
      onRefresh?.()
    } catch {
      toast({ type: "error", title: "Could not update quotation" })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Orders</p>
            <p className="text-base font-bold tabular-nums mt-0.5">{summary.count}</p>
          </div>
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total amount</p>
            <p className="text-sm font-bold tabular-nums mt-0.5">{formatPkr(summary.total)}</p>
          </div>
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Paid</p>
            <p className="text-sm font-bold tabular-nums mt-0.5 text-emerald-700">{formatPkr(summary.paid)}</p>
          </div>
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">On credit / debt</p>
            <p className="text-sm font-bold tabular-nums mt-0.5 text-amber-700">{formatPkr(summary.debt)}</p>
          </div>
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Credit orders</p>
            <p className="text-base font-bold tabular-nums mt-0.5 text-amber-700">{summary.creditCount}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{kind === "order" ? "Orders" : "Quotations"}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Managed in Branch POS only — not shown in ERP CRM
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {kind === "order" && (
              <div className="flex rounded-md border overflow-hidden text-xs">
                {([
                  { id: "all" as const, label: "All" },
                  { id: "credit" as const, label: "On credit" },
                  { id: "paid" as const, label: "Paid" },
                ]).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCreditFilter(f.id)}
                    className={`px-3 py-1.5 cursor-pointer ${
                      creditFilter === f.id
                        ? "bg-[#1faca6] text-white"
                        : "bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {onNew && (
              <Button type="button" size="sm" className="h-9 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white shrink-0" onClick={onNew}>
                <Plus className="h-3.5 w-3.5" />
                {kind === "order" ? "New order" : "New quotation"}
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/30 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="text-left px-3 py-2.5">{kind === "order" ? "Order #" : "Quotation #"}</th>
                <th className="text-left px-3 py-2.5">Client</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Total</th>
                {kind === "order" && <th className="text-right px-3 py-2.5">Paid</th>}
                {kind === "order" && <th className="text-right px-3 py-2.5">Due</th>}
                <th className="text-left px-3 py-2.5">Date</th>
                <th className="text-right px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((doc) => {
                const number =
                  kind === "order" ? (doc as Order).orderNumber : (doc as Quotation).quotationNumber
                const order = kind === "order" ? (doc as Order) : null
                const paid = order ? getOrderAmountPaid(order) : 0
                const due = order ? getOrderCreditBalance(order) : 0
                const rowBusy = busyId === doc.id
                const credit = order ? hasOutstandingCredit(order) : false
                return (
                  <tr key={doc.id} className="hover:bg-[hsl(var(--muted))]/10">
                    <td
                      className="px-3 py-2.5 font-mono text-xs text-[#1faca6] cursor-pointer"
                      onClick={() => setSelected(doc)}
                    >
                      {number}
                      {credit && (
                        <span className="ml-1 inline-flex px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                          CREDIT
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 cursor-pointer" onClick={() => setSelected(doc)}>
                      {doc.clientName || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {kind === "order" ? (
                        <OrderStatusBadge status={(doc as Order).status} />
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium ${
                            QUOTATION_STATUS_COLORS[(doc as Quotation).status] || ""
                          }`}
                        >
                          {QUOTATION_STATUS_LABELS[(doc as Quotation).status] || (doc as Quotation).status}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatPkr(doc.total)}</td>
                    {kind === "order" && (
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{formatPkr(paid)}</td>
                    )}
                    {kind === "order" && (
                      <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{formatPkr(due)}</td>
                    )}
                    <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(doc.createdAt).toLocaleString("en-PK")}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {kind === "order" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] px-2"
                            disabled={rowBusy}
                            onClick={() => setSelected(doc)}
                            title="Open / edit / payment"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {kind === "order" && order && order.status !== "delivered" && order.status !== "cancelled" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] px-2"
                            disabled={rowBusy}
                            onClick={() => void handleDeliver(order)}
                            title="Mark delivered"
                          >
                            {rowBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                          </Button>
                        )}
                        {kind === "quotation" && (doc as Quotation).status === "draft" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] px-2"
                            disabled={rowBusy}
                            onClick={() => void handleAcceptQuotation(doc as Quotation)}
                            title="Accept"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] px-2 text-red-600"
                          disabled={rowBusy}
                          onClick={() => void handleDelete(doc)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={kind === "order" ? 8 : 6} className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">
                    {emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <DocDetailModal
          kind={kind}
          doc={selected}
          busy={busyId === selected.id}
          userName={userName}
          onClose={() => setSelected(null)}
          onDeliver={
            kind === "order" && (selected as Order).status !== "delivered"
              ? () => void handleDeliver(selected as Order)
              : undefined
          }
          onDelete={() => void handleDelete(selected)}
          onSaved={(order) => {
            setSelected(order)
            onRefresh?.()
          }}
        />
      )}
    </>
  )
}
