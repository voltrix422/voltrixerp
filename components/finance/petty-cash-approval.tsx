"use client"

import { useState } from "react"
import { approvePettyCashAllocation, type PettyCashAllocation } from "@/lib/petty-cash"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { DollarSign, Upload, X } from "lucide-react"

type Props = {
  allocation: PettyCashAllocation
  reviewedBy: string
  onClose: () => void
  onSave: (allocation: PettyCashAllocation) => void
}

export function PettyCashApprovalForm({ allocation, reviewedBy, onClose, onSave }: Props) {
  const { toast } = useToast()
  const [amount, setAmount] = useState(String(allocation.amount))
  const [notes, setNotes] = useState(allocation.notes || "")
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("files", file)
    formData.append("folder", "petty-cash")
    const response = await fetch("/api/upload", { method: "POST", body: formData })
    if (!response.ok) throw new Error("Failed to upload file")
    const data = await response.json()
    return data.urls[0]
  }

  async function submit() {
    if (!amount) {
      toast({ title: "Missing amount", message: "Enter the approved amount.", type: "error" })
      return
    }

    if (!paymentProof) {
      toast({ title: "Payment proof required", message: "Upload proof that cash was paid out.", type: "error" })
      return
    }

    setLoading(true)
    try {
      let paymentProofUrl: string | undefined
      let paymentProofName: string | undefined
      setUploading(true)
      paymentProofUrl = await uploadFile(paymentProof)
      paymentProofName = paymentProof.name
      setUploading(false)

      const updated = await approvePettyCashAllocation({
        id: allocation.id,
        amount: parseFloat(amount),
        paymentProof: paymentProofUrl,
        paymentProofName,
        notes: notes.trim(),
        reviewedBy,
      })

      toast({ title: "Approved", message: `${allocation.employeeName} can now settle this petty cash.`, type: "success" })
      onSave(updated)
      onClose()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", message: "Failed to approve petty cash request.", type: "error" })
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <p className="text-lg font-bold">Approve petty cash</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border bg-[hsl(var(--muted))]/30 px-4 py-3 text-sm space-y-1">
            <p className="font-medium">{allocation.employeeName}</p>
            <p className="text-[hsl(var(--muted-foreground))]">{allocation.purpose}</p>
            <p className="text-[hsl(var(--muted-foreground))]">Requested: PKR {allocation.amount.toLocaleString()}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Approved amount (PKR) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Payment proof</label>
            <div className="border-2 border-dashed rounded-lg p-4">
              <input
                type="file"
                id="approval-proof"
                accept="image/*,.pdf"
                onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="approval-proof" className="flex flex-col items-center justify-center cursor-pointer text-center">
                <Upload className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-2" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {paymentProof ? paymentProof.name : "Upload payment proof"}
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 ml-auto" onClick={submit} disabled={loading || uploading}>
            {loading || uploading ? "Processing..." : "Approve and release cash"}
          </Button>
        </div>
      </div>
    </div>
  )
}
