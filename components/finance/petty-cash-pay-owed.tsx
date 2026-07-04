"use client"

import { useState } from "react"
import {
  topUpPettyCashAllocation,
  updatePettyCashAllocationStatus,
  type PettyCashAllocation,
} from "@/lib/petty-cash"
import { formatPettyCashExpense } from "@/lib/petty-cash-display"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Banknote, Upload, X } from "lucide-react"

type Props = {
  allocation: PettyCashAllocation
  owedAmount: number
  paidBy: string
  onClose: () => void
  onComplete: () => void
}

export function PettyCashPayOwed({
  allocation,
  owedAmount,
  paidBy,
  onClose,
  onComplete,
}: Props) {
  const { toast } = useToast()
  const [note, setNote] = useState(`Reimbursement owed to ${allocation.employeeName}`)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function handleFileUpload(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("files", file)
    formData.append("folder", "petty-cash")
    const response = await fetch("/api/upload", { method: "POST", body: formData })
    if (!response.ok) throw new Error("Failed to upload file")
    const data = await response.json()
    return data.urls[0]
  }

  async function submit() {
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

      await topUpPettyCashAllocation({
        id: allocation.id,
        topUpAmount: owedAmount,
        topUpBy: paidBy,
        note: note.trim() || `Pay owed — ${formatPettyCashExpense(owedAmount)}`,
        paymentProof: paymentProofUrl || undefined,
        paymentProofName: paymentProofFileName || undefined,
      })

      await updatePettyCashAllocationStatus(
        allocation.id,
        "settled",
        new Date().toISOString(),
      )

      toast({
        title: "Paid & settled",
        message: `${formatPettyCashExpense(owedAmount)} paid to ${allocation.employeeName}. Allocation closed.`,
        type: "success",
      })

      onComplete()
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to pay and settle",
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
            <Banknote className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-lg font-bold">Pay owed & settle</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {allocation.employeeName} • {allocation.purpose}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 px-4 py-3">
            <p className="text-xs text-red-800 dark:text-red-200">Amount owed to employee</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatPettyCashExpense(owedAmount)}
            </p>
            <p className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-2">
              All receipts are approved. This records payment to the employee and closes the allocation.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Payment note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
                id="pay-owed-proof"
                accept="image/*,.pdf"
                onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="pay-owed-proof"
                className="flex flex-col items-center justify-center cursor-pointer text-center"
              >
                <Upload className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-2" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {paymentProof ? paymentProof.name : "Bank transfer / cash receipt"}
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
            className="h-8 text-xs bg-red-600 hover:bg-red-700 ml-auto"
            onClick={submit}
            disabled={loading || uploading}
          >
            {loading || uploading
              ? "Processing..."
              : `Pay ${formatPettyCashExpense(owedAmount)} & settle`}
          </Button>
        </div>
      </div>
    </div>
  )
}
