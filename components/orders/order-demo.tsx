"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { OrderDetailModal } from "./order-detail-modal"
import { downloadOrderPDF } from "@/lib/generate-order-pdf"

// Sample order data based on your requirements
const sampleOrder = {
  orderNumber: "ORD-20260415-001",
  status: "pending" as const,
  customer: {
    name: "ahmad raza",
    phone: "+923255325186"
  },
  deliveryAddress: "MAIN POST OFFICE 47/5L SAHIWAL",
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
    type: "own_driver" as const,
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

export function OrderDemo() {
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
    alert("Edit functionality would be implemented here")
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this order?")) {
      alert("Delete functionality would be implemented here")
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Order Detail Demo</h1>
        <p className="text-neutral-600 mb-6">
          This demonstrates the order detail modal with PDF download functionality, 
          designed to match your website branding.
        </p>
        
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-neutral-900">{sampleOrder.orderNumber}</h3>
              <p className="text-sm text-neutral-600 capitalize">
                {sampleOrder.customer.name} • {sampleOrder.customer.phone}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[#1a9f9a]">Rs. {sampleOrder.totalAmount.toLocaleString()}</p>
              <p className="text-xs text-neutral-500 capitalize">{sampleOrder.status}</p>
            </div>
          </div>
          
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-[#1a9f9a] hover:bg-[#1a9f9a]/90 text-white"
          >
            View Order Details
          </Button>
        </div>
      </div>

      <OrderDetailModal
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