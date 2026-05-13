"use client"

import { useState } from "react"
import { createPettyCashRequest, type PettyCashAllocation } from "@/lib/petty-cash"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { DollarSign, X } from "lucide-react"

type Props = {
  employeeId: string
  employeeName: string
  employeeRole: string
  onClose: () => void
  onSave: (allocation: PettyCashAllocation) => void
}

export function PettyCashRequestForm({ employeeId, employeeName, employeeRole, onClose, onSave }: Props) {
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [purpose, setPurpose] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!amount || !purpose) {
      toast({ title: "Missing information", message: "Amount and purpose are required.", type: "error" })
      return
    }

    setLoading(true)
    try {
      const allocation = await createPettyCashRequest({
        employeeId,
        employeeName,
        employeeRole,
        amount: parseFloat(amount),
        purpose,
        notes: notes.trim(),
      })
      toast({ title: "Request sent", message: "Your petty cash request was sent for approval.", type: "success" })
      onSave(allocation)
      onClose()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", message: "Failed to submit petty cash request.", type: "error" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <p className="text-lg font-bold">Request Petty Cash</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border bg-[hsl(var(--muted))]/30 px-4 py-3 text-sm">
            <p className="font-medium">{employeeName}</p>
            <p className="text-[hsl(var(--muted-foreground))]">{employeeRole}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Requested amount (PKR) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              placeholder="Enter amount"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Purpose *</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full h-10 rounded-md border bg-[hsl(var(--background))] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              placeholder="Why do you need petty cash?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
              placeholder="Optional details for the approver"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 ml-auto" onClick={submit} disabled={loading}>
            {loading ? "Submitting..." : "Send request"}
          </Button>
        </div>
      </div>
    </div>
  )
}
