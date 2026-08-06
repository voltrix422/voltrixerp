"use client"

import { useEffect, useState } from "react"
import { FileDown, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { useToast } from "@/components/ui/toast"
import {
  getOrderAmountPaid,
  getOrderCreditBalance,
  getOrderPaymentProofUrls,
  getOrderReturnPaymentProofUrls,
  type Order,
  type OrderPayment,
  type OrderReturnPayment,
  type OrderStatus,
} from "@/lib/orders"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import {
  formatPosPkr,
  getPosAdminOrderDetail,
  type PosAdminOrderDetail,
} from "@/lib/pos-admin"

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium break-words">{value?.trim() || "—"}</p>
    </div>
  )
}

function AttachmentLinks({ urls, label }: { urls: string[]; label?: string }) {
  if (urls.length === 0) return null
  return (
    <div className="space-y-1.5">
      {label && <p className="text-[10px] uppercase text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => {
          const isImage = /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url) || url.includes("/uploads/")
          return (
            <a
              key={`${url}-${i}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border overflow-hidden hover:border-[#1faca6] transition-colors"
            >
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`Attachment ${i + 1}`} className="h-20 w-20 object-cover" />
              ) : (
                <span className="inline-flex items-center px-2.5 py-2 text-xs text-[#1faca6] underline">
                  View file {urls.length > 1 ? i + 1 : ""}
                </span>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}

export function PosAdminOrderDetailModal({
  orderId,
  onClose,
}: {
  orderId: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PosAdminOrderDetail | null>(null)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    void getPosAdminOrderDetail(orderId).then((res) => {
      if (cancelled) return
      if (!res) {
        setError("Could not load order details")
        setData(null)
      } else {
        setData(res)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [orderId])

  async function handlePdf() {
    if (!data?.order) return
    setExporting(true)
    try {
      await downloadInvoicePDF({
        ...data.order,
        status: data.order.status as OrderStatus,
        payments: data.order.payments as Order["payments"],
        returnPayments: data.order.returnPayments as Order["returnPayments"],
      } as Order)
      toast({ type: "success", title: "Invoice PDF downloaded" })
    } catch (err) {
      toast({
        type: "error",
        title: "Could not export PDF",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setExporting(false)
    }
  }

  const order = data?.order
  const client = data?.client
  const orderAsOrder = order
    ? ({
        ...order,
        status: order.status as OrderStatus,
        payments: order.payments as Order["payments"],
        returnPayments: order.returnPayments as Order["returnPayments"],
      } as Order)
    : null
  const paid = orderAsOrder ? getOrderAmountPaid(orderAsOrder) : 0
  const due = orderAsOrder ? getOrderCreditBalance(orderAsOrder) : 0

  const fulfillmentImages = [
    order?.fulfillmentReceiverImageUrl,
    order?.fulfillmentReceiverCnicImageUrl,
    order?.fulfillmentVehicleImageUrl,
    ...(order?.fulfillmentProductImageUrls || []),
  ].filter((u): u is string => !!u?.trim())

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl max-h-[92dvh] overflow-hidden rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <p className="text-sm font-semibold">POS order details</p>
            <p className="text-xs font-mono text-[#1faca6] mt-0.5">
              {order?.orderNumber || "…"}
              {data?.branch ? ` · ${data.branch.name}` : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto p-4 space-y-5 flex-1 min-h-0">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading order…
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-red-600 text-center py-10">{error}</p>
          )}

          {!loading && order && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Client (on order)" value={order.clientName} />
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <OrderStatusBadge status={order.status as OrderStatus} />
                  </div>
                </div>
                <Field
                  label="Created"
                  value={new Date(order.createdAt).toLocaleString("en-PK")}
                />
                <Field label="Created by" value={order.createdBy} />
                <Field label="Total" value={formatPosPkr(order.total)} />
                <Field label="Sale (line prices)" value={formatPosPkr(order.sellAmount)} />
                <Field label="Company amount" value={formatPosPkr(order.companyAmount)} />
                <Field label="Profit" value={formatPosPkr(order.profit)} />
                <Field label="Paid" value={formatPosPkr(paid)} />
                <Field label="Balance due" value={formatPosPkr(due)} />
                <Field label="Payment terms" value={order.paymentTerms} />
                <Field label="Delivery date" value={order.deliveryDate} />
                <div className="sm:col-span-2">
                  <Field label="Delivery address" value={order.deliveryAddress} />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Notes" value={order.notes} />
                </div>
              </div>

              <section className="rounded-xl border p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Client details
                </p>
                {client ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {client.imageUrl && (
                      <div className="sm:col-span-2">
                        <AttachmentLinks urls={[client.imageUrl]} label="Client photo" />
                      </div>
                    )}
                    <Field label="Name" value={client.name} />
                    <Field label="Company" value={client.company} />
                    <Field label="Phone" value={client.phone} />
                    <Field label="Email" value={client.email} />
                    <Field label="Contact person" value={client.contactPerson} />
                    <Field label="Industry" value={client.industry} />
                    <Field label="NTN" value={client.ntn} />
                    <Field label="Tax ID" value={client.taxId} />
                    <div className="sm:col-span-2">
                      <Field
                        label="Address"
                        value={[client.address, client.city, client.country].filter(Boolean).join(", ")}
                      />
                    </div>
                    <Field label="Website" value={client.website} />
                    <Field label="Status" value={client.status} />
                    <div className="sm:col-span-2">
                      <Field label="Client notes" value={client.notes} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No linked client record found
                    {order.clientName ? ` (order shows “${order.clientName}”)` : ""}.
                  </p>
                )}
              </section>

              <section>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
                  Line items
                </p>
                <CrmLineItemsDisplay items={order.items || []} showCompanyPrice />
              </section>

              <section>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
                  Payments & attachments
                </p>
                {(order.payments?.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded</p>
                ) : (
                  <ul className="space-y-2">
                    {order.payments!.map((p) => {
                      const proofs = getOrderPaymentProofUrls(p as OrderPayment)
                      return (
                        <li key={p.id} className="rounded-md border px-3 py-2.5 text-xs space-y-2">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium capitalize">{p.method || "Payment"}</span>
                            <span className="tabular-nums font-semibold">{formatPosPkr(p.amount)}</span>
                          </div>
                          <p className="text-muted-foreground">
                            {p.date}
                            {p.createdBy ? ` · ${p.createdBy}` : ""}
                            {p.submissionStatus ? ` · ${p.submissionStatus}` : ""}
                          </p>
                          {p.notes && <p>{p.notes}</p>}
                          <AttachmentLinks urls={proofs} label="Proof attachments" />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {(order.fulfillmentDate ||
                order.fulfillmentReceiverName ||
                fulfillmentImages.length > 0) && (
                <section className="rounded-xl border p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fulfillment / delivery
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Fulfillment date" value={order.fulfillmentDate} />
                    <Field label="Dispatcher" value={order.fulfillmentDispatcher || order.dispatcher} />
                    <Field label="Receiver" value={order.fulfillmentReceiverName} />
                    <Field label="Receiver CNIC" value={order.fulfillmentReceiverCnic} />
                    <Field label="Vehicle" value={order.fulfillmentVehicleNumber} />
                  </div>
                  <AttachmentLinks urls={fulfillmentImages} label="Delivery attachments" />
                </section>
              )}

              {(order.returnPayments?.length || 0) > 0 && (
                <section>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
                    Return payments
                  </p>
                  <ul className="space-y-2">
                    {order.returnPayments!.map((p) => (
                      <li key={p.id} className="rounded-md border px-3 py-2.5 text-xs space-y-2">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{p.method || "Refund"}</span>
                          <span className="tabular-nums font-semibold">{formatPosPkr(p.amount)}</span>
                        </div>
                        <AttachmentLinks urls={getOrderReturnPaymentProofUrls(p as OrderReturnPayment)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-3 border-t shrink-0 bg-muted/10">
          {order && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 text-xs"
              disabled={exporting}
              onClick={() => void handlePdf()}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Download invoice
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" className="h-9 text-xs ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
