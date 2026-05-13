"use client"
import { useState, useEffect } from "react"
import { getPettyCashAllocations, getPettyCashReceipts, createPettyCashReceipt, type PettyCashAllocation, type PettyCashReceipt } from "@/lib/petty-cash"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Plus, X, Upload, Receipt, DollarSign, FileText, AlertCircle } from "lucide-react"

interface PettyCashReceiptProps {
  onClose: () => void
  onSave: (receipt: PettyCashReceipt) => void
  employeeName?: string
  employeeId?: string
}

export function PettyCashReceipt({ onClose, onSave, employeeName, employeeId }: PettyCashReceiptProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [allocations, setAllocations] = useState<PettyCashAllocation[]>([])
  const [loading, setLoading] = useState(false)
  const [showAllocationDropdown, setShowAllocationDropdown] = useState(false)
  
  const [selectedAllocation, setSelectedAllocation] = useState<PettyCashAllocation | null>(null)
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [receiptProof, setReceiptProof] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    // Load active allocations for the current employee
    getPettyCashAllocations().then(data => {
      const activeAllocations = data.filter(a =>
        a.status === "active" &&
        (!employeeId || a.employeeId === employeeId || a.employeeName === employeeName) &&
        (!employeeName || a.employeeName === employeeName)
      )
      setAllocations(activeAllocations)
    })
  }, [employeeName, employeeId])

  async function handleFileUpload(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('files', file)
    formData.append('folder', 'petty-cash')
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error('Failed to upload file')
    }
    
    const data = await response.json()
    return data.urls[0]
  }

  async function submit() {
    if (!selectedAllocation || !description || !amount || !receiptProof) {
      toast({
        title: "Missing Information",
        message: "Please fill all required fields and attach proof",
        type: "error"
      })
      return
    }

    // Calculate actual remaining amount from existing receipts
    const existingReceipts = await getPettyCashReceipts(selectedAllocation.id)
    const approvedAmount = existingReceipts.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.amount, 0)
    const remainingAmount = selectedAllocation.amount - approvedAmount

    if (parseFloat(amount) > remainingAmount) {
      toast({
        title: "Amount Exceeds Remaining Balance",
        message: `Maximum amount available: PKR ${remainingAmount.toLocaleString()} (PKR ${selectedAllocation.amount.toLocaleString()} - PKR ${approvedAmount.toLocaleString()} spent)`,
        type: "error"
      })
      return
    }

    setLoading(true)
    
    try {
      let receiptProofUrl = ""
      let receiptProofFileName = ""
      
      if (receiptProof) {
        setUploading(true)
        receiptProofUrl = await handleFileUpload(receiptProof)
        receiptProofFileName = receiptProof.name
        setUploading(false)
      }

      const receipt = await createPettyCashReceipt({
        allocationId: selectedAllocation.id,
        employeeName: selectedAllocation.employeeName,
        description,
        amount: parseFloat(amount),
        receiptProof: receiptProofUrl || undefined,
        receiptProofName: receiptProofFileName || undefined,
        notes: notes.trim()
      })

      toast({
        title: "Success",
        message: "Settlement submitted successfully",
        type: "success"
      })

      onSave(receipt)
      onClose()
    } catch (error) {
      console.error('Error creating petty cash receipt:', error)
      toast({
        title: "Error",
        message: "Failed to submit receipt",
        type: "error"
      })
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-600" />
            <p className="text-lg font-bold">Add Settlement</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          {/* Available Allocations Info */}
          {allocations.length === 0 ? (
            <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <div className="text-xs text-orange-800 dark:text-orange-200">
                  <p className="font-semibold mb-1">No Active Petty Cash</p>
                  <p>You don't have any active petty cash allocations. Please contact the finance team.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Allocation Selection */}
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Select Allocation *
                </label>
                <button
                  type="button"
                  onClick={() => setShowAllocationDropdown(!showAllocationDropdown)}
                  className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] flex items-center justify-between cursor-pointer"
                >
                  <span className={selectedAllocation ? "" : "text-[hsl(var(--muted-foreground))]"}>
                    {selectedAllocation 
                      ? `PKR ${selectedAllocation.amount.toLocaleString()} - ${selectedAllocation.purpose}`
                      : "Choose allocation..."
                    }
                  </span>
                  <svg className="h-5 w-5 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showAllocationDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAllocationDropdown(false)} />
                    <div className="absolute z-20 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-[hsl(var(--background))] shadow-lg">
                      {allocations.map(allocation => (
                        <div
                          key={allocation.id}
                          onClick={() => {
                            setSelectedAllocation(allocation)
                            setShowAllocationDropdown(false)
                          }}
                          className="px-3.5 py-2.5 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 border-t"
                        >
                          <div className="font-medium">PKR {allocation.amount.toLocaleString()} - {allocation.purpose}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">
                            Allocated: {new Date(allocation.allocatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Show allocation details when selected */}
                {selectedAllocation && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                      <p className="font-semibold mb-1">Allocation Details</p>
                      <p>Total: PKR {selectedAllocation.amount.toLocaleString()}</p>
                      <p>Purpose: {selectedAllocation.purpose}</p>
                      <p>Allocated: {new Date(selectedAllocation.allocatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Description *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What was this expense for?"
                  className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Amount (PKR) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter expense amount"
                  className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
                {selectedAllocation && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Available: PKR {selectedAllocation.amount.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional details about this expense"
                  rows={3}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
                />
              </div>

              {/* Receipt Proof */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Proof Attachment *
                </label>
                <div className="border-2 border-dashed border-[hsl(var(--muted-foreground))] rounded-lg p-4">
                  <input
                    type="file"
                    id="receipt-proof"
                    accept="image/*,.pdf"
                    onChange={e => setReceiptProof(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="receipt-proof"
                    className="flex flex-col items-center justify-center cursor-pointer text-center"
                  >
                    <Upload className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-2" />
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                      {receiptProof ? receiptProof.name : "Click to upload proof"}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      Images or PDF files
                    </span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            size="sm" 
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 ml-auto" 
            onClick={submit}
            disabled={loading || uploading || allocations.length === 0}
          >
            {loading || uploading ? "Processing..." : "Submit Settlement"}
          </Button>
        </div>
      </div>
    </div>
  )
}
