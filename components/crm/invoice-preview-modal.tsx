"use client"
import { useRef } from "react"
import { X, Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import type { Order } from "@/lib/orders"
import Image from "next/image"

interface InvoicePreviewModalProps {
  order: Order
  onClose: () => void
}

export function InvoicePreviewModal({ order, onClose }: InvoicePreviewModalProps) {
  const subtotal = order.subtotal
  const tax = order.tax ?? (subtotal * (order.taxPercent || 0)) / 100
  const transport = order.transportCostValue ?? order.transportCost ?? 0
  const otherCost = order.otherCostValue ?? order.otherCost ?? 0
  const discount = order.discountValue ?? (order.discountIsPercentage ? (subtotal * (order.discount || 0)) / 100 : (order.discount || 0))
  const total = order.total

  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0)
  const remaining = total - totalPaid

  async function handleDownload() {
    try {
      await downloadInvoicePDF(order)
    } catch {
      alert("Failed to generate PDF. Please try again.")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl border bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-[hsl(var(--muted))]/30 shrink-0">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Invoice Preview</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Invoice content */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          <div className="bg-white rounded-lg shadow-sm mx-auto max-w-2xl p-8 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between border-b pb-6">
              <div className="flex items-center gap-4">
                <div className="relative h-12 w-12 shrink-0">
                  <Image src="/logo.png" alt="Voltrix" fill className="object-contain" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#1a9f9a]">VOLTRIX PVT LIMITED</p>
                  <p className="text-xs text-gray-500 mt-0.5">Plot # 73, Street 14, Industrial Area I-9/2, Islamabad</p>
                  <p className="text-xs text-gray-500">+92 303 4927779</p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-2xl font-bold text-gray-800">INVOICE</p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Invoice #:</span> {order.orderNumber}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Date:</span> {new Date(order.createdAt).toLocaleDateString()}
                </p>
                {order.deliveryDate && (
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Delivery Date:</span> {new Date(order.deliveryDate).toLocaleDateString()}
                  </p>
                )}
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200 capitalize">
                  {order.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {/* Bill To + Created By */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Bill To</p>
                <p className="text-sm font-bold text-gray-800">{order.clientName}</p>
                {order.deliveryAddress && (
                  <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{order.deliveryAddress}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Created By</p>
                <p className="text-xs text-gray-600">{order.createdBy}</p>
                <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Items table */}
            <div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1a9f9a] text-white">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold rounded-tl">Description</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold w-14">Qty</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold w-14">Unit</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold w-28">Unit Price</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold w-28 rounded-tr">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2.5 text-gray-800">{item.description}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{item.qty}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{item.unit}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">PKR {item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                        PKR {(item.unitPrice * item.qty).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax ({order.taxPercent || 0}%)</span>
                    <span>PKR {tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {transport > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{order.transportLabel || "Transport cost"}</span>
                    <span>PKR {transport.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {otherCost > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{order.otherCostLabel || "Other cost"}</span>
                    <span>PKR {otherCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>
                      Discount{order.discountIsPercentage ? ` (${order.discount}%)` : ""}
                    </span>
                    <span>- PKR {discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 border-t pt-2 mt-1">
                  <span>Total</span>
                  <span>PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Payment summary */}
            {(order.payments && order.payments.length > 0) ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-700 mb-2">Payments Received</p>
                {order.payments.map(p => (
                  <div key={p.id} className="flex justify-between text-xs text-green-800">
                    <span>{p.method} · {new Date(p.date).toLocaleDateString()}{p.notes ? ` · ${p.notes}` : ""}</span>
                    <span className="font-semibold">PKR {p.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-green-900 border-t border-green-200 pt-2">
                  <span>Total Paid</span>
                  <span>PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-sm font-bold text-orange-700">
                    <span>Remaining</span>
                    <span>PKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">No payments received yet</p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t pt-4 text-center">
              <p className="text-xs text-gray-400">Thank you for your business!</p>
              <p className="text-[10px] text-gray-400 mt-1">
                Created by {order.createdBy} on {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
