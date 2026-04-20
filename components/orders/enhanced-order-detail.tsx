"use client"

import { useState } from "react"
import { X, Download, Edit, Trash2, Eye, Calendar, MapPin, User, Phone, Truck, FileText, Package, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { type Order, STATUS_LABELS, STATUS_COLORS } from "@/lib/orders"
import { downloadOrderPDF } from "@/lib/generate-order-pdf-enhanced"

interface EnhancedOrderDetailProps {
  order: Order
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onDownloadPDF?: () => void
}

export function EnhancedOrderDetail({ 
  order, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete, 
  onDownloadPDF 
}: EnhancedOrderDetailProps) {
  if (!isOpen) return null

  const handleDownloadPDF = async () => {
    if (onDownloadPDF) {
      onDownloadPDF()
    } else {
      try {
        await downloadOrderPDF(order)
      } catch (error) {
        console.error("Error generating PDF:", error)
        alert("Failed to generate PDF. Please try again.")
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="w-full max-w-5xl rounded-xl border bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[#1a9f9a]/5 to-[#1a9f9a]/10">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="Voltrix"
              width={80}
              height={26}
              className="h-6 w-auto object-contain"
            />
            <div className="h-6 w-px bg-neutral-300" />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-neutral-900">{order.orderNumber}</h2>
                <Badge className={`text-xs font-medium border ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </Badge>
              </div>
              <p className="text-sm text-neutral-600 mt-0.5">Order Details</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 px-3 text-xs border-[#1a9f9a] text-[#1a9f9a] hover:bg-[#1a9f9a] hover:text-white"
              onClick={handleDownloadPDF}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download PDF
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer & Delivery Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <User className="h-4 w-4 text-[#1a9f9a]" />
                Customer Information
              </h3>
              <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
                <div>
                  <p className="text-xs font-medium text-neutral-500">Name</p>
                  <p className="text-sm font-medium text-neutral-900 capitalize">{order.clientName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Client ID</p>
                  <p className="text-sm text-neutral-900">{order.clientId}</p>
                </div>
              </div>
            </div>

            {/* Order Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#1a9f9a]" />
                Order Information
              </h3>
              <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
                <div>
                  <p className="text-xs font-medium text-neutral-500">Created</p>
                  <p className="text-sm text-neutral-900">
                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })} by {order.createdBy}
                  </p>
                </div>
                {order.deliveryDate && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500">Delivery Date</p>
                    <p className="text-sm text-neutral-900">
                      {new Date(order.deliveryDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          {order.deliveryAddress && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#1a9f9a]" />
                Delivery Address
              </h3>
              <div className="bg-neutral-50 rounded-lg p-4">
                <p className="text-sm text-neutral-900">{order.deliveryAddress}</p>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Package className="h-4 w-4 text-[#1a9f9a]" />
              Items ({order.items.length})
            </h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wide">Qty</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wide">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wide">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{item.description}</p>
                          {!item.isCustom && (
                            <p className="text-xs text-green-600 font-medium">From Inventory</p>
                          )}
                          {item.isCustom && (
                            <p className="text-xs text-blue-600 font-medium">Custom Item</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-neutral-900">
                        {item.qty}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-neutral-900">
                        {item.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-neutral-900">
                        Rs. {item.unitPrice.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-neutral-900">
                        Rs. {(item.unitPrice * item.qty).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#1a9f9a]" />
              Order Summary
            </h3>
            <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-neutral-600">Subtotal</span>
                <span className="font-medium text-neutral-900">Rs. {order.subtotal.toLocaleString()}</span>
              </div>
              
              {order.taxPercent > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-600">Tax ({order.taxPercent}%)</span>
                  <span className="font-medium text-neutral-900">Rs. {order.tax.toLocaleString()}</span>
                </div>
              )}
              
              {order.transportCost > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-600">{order.transportLabel}</span>
                  <span className="font-medium text-neutral-900">Rs. {order.transportCost.toLocaleString()}</span>
                </div>
              )}
              
              {order.otherCost > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-600">{order.otherCostLabel}</span>
                  <span className="font-medium text-neutral-900">Rs. {order.otherCost.toLocaleString()}</span>
                </div>
              )}
              
              {order.shipping > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-600">Shipping</span>
                  <span className="font-medium text-neutral-900">Rs. {order.shipping.toLocaleString()}</span>
                </div>
              )}
              
              {order.discount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-600">Discount</span>
                  <span className="font-medium text-red-600">-Rs. {order.discount.toLocaleString()}</span>
                </div>
              )}
              
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-neutral-900">Total Amount</span>
                  <span className="text-lg font-bold text-[#1a9f9a]">Rs. {order.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dispatcher */}
          {order.dispatcher && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#1a9f9a]" />
                Dispatcher
              </h3>
              <div className="bg-neutral-50 rounded-lg p-4">
                <p className="text-sm font-medium text-neutral-900">{order.dispatcher}</p>
              </div>
            </div>
          )}

          {/* Payments */}
          {order.payments && order.payments.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#1a9f9a]" />
                Payments Received
              </h3>
              <div className="bg-green-50 rounded-lg p-4 space-y-3">
                {order.payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center py-2 border-b border-green-200 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-green-900">Rs. {payment.amount.toLocaleString()}</p>
                      <p className="text-xs text-green-700">
                        {payment.method} • {new Date(payment.date).toLocaleDateString()}
                      </p>
                      {payment.notes && (
                        <p className="text-xs text-green-600 mt-1">{payment.notes}</p>
                      )}
                    </div>
                    {payment.proofUrl && (
                      <a 
                        href={payment.proofUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-green-700 underline hover:text-green-900"
                      >
                        View Proof
                      </a>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-green-300">
                  <span className="text-sm font-bold text-green-900">Total Paid</span>
                  <span className="text-sm font-bold text-green-900">
                    Rs. {order.payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                  </span>
                </div>
                {order.payments.reduce((sum, p) => sum + p.amount, 0) < order.total && (
                  <div className="flex justify-between items-center text-orange-700">
                    <span className="text-sm font-bold">Remaining</span>
                    <span className="text-sm font-bold">
                      Rs. {(order.total - order.payments.reduce((sum, p) => sum + p.amount, 0)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#1a9f9a]" />
                Notes
              </h3>
              <div className="bg-neutral-50 rounded-lg p-4">
                <p className="text-sm text-neutral-900 whitespace-pre-wrap">{order.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-neutral-50">
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 px-3 text-xs"
                onClick={onEdit}
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            )}
          </div>
          
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 px-4 text-xs"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}