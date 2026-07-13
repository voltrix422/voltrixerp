"use client"

import { useMemo, useState } from "react"
import {
  deleteOrder,
  getOrderAmountPaid,
  getOrderCreditBalance,
  saveOrder,
  type Order,
} from "@/lib/orders"
import { deleteQuotation, saveQuotation, type Quotation } from "@/lib/quotations"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useDialog } from "@/components/ui/dialog-provider"
import { CheckCircle2, Loader2, Plus, Trash2, Truck, X } from "lucide-react"

type DocKind = "order" | "quotation"

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
}: {
  kind: DocKind
  doc: Order | Quotation
  busy?: boolean
  onClose: () => void
  onDeliver?: () => void
  onDelete?: () => void
}) {
  const number = kind === "order" ? (doc as Order).orderNumber : (doc as Quotation).quotationNumber
  const title = kind === "order" ? "Order details" : "Quotation details"
  const order = kind === "order" ? (doc as Order) : null
  const paid = order ? getOrderAmountPaid(order) : 0
  const debt = order ? getOrderCreditBalance(order) : 0

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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4 flex-1 min-h-0">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Client</p>
              <p className="font-medium mt-0.5">{doc.clientName || "—"}</p>
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
                <div>
                  <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Payment terms</p>
                  <p className="mt-0.5 capitalize">{order.paymentTerms || "full"}</p>
                </div>
              </>
            )}
            {doc.deliveryAddress && (
              <div className="sm:col-span-2">
                <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Delivery address</p>
                <p className="mt-0.5">{doc.deliveryAddress}</p>
              </div>
            )}
            {order?.deliveryDate && (
              <div>
                <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Delivery date</p>
                <p className="mt-0.5">{order.deliveryDate}</p>
              </div>
            )}
            {kind === "quotation" && (doc as Quotation).validUntil && (
              <div>
                <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Valid until</p>
                <p className="mt-0.5">{(doc as Quotation).validUntil}</p>
              </div>
            )}
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

          {doc.notes && (
            <div>
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Notes</p>
              <p className="text-sm mt-0.5 text-[hsl(var(--muted-foreground))]">{doc.notes}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-3 border-t shrink-0 bg-[hsl(var(--muted))]/10">
          {kind === "order" && order && order.status !== "delivered" && order.status !== "cancelled" && onDeliver && (
            <Button type="button" size="sm" className="h-9 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white" disabled={busy} onClick={onDeliver}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
              Mark delivered
            </Button>
          )}
          {onDelete && (
            <Button type="button" size="sm" variant="ghost" className="h-9 text-xs text-red-600" disabled={busy} onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" className="h-9 text-xs ml-auto" disabled={busy} onClick={onClose}>
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
}: {
  kind: DocKind
  orders?: Order[]
  quotations?: Quotation[]
  onRefresh?: () => void
  onNew?: () => void
}) {
  const { toast } = useToast()
  const { confirm } = useDialog()
  const [selected, setSelected] = useState<Order | Quotation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const list = kind === "order" ? orders : quotations
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [kind, orders, quotations])

  const summary = useMemo(() => {
    if (kind !== "order") return null
    const total = orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
    const paid = orders.reduce((s, o) => s + getOrderAmountPaid(o), 0)
    const debt = orders.reduce((s, o) => s + getOrderCreditBalance(o), 0)
    return { total, paid, debt, count: orders.length }
  }, [kind, orders])

  const emptyLabel =
    kind === "order" ? "No orders yet — create your first order" : "No quotations yet — create your first quotation"

  async function handleDeliver(order: Order) {
    const ok = await confirm({
      type: "confirm",
      title: "Mark delivered?",
      message: `${order.orderNumber} will be marked delivered. Branch stock was already deducted when the order was created.`,
      confirmLabel: "Deliver",
    })
    if (!ok) return
    setBusyId(order.id)
    try {
      await saveOrder({ ...order, status: "delivered" })
      toast({ type: "success", title: `${order.orderNumber} delivered` })
      setSelected(null)
      onRefresh?.()
    } catch (err) {
      toast({ type: "error", title: "Could not deliver", message: err instanceof Error ? err.message : undefined })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(doc: Order | Quotation) {
    const number = kind === "order" ? (doc as Order).orderNumber : (doc as Quotation).quotationNumber
    const ok = await confirm({
      type: "confirm",
      title: `Delete ${kind}?`,
      message:
        kind === "order"
          ? `${number} will be deleted and branch stock restored.`
          : `${number} will be permanently deleted.`,
      confirmLabel: "Delete",
    })
    if (!ok) return
    setBusyId(doc.id)
    try {
      if (kind === "order") await deleteOrder(doc.id)
      else await deleteQuotation(doc.id)
      toast({ type: "success", title: `${number} deleted` })
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Orders</p>
            <p className="text-base font-bold tabular-nums mt-0.5">{summary.count}</p>
          </div>
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total amount</p>
            <p className="text-sm font-bold tabular-nums mt-0.5">{formatPkr(summary.total)}</p>
          </div>
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Paid / received</p>
            <p className="text-sm font-bold tabular-nums mt-0.5 text-emerald-700">{formatPkr(summary.paid)}</p>
          </div>
          <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">On credit / debt</p>
            <p className="text-sm font-bold tabular-nums mt-0.5 text-amber-700">{formatPkr(summary.debt)}</p>
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
          {onNew && (
            <Button type="button" size="sm" className="h-9 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white shrink-0" onClick={onNew}>
              <Plus className="h-3.5 w-3.5" />
              {kind === "order" ? "New order" : "New quotation"}
            </Button>
          )}
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
                return (
                  <tr key={doc.id} className="hover:bg-[hsl(var(--muted))]/10">
                    <td
                      className="px-3 py-2.5 font-mono text-xs text-[#1faca6] cursor-pointer"
                      onClick={() => setSelected(doc)}
                    >
                      {number}
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
          onClose={() => setSelected(null)}
          onDeliver={
            kind === "order" && (selected as Order).status !== "delivered"
              ? () => void handleDeliver(selected as Order)
              : undefined
          }
          onDelete={() => void handleDelete(selected)}
        />
      )}
    </>
  )
}
