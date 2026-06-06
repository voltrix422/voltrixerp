"use client"

import type { MouseEvent } from "react"
import type { Order } from "@/lib/orders"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { OrderSourceBadge } from "@/components/crm/order-source-badge"
import { formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"
import { Loader2 } from "lucide-react"

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
      {orders.map((order) => (
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
            </div>
            <OrderStatusBadge status={order.status} className="shrink-0" />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span>{formatCrmItemsQtyLabel(order.items)}</span>
            <span className="font-semibold text-[hsl(var(--foreground))]">
              PKR {(order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
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
      ))}
    </div>
  )
}
