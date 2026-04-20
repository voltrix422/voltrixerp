"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExactOrderDetail } from "./exact-order-detail"
import { Eye, Download, Edit } from "lucide-react"

export function ExactDemo() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleEdit = () => {
    alert("Edit functionality would be implemented here")
  }

  const handleDownloadPDF = () => {
    // PDF download is handled within the modal
    console.log("PDF download initiated")
  }

  return (
    <div className="p-8 space-y-6">
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Exact Order Detail Design</h1>
        <p className="text-neutral-600 mb-6">
          This is the exact order detail modal based on your specifications with all the data you provided.
        </p>
        
        {/* Order Summary Card */}
        <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Order #ORD-20260415-001</h3>
                  <p className="text-sm text-neutral-600">ahmad raza • +923255325186</p>
                </div>
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs font-medium">
                  Pending
                </Badge>
              </div>
              
              <div className="text-right">
                <p className="text-xl font-bold text-[#1a9f9a]">Rs. 170,000</p>
                <p className="text-xs text-neutral-500">1 item</p>
              </div>
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 text-sm">
              <div>
                <p className="text-neutral-500">Item</p>
                <p className="font-medium text-neutral-900">Solar Battery (5kW)</p>
              </div>
              <div>
                <p className="text-neutral-500">Delivery</p>
                <p className="font-medium text-neutral-900">test</p>
              </div>
              <div>
                <p className="text-neutral-500">Driver</p>
                <p className="font-medium text-neutral-900 capitalize">ali</p>
              </div>
              <div>
                <p className="text-neutral-500">Expected</p>
                <p className="font-medium text-neutral-900">Apr 27, 2026</p>
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
                View Full Details
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleEdit}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="mt-8 p-6 bg-[#1a9f9a]/5 rounded-lg border border-[#1a9f9a]/20">
          <h3 className="text-lg font-semibold text-[#1a9f9a] mb-3">Order Detail Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-neutral-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#1a9f9a] rounded-full"></div>
              <span>Complete customer information</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#1a9f9a] rounded-full"></div>
              <span>Detailed item specifications</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#1a9f9a] rounded-full"></div>
              <span>Courier service details</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#1a9f9a] rounded-full"></div>
              <span>Dispatch and delivery dates</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#1a9f9a] rounded-full"></div>
              <span>Professional PDF download</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#1a9f9a] rounded-full"></div>
              <span>Voltrix branding integration</span>
            </div>
          </div>
        </div>
      </div>

      <ExactOrderDetail
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEdit={handleEdit}
        onDownloadPDF={handleDownloadPDF}
      />
    </div>
  )
}