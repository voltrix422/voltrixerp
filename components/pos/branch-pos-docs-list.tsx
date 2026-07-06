"use client"

import { useMemo, useState } from "react"
import type { Order } from "@/lib/orders"
import type { Quotation } from "@/lib/quotations"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

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
  onClose,
}: {
  kind: DocKind
  doc: Order | Quotation
  onClose: () => void
}) {
  const number = kind === "order" ? (doc as Order).orderNumber : (doc as Quotation).quotationNumber
  const title = kind === "order" ? "Order details" : "Quotation details"

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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4">
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
            {doc.deliveryAddress && (
              <div className="sm:col-span-2">
                <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Delivery address</p>
                <p className="mt-0.5">{doc.deliveryAddress}</p>
              </div>
            )}
            {kind === "order" && (doc as Order).deliveryDate && (
              <div>
                <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Delivery date</p>
                <p className="mt-0.5">{(doc as Order).deliveryDate}</p>
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
            <CrmLineItemsDisplay items={doc.items} gstPercent={doc.taxPercent} />
          </div>

          {doc.notes && (
            <div>
              <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Notes</p>
              <p className="text-sm mt-0.5 text-[hsl(var(--muted-foreground))]">{doc.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function BranchPosDocsList({
  kind,
  orders = [],
  quotations = [],
}: {
  kind: DocKind
  orders?: Order[]
  quotations?: Quotation[]
}) {
  const [selected, setSelected] = useState<Order | Quotation | null>(null)

  const rows = useMemo(() => {
    const list = kind === "order" ? orders : quotations
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [kind, orders, quotations])

  const emptyLabel = kind === "order" ? "No orders created from this branch yet" : "No quotations created from this branch yet"

  return (
    <>
      <div className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold">{kind === "order" ? "My orders" : "My quotations"}</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Orders and quotations you create here also appear in ERP CRM
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/30 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="text-left px-3 py-2.5">{kind === "order" ? "Order #" : "Quotation #"}</th>
                <th className="text-left px-3 py-2.5">Client</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Total</th>
                <th className="text-left px-3 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((doc) => {
                const number =
                  kind === "order" ? (doc as Order).orderNumber : (doc as Quotation).quotationNumber
                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-[hsl(var(--muted))]/10 cursor-pointer"
                    onClick={() => setSelected(doc)}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-[#1faca6]">{number}</td>
                    <td className="px-3 py-2.5">{doc.clientName || "—"}</td>
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
                    <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(doc.createdAt).toLocaleString("en-PK")}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">
                    {emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <DocDetailModal kind={kind} doc={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
