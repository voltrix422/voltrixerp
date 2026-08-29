"use client"

import type { MouseEvent } from "react"
import {
  getOrderAmountPaid,
  getOrderCreditBalance,
  hasOutstandingCredit,
  isOrderOnCredit,
  type Order,
} from "@/lib/orders"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { OrderSourceBadge } from "@/components/crm/order-source-badge"
import { formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"
import { Loader2 } from "lucide-react"

function formatPkr(amount: number) {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export function CrmOrdersListCards({
  orders,
  onSelect,
  onDownloadPdf,
  onDelete,
  pdfDownloadingId,
}: {
  orders: Order[]
  onSelect: (order: Order) => void
  onDownloadPdf?: (order: Order, e: MouseEvent) => void
  onDelete?: (order: Order) => void
  pdfDownloadingId?: string | null
}) {
  const showActions = Boolean(onDownloadPdf || onDelete)
  return (
    <div className="md:hidden space-y-2">
      {orders.map((order) => {
        const paid = getOrderAmountPaid(order)
        const due = getOrderCreditBalance(order)
        const onCredit = hasOutstandingCredit(order)
        const notCredit = !isOrderOnCredit(order)
        return (
          <button
            key={order.id}
            type="button"
            onClick={() => onSelect(order)}
            className="w-full text-left rounded-lg border p-3 space-y-2 hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <OrderSourceBadge order={order} />
                <p className="text-xs font-semibold text-[#1faca6] truncate">{order.orderNumber || "—"}</p>
                <p className="text-sm font-medium truncate">{order.clientName || "—"}</p>
                {order.warrantyHolderName?.trim() && (
                  <p className="text-[11px] text-[#1a9f9a] truncate">Warranty: {order.warrantyHolderName}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <OrderStatusBadge status={order.status} />
                {onCredit ? (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    On Credit
                  </span>
                ) : notCredit ? (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Not Credit
                  </span>
                ) : (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    Paid
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              <span>{formatCrmItemsQtyLabel(order.items)}</span>
              <span className="font-semibold text-[hsl(var(--foreground))]">{formatPkr(order.total || 0)}</span>
              <span className="text-emerald-700">Paid {formatPkr(paid)}</span>
              <span className="text-amber-700">Credit {formatPkr(due)}</span>
              <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</span>
            </div>
            {showActions && (
              <div className="flex gap-4 pt-1" onClick={(e) => e.stopPropagation()}>
                {onDownloadPdf && (
                  <button
                    type="button"
                    onClick={(e) => onDownloadPdf(order, e)}
                    disabled={pdfDownloadingId === order.id}
                    className="text-[#1a9f9a] text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  >
                    {pdfDownloadingId === order.id ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      "PDF"
                    )}
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(order)}
                    className="text-red-500 text-xs cursor-pointer"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
