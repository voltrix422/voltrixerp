"use client"

import { useEffect, useState } from "react"
import { FileDown, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
      <p className="mt-0.5 text-xs font-medium break-words leading-snug">{value?.trim() || "—"}</p>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-[hsl(var(--border))] rounded-sm">
      <div className="px-2.5 py-1.5 border-b border-[hsl(var(--border))]">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="p-2.5 space-y-2.5">{children}</div>
    </section>
  )
}

function AttachmentLinks({ urls, label }: { urls: string[]; label?: string }) {
  if (urls.length === 0) return null
  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {urls.map((url, i) => {
          const isImage = /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url) || url.includes("/uploads/")
          return (
            <a
              key={`${url}-${i}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block border border-[hsl(var(--border))] rounded-sm overflow-hidden"
            >
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`Attachment ${i + 1}`} className="h-16 w-16 object-cover" />
              ) : (
                <span className="inline-flex items-center px-2 py-1.5 text-[11px] underline">
                  File {urls.length > 1 ? i + 1 : ""}
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-3"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-5xl max-h-[94dvh] overflow-hidden rounded-t-sm sm:rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--background))] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))] shrink-0">
          <div>
            <p className="text-xs font-semibold">Order details</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {order?.orderNumber || "…"}
              {data?.branch ? ` · ${data.branch.name}` : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="overflow-y-auto p-3 space-y-2.5 flex-1 min-h-0">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          )}

          {!loading && error && (
            <p className="text-xs text-center py-8 border border-[hsl(var(--border))] rounded-sm">{error}</p>
          )}

          {!loading && order && (
            <>
              <Section title="Order">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2.5">
                  <Field label="Client" value={order.clientName} />
                  <Field label="Status" value={order.status.replace(/_/g, " ")} />
                  <Field label="Created" value={new Date(order.createdAt).toLocaleString("en-PK")} />
                  <Field label="Created by" value={order.createdBy} />
                  <Field label="Total" value={formatPosPkr(order.total)} />
                  <Field label="Sale" value={formatPosPkr(order.sellAmount)} />
                  <Field label="Company" value={formatPosPkr(order.companyAmount)} />
                  <Field label="Profit" value={formatPosPkr(order.profit)} />
                  <Field label="Paid" value={formatPosPkr(paid)} />
                  <Field label="Balance due" value={formatPosPkr(due)} />
                  <Field label="Terms" value={order.paymentTerms} />
                  <Field label="Delivery date" value={order.deliveryDate} />
                  <div className="col-span-2 sm:col-span-3">
                    <Field label="Delivery address" value={order.deliveryAddress} />
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <Field label="Notes" value={order.notes} />
                  </div>
                </div>
              </Section>

              <Section title="Client">
                {client ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2.5">
                    {client.imageUrl && (
                      <div className="col-span-2 sm:col-span-3">
                        <AttachmentLinks urls={[client.imageUrl]} label="Photo" />
                      </div>
                    )}
                    <Field label="Name" value={client.name} />
                    <Field label="Company" value={client.company} />
                    <Field label="Phone" value={client.phone} />
                    <Field label="Email" value={client.email} />
                    <Field label="Contact" value={client.contactPerson} />
                    <Field label="Industry" value={client.industry} />
                    <Field label="NTN" value={client.ntn} />
                    <Field label="Tax ID" value={client.taxId} />
                    <Field label="Status" value={client.status} />
                    <div className="col-span-2 sm:col-span-3">
                      <Field
                        label="Address"
                        value={[client.address, client.city, client.country].filter(Boolean).join(", ")}
                      />
                    </div>
                    <Field label="Website" value={client.website} />
                    <div className="col-span-2 sm:col-span-3">
                      <Field label="Notes" value={client.notes} />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No linked client
                    {order.clientName ? ` (order: ${order.clientName})` : ""}.
                  </p>
                )}
              </Section>

              <Section title="Line items">
                <CrmLineItemsDisplay items={order.items || []} showCompanyPrice />
              </Section>

              <Section title="Payments">
                {(order.payments?.length || 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">No payments</p>
                ) : (
                  <ul className="space-y-1.5">
                    {order.payments!.map((p) => {
                      const proofs = getOrderPaymentProofUrls(p as OrderPayment)
                      return (
                        <li key={p.id} className="border border-[hsl(var(--border))] rounded-sm px-2.5 py-2 text-xs space-y-1">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium capitalize">{p.method || "Payment"}</span>
                            <span className="tabular-nums font-semibold">{formatPosPkr(p.amount)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {p.date}
                            {p.createdBy ? ` · ${p.createdBy}` : ""}
                            {p.submissionStatus ? ` · ${p.submissionStatus}` : ""}
                          </p>
                          {p.notes && <p>{p.notes}</p>}
                          <AttachmentLinks urls={proofs} />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              {(order.fulfillmentDate ||
                order.fulfillmentReceiverName ||
                fulfillmentImages.length > 0) && (
                <Section title="Fulfillment">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2.5">
                    <Field label="Date" value={order.fulfillmentDate} />
                    <Field label="Dispatcher" value={order.fulfillmentDispatcher || order.dispatcher} />
                    <Field label="Receiver" value={order.fulfillmentReceiverName} />
                    <Field label="CNIC" value={order.fulfillmentReceiverCnic} />
                    <Field label="Vehicle" value={order.fulfillmentVehicleNumber} />
                  </div>
                  <AttachmentLinks urls={fulfillmentImages} label="Attachments" />
                </Section>
              )}

              {(order.returnPayments?.length || 0) > 0 && (
                <Section title="Return payments">
                  <ul className="space-y-1.5">
                    {order.returnPayments!.map((p) => (
                      <li key={p.id} className="border border-[hsl(var(--border))] rounded-sm px-2.5 py-2 text-xs space-y-1">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{p.method || "Refund"}</span>
                          <span className="tabular-nums font-semibold">{formatPosPkr(p.amount)}</span>
                        </div>
                        <AttachmentLinks urls={getOrderReturnPaymentProofUrls(p as OrderReturnPayment)} />
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-[hsl(var(--border))] shrink-0">
          {order && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs rounded-sm shadow-none"
              disabled={exporting}
              onClick={() => void handlePdf()}
            >
              {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
              Invoice
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-sm shadow-none ml-auto"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
