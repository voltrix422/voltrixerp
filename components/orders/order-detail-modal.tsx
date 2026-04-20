"use client"

import { useState } from "react"
import { X, Download, Edit, Trash2, Eye, Calendar, MapPin, User, Phone, Truck, FileText, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"

interface OrderItem {
  id: string
  description: string
  specs?: string
  qty: number
  unit: string
  unitPrice: number
  total: number
}

interface CourierService {
  type: "own_driver" | "courier_company"
  driver?: string
  phone?: string
  vehicle?: string
  company?: string
}

interface OrderData {
  orderNumber: string
  status: "pending" | "approved" | "dispatched" | "delivered" | "cancelled"
  customer: {
    name: string
    phone: string
  }
  deliveryAddress: string
  items: OrderItem[]
  totalAmount: number
  courierService: CourierService
  dates: {
    dispatched?: string
    expected?: string
  }
  notes?: string
}

interface OrderDetailModalProps {
  order: OrderData
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onDownloadPDF?: () => void
}

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200", 
  dispatched: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200"
}

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  dispatched: "Dispatched", 
  delivered: "Delivered",
  cancelled: "Cancelled"
}

export function OrderDetailModal({ 
  order, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete, 
  onDownloadPDF 
}: OrderDetailModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="w-full max-w-4xl rounded-xl border bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" 
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
            {onDownloadPDF && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 px-3 text-xs border-[#1a9f9a] text-[#1a9f9a] hover:bg-[#1a9f9a] hover:text-white"
                onClick={onDownloadPDF}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download PDF
              </Button>
            )}
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
                  <p className="text-sm font-medium text-neutral-900 capitalize">{order.customer.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Phone</p>
                  <p className="text-sm text-neutral-900">{order.customer.phone}</p>
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#1a9f9a]" />
                Delivery Information
              </h3>
              <div className="bg-neutral-50 rounded-lg p-4">
                <div>
                  <p className="text-xs font-medium text-neutral-500">Address</p>
                  <p className="text-sm text-neutral-900">{order.deliveryAddress}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Package className="h-4 w-4 text-[#1a9f9a]" />
              Items
            </h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">Specs</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wide">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wide">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{item.specs || "-"}</td>
                      <td className="px-4 py-3 text-sm text-center text-neutral-900">
                        {item.qty} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-neutral-900">
                        Rs. {item.unitPrice.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-neutral-900">
                        Rs. {item.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1a9f9a]/5 border-t-2 border-[#1a9f9a]">
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-neutral-900 text-right">
                      Total Amount:
                    </td>
                    <td className="px-4 py-3 text-lg font-bold text-[#1a9f9a] text-right">
                      Rs. {order.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Courier Service */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#1a9f9a]" />
              Courier Service
            </h3>
            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-neutral-500">Service Type</p>
                  <p className="text-sm font-medium text-neutral-900 capitalize">
                    {order.courierService.type.replace('_', ' ')}
                  </p>
                </div>
                {order.courierService.driver && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500">Driver</p>
                    <p className="text-sm text-neutral-900 capitalize">{order.courierService.driver}</p>
                  </div>
                )}
                {order.courierService.phone && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500">Phone</p>
                    <p className="text-sm text-neutral-900">{order.courierService.phone}</p>
                  </div>
                )}
                {order.courierService.vehicle && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500">Vehicle</p>
                    <p className="text-sm text-neutral-900 uppercase">{order.courierService.vehicle}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dates */}
          {(order.dates.dispatched || order.dates.expected) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#1a9f9a]" />
                Dates
              </h3>
              <div className="bg-neutral-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.dates.dispatched && (
                    <div>
                      <p className="text-xs font-medium text-neutral-500">Dispatched</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {new Date(order.dates.dispatched).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  {order.dates.expected && (
                    <div>
                      <p className="text-xs font-medium text-neutral-500">Expected Delivery</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {new Date(order.dates.expected).toLocaleDateString('en-US', {
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