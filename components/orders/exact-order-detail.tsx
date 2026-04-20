"use client"

import { useState } from "react"
import { X, Download, Edit, Calendar, MapPin, User, Phone, Truck, FileText, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { downloadOrderPDF } from "@/lib/generate-order-pdf-enhanced"

// Exact order data as specified
const orderData = {
  orderNumber: "ORD-20260415-001",
  status: "Pending",
  customer: {
    name: "ahmad raza",
    phone: "+923255325186"
  },
  deliveryAddress: "test",
  items: [
    {
      id: "1",
      description: "Solar Battery",
      specs: "5kW",
      qty: 2,
      unit: "pcs",
      unitPrice: 85000,
      total: 170000
    }
  ],
  totalAmount: 170000,
  courierService: {
    type: "Own Driver",
    driver: "ali",
    phone: "+923255325186",
    vehicle: "abc"
  },
  dates: {
    dispatched: "2026-04-17",
    expected: "2026-04-27"
  },
  notes: "abc"
}

interface ExactOrderDetailProps {
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onDownloadPDF?: () => void
}

export function ExactOrderDetail({ 
  isOpen, 
  onClose, 
  onEdit, 
  onDownloadPDF 
}: ExactOrderDetailProps) {
  if (!isOpen) return null

  const handleDownloadPDF = async () => {
    if (onDownloadPDF) {
      onDownloadPDF()
    } else {
      // Convert to Order type for PDF generation
      const orderForPDF = {
        id: "order_001",
        orderNumber: orderData.orderNumber,
        clientId: "client_001",
        clientName: orderData.customer.name,
        items: orderData.items.map(item => ({
          id: item.id,
          description: item.description,
          qty: item.qty,
          unit: item.unit,
          unitPrice: item.unitPrice,
          isCustom: false
        })),
        subtotal: orderData.totalAmount,
        taxPercent: 0,
        tax: 0,
        transportCost: 0,
        transportLabel: "Transport Cost",
        otherCost: 0,
        otherCostLabel: "Other Cost",
        shipping: 0,
        discount: 0,
        total: orderData.totalAmount,
        status: "pending_approval" as const,
        notes: orderData.notes,
        createdAt: "2026-04-15T10:30:00Z",
        createdBy: "admin",
        deliveryAddress: orderData.deliveryAddress,
        deliveryDate: orderData.dates.expected,
        dispatcher: orderData.courierService.driver,
        payments: []
      }
      
      try {
        await downloadOrderPDF(orderForPDF)
      } catch (error) {
        console.error("Error generating PDF:", error)
        alert("Failed to generate PDF. Please try again.")
      }
    }
  }

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
                <h2 className="text-lg font-bold text-neutral-900">Order {orderData.orderNumber}</h2>
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs font-medium">
                  {orderData.status}
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
          {/* Customer Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <User className="h-4 w-4 text-[#1a9f9a]" />
              Customer
            </h3>
            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Name</p>
                  <p className="text-sm font-medium text-neutral-900 capitalize">{orderData.customer.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Phone</p>
                  <p className="text-sm text-neutral-900">{orderData.customer.phone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#1a9f9a]" />
              Delivery Address
            </h3>
            <div className="bg-neutral-50 rounded-lg p-4">
              <p className="text-sm text-neutral-900">{orderData.deliveryAddress}</p>
            </div>
          </div>

          {/* Items */}
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
                  {orderData.items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{item.specs}</td>
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
                    <td colSpan={4} className="px-4 py-4 text-base font-bold text-neutral-900 text-right">
                      Total Amount:
                    </td>
                    <td className="px-4 py-4 text-lg font-bold text-[#1a9f9a] text-right">
                      Rs. {orderData.totalAmount.toLocaleString()}
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Service Type</p>
                  <p className="text-sm font-medium text-neutral-900">{orderData.courierService.type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Driver</p>
                  <p className="text-sm text-neutral-900 capitalize">{orderData.courierService.driver}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Phone</p>
                  <p className="text-sm text-neutral-900">{orderData.courierService.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Vehicle</p>
                  <p className="text-sm text-neutral-900 uppercase">{orderData.courierService.vehicle}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#1a9f9a]" />
              Dates
            </h3>
            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Dispatched</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {new Date(orderData.dates.dispatched).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Expected</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {new Date(orderData.dates.expected).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#1a9f9a]" />
              Notes
            </h3>
            <div className="bg-neutral-50 rounded-lg p-4">
              <p className="text-sm text-neutral-900">{orderData.notes}</p>
            </div>
          </div>
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