"use client"

import { useState } from "react"
import { X, Download, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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

interface MinimalOrderDetailProps {
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function MinimalOrderDetail({ 
  isOpen, 
  onClose, 
  onEdit,
  onDelete
}: MinimalOrderDetailProps) {
  if (!isOpen) return null

  const handleDownloadPDF = async () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-white rounded-lg shadow-xl overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Order {orderData.orderNumber}</h2>
            <span className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded mt-1">
              {orderData.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadPDF}
              className="p-2 hover:bg-gray-100 rounded text-[#1a9f9a] hover:text-[#1a9f9a]/80"
              title="Download PDF"
            >
              <Download className="h-5 w-5" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Customer */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Customer</h3>
            <div className="text-sm text-gray-600">
              <div>{orderData.customer.name}</div>
              <div>{orderData.customer.phone}</div>
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Delivery Address</h3>
            <div className="text-sm text-gray-600">{orderData.deliveryAddress}</div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Items</h3>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Item</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Specs</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Unit Price</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orderData.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2 text-gray-900">{item.description}</td>
                      <td className="px-3 py-2 text-gray-600">{item.specs}</td>
                      <td className="px-3 py-2 text-center text-gray-900">{item.qty} {item.unit}</td>
                      <td className="px-3 py-2 text-right text-gray-900">Rs. {item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">Rs. {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-2 p-3 bg-gray-50 rounded">
              <span className="font-medium text-gray-900">Total Amount:</span>
              <span className="text-lg font-bold text-[#1a9f9a]">Rs. {orderData.totalAmount.toLocaleString()}</span>
            </div>
            
            {/* Download PDF Button - Prominent placement */}
            <div className="mt-3 text-center">
              <Button 
                onClick={handleDownloadPDF}
                className="bg-[#1a9f9a] hover:bg-[#1a9f9a]/90 text-white px-6 py-2"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* Courier Service */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Courier Service</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <div className="font-medium text-gray-700">{orderData.courierService.type}</div>
                <div>Driver: {orderData.courierService.driver}</div>
              </div>
              <div>
                <div>Phone: {orderData.courierService.phone}</div>
                <div>Vehicle: {orderData.courierService.vehicle}</div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Dates</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <div className="font-medium text-gray-700">Dispatched:</div>
                <div>{new Date(orderData.dates.dispatched).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Expected:</div>
                <div>{new Date(orderData.dates.expected).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Notes</h3>
            <div className="text-sm text-gray-600">{orderData.notes}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="flex gap-2">
            {onEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onDelete}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={handleDownloadPDF}
              className="bg-[#1a9f9a] hover:bg-[#1a9f9a]/90 text-white"
            >
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          </div>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}