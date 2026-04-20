"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MinimalOrderDetail } from "./minimal-order-detail"
import { Eye } from "lucide-react"

export function MinimalDemo() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleEdit = () => {
    alert("Edit functionality - would open edit form")
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      alert("Delete functionality - order would be deleted")
      setIsModalOpen(false)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Minimal Order Detail</h1>
        <p className="text-gray-600 mb-6">Clean, minimalistic design for order details</p>
        
        {/* Simple Order Card */}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">Order #ORD-20260415-001</h3>
              <p className="text-sm text-gray-600">ahmad raza • Rs. 170,000</p>
            </div>
            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
              Pending
            </span>
          </div>
          
          <Button 
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-[#1a9f9a] hover:bg-[#1a9f9a]/90 text-white"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
        </div>
      </div>

      <MinimalOrderDetail
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}