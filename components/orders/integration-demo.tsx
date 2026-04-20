"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EnhancedOrderDetail } from "./enhanced-order-detail"
import { downloadOrderPDF } from "@/lib/generate-order-pdf-enhanced"
import { type Order } from "@/lib/orders"
import { Eye, Download, Edit, Trash2 } from "lucide-react"

// Sample order data matching your exact specifications
const sampleOrder: Order = {
  id: "order_001",
  orderNumber: "ORD-20260415-001",
  clientId: "client_001",
  clientName: "ahmad raza",
  items: [
    {
      id: "item_001",
      description: "Solar Battery",
      qty: 2,
      unit: "pcs",
      unitPrice: 85000,
      isCustom: false,
      inventoryItemId: "inv_001"
    }
  ],
  subtotal: 170000,
  taxPercent: 0,
  tax: 0,
  transportCost: 0,
  transportLabel: "Transport Cost",
  otherCost: 0,
  otherCostLabel: "Other Cost",
  shipping: 0,
  discount: 0,
  total: 170000,
  status: "pending_approval",
  notes: "abc",
  createdAt: "2026-04-15T10:30:00Z",
  createdBy: "admin",
  deliveryAddress: "test",
  deliveryDate: "2026-04-27",
  dispatcher: "ali",
  payments: []
}

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-800 border-gray-200",
  pending_approval: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  finalized: "bg-green-100 text-green-800 border-green-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  processing: "bg-purple-100 text-purple-800 border-purple-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200"
}

const STATUS_LABELS = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  finalized: "Finalized",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled"
}

export function IntegrationDemo() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleDownloadPDF = async () => {
    try {
      await downloadOrderPDF(sampleOrder)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  const handleEdit = () => {
    alert("Edit functionality - would open order edit form")
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this order?")) {
      alert("Delete functionality - would delete the order")
    }
  }

  const totalPaid = sampleOrder.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
  const remainingAmount = sampleOrder.total - totalPaid

  return (
    <div className="p-8 space-y-6">
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Enhanced Order Detail Integration</h1>
        <p className="text-neutral-600 mb-6">
          This demonstrates the enhanced order detail modal that integrates seamlessly with your existing ERP system.
          It supports all your Order type fields including payments, dispatcher, taxes, and more.
        </p>
        
        {/* Order Card - Similar to your existing orders list */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">{sampleOrder.orderNumber}</h3>
                  <p className="text-sm text-neutral-600 capitalize">
                    {sampleOrder.clientName} • Created by {sampleOrder.createdBy}
                  </p>
                </div>
                <Badge className={`text-xs font-medium border ${STATUS_COLORS[sampleOrder.status]}`}>
                  {STATUS_LABELS[sampleOrder.status]}
                </Badge>
              </div>
              
              <div className="text-right">
                <p className="text-xl font-bold text-[#1a9f9a]">Rs. {sampleOrder.total.toLocaleString()}</p>
                <p className="text-xs text-neutral-500">
                  {sampleOrder.items.length} item{sampleOrder.items.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Payment Status */}
            {sampleOrder.payments && sampleOrder.payments.length > 0 && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-700 font-medium">
                    Paid: Rs. {totalPaid.toLocaleString()}
                  </span>
                  {remainingAmount > 0 && (
                    <span className="text-orange-700 font-medium">
                      Remaining: Rs. {remainingAmount.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="mt-2 bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(totalPaid / sampleOrder.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Quick Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
              <div>
                <p className="text-neutral-500">Delivery Date</p>
                <p className="font-medium text-neutral-900">
                  {new Date(sampleOrder.deliveryDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Dispatcher</p>
                <p className="font-medium text-neutral-900 capitalize">{sampleOrder.dispatcher}</p>
              </div>
              <div>
                <p className="text-neutral-500">Created</p>
                <p className="font-medium text-neutral-900">
                  {new Date(sampleOrder.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button 
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="bg-[#1a9f9a] hover:bg-[#1a9f9a]/90 text-white"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleDownloadPDF}
                className="border-[#1a9f9a] text-[#1a9f9a] hover:bg-[#1a9f9a] hover:text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleEdit}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleDelete}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Integration Notes */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Integration Features</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>Full Order Type Support:</strong> Works with your existing Order interface</li>
            <li>• <strong>Payment Tracking:</strong> Shows payment history and remaining balance</li>
            <li>• <strong>Tax & Cost Breakdown:</strong> Displays all cost components (tax, transport, other costs)</li>
            <li>• <strong>Inventory Integration:</strong> Shows custom vs inventory items</li>
            <li>• <strong>PDF Generation:</strong> Professional PDF with your branding</li>
            <li>• <strong>Status Management:</strong> Supports all your order statuses</li>
            <li>• <strong>Responsive Design:</strong> Works on all screen sizes</li>
          </ul>
        </div>
      </div>

      <EnhancedOrderDetail
        order={sampleOrder}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDownloadPDF={handleDownloadPDF}
      />
    </div>
  )
}