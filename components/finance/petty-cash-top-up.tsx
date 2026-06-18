"use client"

import { useState } from "react"
import { topUpPettyCashAllocation, type PettyCashAllocation } from "@/lib/petty-cash"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { DollarSign, Upload, X } from "lucide-react"

type Props = {
  allocation: PettyCashAllocation
  allocatedBy: string
  onClose: () => void
  onSave: (allocation: PettyCashAllocation) => void
}

export function PettyCashTopUp({ allocation, allocatedBy, onClose, onSave }: Props) {
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function handleFileUpload(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("files", file)
    formData.append("folder", "petty-cash")

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Failed to upload file")
    }

    const data = await response.json()
    return data.urls[0]
  }

  async function submit() {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) {
      toast({
        title: "Invalid amount",
        message: "Enter an amount greater than zero.",
        type: "error",
      })
      return
    }

    setLoading(true)
    try {
      let paymentProofUrl = ""
      let paymentProofFileName = ""

      if (paymentProof) {
        setUploading(true)
        paymentProofUrl = await handleFileUpload(paymentProof)
        paymentProofFileName = paymentProof.name
        setUploading(false)
      }

      const updated = await topUpPettyCashAllocation({
        id: allocation.id,
        topUpAmount: parsed,
        topUpBy: allocatedBy,
        note: note.trim() || undefined,
        paymentProof: paymentProofUrl || undefined,
        paymentProofName: paymentProofFileName || undefined,
      })

      toast({
        title: "Cash added",
        message: `PKR ${parsed.toLocaleString()} added to ${allocation.employeeName}'s ledger.`,
        type: "success",
      })

      onSave(updated)
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to add cash",
        type: "error",
      })
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-lg font-bold">Add Cash</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {allocation.employeeName} • personal expense ledger
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Record cash paid to this employee. It increases their allocated balance on the same ledger
            (e.g. reimbursing PKR 10,000 already spent from pocket).
          </p>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Amount (PKR) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 10000"
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Reimbursement for office expenses"
              rows={2}
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Payment proof (optional)
            </label>
            <div className="border-2 border-dashed border-[hsl(var(--muted-foreground))] rounded-lg p-4">
              <input
                type="file"
                id="topup-payment-proof"
                accept="image/*,.pdf"
                onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="topup-payment-proof"
                className="flex flex-col items-center justify-center cursor-pointer text-center"
              >
                <Upload className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-2" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {paymentProof ? paymentProof.name : "Click to upload payment proof"}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-green-600 hover:bg-green-700 ml-auto"
            onClick={submit}
            disabled={loading || uploading}
          >
            {loading || uploading ? "Processing..." : "Add Cash"}
          </Button>
        </div>
      </div>
    </div>
  )
}
